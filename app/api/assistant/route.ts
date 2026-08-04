import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { TOOLS, executeTool } from "@/lib/assistant/tools";
import { systemPrompt } from "@/lib/assistant/prompt";
import type { Build } from "@/lib/build/types";

// Reads game data from disk (fs) — must run on the Node runtime, not edge.
export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = process.env.ASSISTANT_MODEL || "claude-opus-5";
const MAX_TOOL_ROUNDS = 8;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Copy .env.local.example to .env.local and add your Anthropic API key, then restart `npm run dev`.",
      },
      { status: 500 },
    );
  }

  const body = (await req.json()) as { messages: ChatMessage[]; build: Build };
  const client = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const encoder = new TextEncoder();
  const ctx = { build: body.build };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          // effort/thinking/output_config aren't fully in the SDK's static types
          // across versions; the wire params are correct for claude-opus-5.
          const params = {
            model: MODEL,
            max_tokens: 16000,
            system: systemPrompt(),
            thinking: { type: "adaptive" },
            output_config: { effort: "high" },
            tools: TOOLS,
            messages,
          } as unknown as Parameters<typeof client.messages.stream>[0];

          const s = client.messages.stream(params);
          s.on("text", (delta) => send(delta));
          const msg = await s.finalMessage();
          messages.push({ role: "assistant", content: msg.content });

          if (msg.stop_reason !== "tool_use") break;

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of msg.content) {
            if (block.type !== "tool_use") continue;
            try {
              const result = executeTool(block.name, (block.input ?? {}) as Record<string, unknown>, ctx);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify(result),
              });
            } catch (e) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                is_error: true,
                content: `tool error: ${e instanceof Error ? e.message : String(e)}`,
              });
            }
          }
          messages.push({ role: "user", content: toolResults });
        }
      } catch (e) {
        send(`\n\n[assistant error: ${e instanceof Error ? e.message : String(e)}]`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
