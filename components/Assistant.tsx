"use client";

import { useRef, useState } from "react";
import { useBuild } from "@/lib/build/store";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Design a monolith-pushing build around my class.",
  "What's the biggest weakness in my current build?",
  "Suggest gear affix targets for my damage type.",
];

export default function Assistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const history: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history, build: useBuild.getState().build }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Request failed (${res.status}).` }));
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: `⚠️ ${err.error ?? "Request failed."}` };
          return copy;
        });
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      }
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : String(e)}` };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 8rem)", position: "sticky", top: "5rem" }}>
      <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>
        Assistant
        <span className="faint" style={{ fontWeight: 400, fontSize: "0.78rem", marginLeft: "0.5rem" }}>
          reads your build + game data
        </span>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "grid", gap: "0.85rem", alignContent: "start" }}>
        {messages.length === 0 && (
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <p className="muted" style={{ fontSize: "0.88rem", margin: 0 }}>
              Ask about builds, gear targets, skill trees, or defensive layers. The assistant queries the loaded
              game data and your current build.
            </p>
            {SUGGESTIONS.map((s) => (
              <button key={s} className="btn" style={{ justifyContent: "flex-start", textAlign: "left" }} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              justifySelf: m.role === "user" ? "end" : "start",
              maxWidth: "92%",
              background: m.role === "user" ? "var(--accent-soft)" : "var(--bg-elev-2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "0.6rem 0.8rem",
              fontSize: "0.9rem",
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {m.content || (busy && i === messages.length - 1 ? "…" : "")}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        style={{ padding: "0.75rem", borderTop: "1px solid var(--border)", display: "flex", gap: "0.5rem" }}
      >
        <input
          className="input"
          placeholder={busy ? "Thinking…" : "Ask the assistant…"}
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn btn-primary" disabled={busy || !input.trim()} type="submit">
          Send
        </button>
      </form>
    </div>
  );
}
