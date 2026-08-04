/**
 * Tool surface the LLM assistant uses to reason over ACCURATE game data plus the
 * user's current build, instead of us stuffing everything into the prompt. Each
 * tool maps to a typed query in lib/game. Exact-value lookups (affix ranges,
 * skill nodes) are far more reliable through tools than through fuzzy retrieval.
 */
import "server-only";
import * as game from "@/lib/game";
import type { Build } from "@/lib/build/types";
import type { ItemSlot } from "@/tools/data-pipeline/schema";

export interface ToolContext {
  build: Build;
}

type ToolDef = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

const slotEnum: ItemSlot[] = [
  "helmet",
  "body-armour",
  "belt",
  "boots",
  "gloves",
  "amulet",
  "ring",
  "relic",
  "weapon",
  "off-hand",
  "quiver",
  "catalyst",
  "shield",
];

export const TOOLS: ToolDef[] = [
  {
    name: "list_classes",
    description:
      "List every base class and its masteries (id, name, playstyle). Call this first when the user is undecided on a class/mastery.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_skills",
    description:
      "Search specializable skills by keyword and optionally scope to a class or mastery. Returns skill ids, tags, and their specialization-tree nodes. Use it to find skills that fit a damage type or role.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "keyword, e.g. 'void', 'totem', 'movement'. Empty returns all in scope." },
        classId: { type: "string" },
        masteryId: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_skill",
    description: "Get one skill's full specialization tree by id.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_passive_trees",
    description: "Get passive trees (class base and/or mastery), optionally scoped by classId/masteryId, including nodes.",
    input_schema: {
      type: "object",
      properties: { classId: { type: "string" }, masteryId: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "search_affixes",
    description:
      "Search craftable affixes by keyword, optionally filtered by item slot and prefix/suffix. Returns tier ranges — use these for exact gear-target numbers.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        slot: { type: "string", enum: slotEnum },
        type: { type: "string", enum: ["prefix", "suffix"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search_uniques",
    description: "Search unique/set items by keyword, optionally by slot. Returns their special mods and build notes.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" }, slot: { type: "string", enum: slotEnum } },
      additionalProperties: false,
    },
  },
  {
    name: "list_ailments",
    description: "List ailments / status effects (ignite, bleed, shock, etc.) with how they work.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_idols",
    description: "List idols (grid modifier items) and their mods.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_blessings",
    description: "List monolith timeline blessings and their value ranges.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_current_build",
    description:
      "Get the build the user is currently editing (class, mastery, specialized skills + allocated nodes, passives, gear affixes/uniques, idols, blessings, and their stated goal). Call this before giving build-specific advice.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

/** Resolve ids in the build to readable names so the model sees a legible build. */
function enrichBuild(build: Build) {
  const cls = build.classId ? game.getClass(build.classId) : undefined;
  const mastery = cls?.masteries.find((m) => m.id === build.masteryId);
  return {
    name: build.name,
    goal: build.goal,
    class: cls ? { id: cls.id, name: cls.name } : null,
    mastery: mastery ? { id: mastery.id, name: mastery.name } : null,
    skills: build.skills.map((s) => {
      const skill = game.getSkill(s.skillId);
      return {
        id: s.skillId,
        name: skill?.name ?? s.skillId,
        allocatedNodes: Object.entries(s.nodes).map(([nodeId, points]) => ({
          node: skill?.nodes.find((n) => n.id === nodeId)?.name ?? nodeId,
          points,
        })),
      };
    }),
    allocatedPassives: Object.entries(build.passives).map(([nodeId, points]) => ({ nodeId, points })),
    gear: Object.entries(build.gear).map(([slot, g]) => ({
      slot,
      unique: g?.uniqueId,
      affixes: g?.affixes,
    })),
    idols: build.idols,
    blessings: build.blessings,
  };
}

/** Execute a tool call and return a JSON-serializable result. */
export function executeTool(name: string, input: Record<string, unknown>, ctx: ToolContext): unknown {
  switch (name) {
    case "list_classes":
      return game.listClasses();
    case "search_skills":
      return game.searchSkills(String(input.query ?? ""), {
        classId: input.classId as string | undefined,
        masteryId: input.masteryId as string | undefined,
      });
    case "get_skill":
      return game.getSkill(String(input.id)) ?? { error: "not found" };
    case "get_passive_trees":
      return game.getPassiveTrees({
        classId: input.classId as string | undefined,
        masteryId: input.masteryId as string | undefined,
      });
    case "search_affixes":
      return game.searchAffixes(String(input.query ?? ""), {
        slot: input.slot as ItemSlot | undefined,
        type: input.type as "prefix" | "suffix" | undefined,
      });
    case "search_uniques":
      return game.searchUniques(String(input.query ?? ""), { slot: input.slot as ItemSlot | undefined });
    case "list_ailments":
      return game.listAilments();
    case "list_idols":
      return game.listIdols();
    case "list_blessings":
      return game.listBlessings();
    case "get_current_build":
      return enrichBuild(ctx.build);
    default:
      return { error: `unknown tool: ${name}` };
  }
}
