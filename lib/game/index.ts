/**
 * Server-side game-data access layer.
 *
 * Loads the normalized dataset once, validates it against the canonical schema,
 * and exposes typed query functions. These queries are what the LLM assistant's
 * tools call (see lib/assistant/tools.ts), and what the data-browser server
 * components read. Runtime data source:
 *
 *   - If LE_DATA_DIR is set and contains game.json  -> real extracted data
 *   - else if data/game/game.json exists            -> real extracted data
 *   - else                                          -> data/sample/game.json
 *
 * Everything here is server-only (uses fs); never import it into a client
 * component.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { GameData } from "@/tools/data-pipeline/schema";
import type {
  GameData as GameDataT,
  GameClass,
  Skill,
  PassiveTree,
  Affix,
  UniqueItem,
  Ailment,
  Idol,
  Blessing,
  ItemSlot,
} from "@/tools/data-pipeline/schema";

function resolveDataFile(): { file: string; usingSample: boolean } {
  const root = process.cwd();
  const candidates: string[] = [];
  if (process.env.LE_DATA_DIR) {
    candidates.push(path.join(process.env.LE_DATA_DIR, "game.json"));
  }
  candidates.push(path.join(root, "data", "game", "game.json"));
  for (const file of candidates) {
    if (fs.existsSync(file)) return { file, usingSample: false };
  }
  return {
    file: path.join(root, "data", "sample", "game.json"),
    usingSample: true,
  };
}

let cache: { data: GameDataT; usingSample: boolean } | null = null;

export function loadGameData(): { data: GameDataT; usingSample: boolean } {
  if (cache) return cache;
  const { file, usingSample } = resolveDataFile();
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const data = GameData.parse(raw);
  cache = { data, usingSample };
  return cache;
}

/** True when the app is running on the non-authoritative sample dataset. */
export function isUsingSampleData(): boolean {
  return loadGameData().usingSample;
}

function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

// ---- Query functions (also exposed to the assistant as tools) --------------

export function listClasses(): GameClass[] {
  return loadGameData().data.classes;
}

export function getClass(id: string): GameClass | undefined {
  return listClasses().find((c) => c.id === id);
}

export function listMasteries(classId?: string) {
  const classes = classId ? listClasses().filter((c) => c.id === classId) : listClasses();
  return classes.flatMap((c) => c.masteries);
}

export function searchSkills(query: string, opts?: { classId?: string; masteryId?: string }): Skill[] {
  const { data } = loadGameData();
  return data.skills.filter((s) => {
    if (opts?.classId && s.classId !== opts.classId) return false;
    if (opts?.masteryId && s.masteryId !== opts.masteryId) return false;
    if (!query) return true;
    return (
      contains(s.name, query) ||
      contains(s.description, query) ||
      s.tags.some((t) => contains(t, query))
    );
  });
}

export function getSkill(id: string): Skill | undefined {
  return loadGameData().data.skills.find((s) => s.id === id);
}

export function getPassiveTrees(opts?: { classId?: string; masteryId?: string }): PassiveTree[] {
  const { data } = loadGameData();
  return data.passives.filter((p) => {
    if (opts?.classId && p.classId !== opts.classId) return false;
    if (opts?.masteryId && p.masteryId !== opts.masteryId) return false;
    return true;
  });
}

export function searchAffixes(query: string, opts?: { slot?: ItemSlot; type?: "prefix" | "suffix" }): Affix[] {
  const { data } = loadGameData();
  return data.affixes.filter((a) => {
    if (opts?.slot && !a.slots.includes(opts.slot)) return false;
    if (opts?.type && a.type !== opts.type) return false;
    if (!query) return true;
    return contains(a.name, query) || a.tags.some((t) => contains(t, query));
  });
}

export function searchUniques(query: string, opts?: { slot?: ItemSlot }): UniqueItem[] {
  const { data } = loadGameData();
  return data.uniques.filter((u) => {
    if (opts?.slot && u.slot !== opts.slot) return false;
    if (!query) return true;
    return (
      contains(u.name, query) ||
      contains(u.note, query) ||
      u.tags.some((t) => contains(t, query)) ||
      u.mods.some((m) => contains(m.text, query))
    );
  });
}

export function listAilments(): Ailment[] {
  return loadGameData().data.ailments;
}

export function listIdols(): Idol[] {
  return loadGameData().data.idols;
}

export function listBlessings(): Blessing[] {
  return loadGameData().data.blessings;
}

export function dataMeta() {
  return loadGameData().data.meta;
}
