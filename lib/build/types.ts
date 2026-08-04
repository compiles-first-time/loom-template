/**
 * The in-memory representation of a character build the user is designing.
 * Shared between the editor UI (client) and the assistant tool `get_current_build`
 * (server), and round-trippable to a share string (lib/build/share.ts).
 */
import type { ItemSlot } from "@/tools/data-pipeline/schema";

export interface SkillSelection {
  skillId: string;
  /** nodeId -> points allocated */
  nodes: Record<string, number>;
}

export interface GearSelection {
  /** Equipped unique id, if any (mutually informative with affixes). */
  uniqueId?: string;
  /** Crafted affixes on this slot. */
  affixes: { affixId: string; tier: number }[];
}

export interface Build {
  version: 1;
  name: string;
  classId?: string;
  masteryId?: string;
  /** Up to 5 specialized skills. */
  skills: SkillSelection[];
  /** passive nodeId -> points allocated */
  passives: Record<string, number>;
  /** slot -> gear selection */
  gear: Partial<Record<ItemSlot, GearSelection>>;
  /** equipped idol ids */
  idols: string[];
  /** selected blessing ids */
  blessings: string[];
  /** Free-form goal the assistant uses to tailor advice. */
  goal: string;
}

export const MAX_SKILLS = 5;

export function emptyBuild(): Build {
  return {
    version: 1,
    name: "New Build",
    skills: [],
    passives: {},
    gear: {},
    idols: [],
    blessings: [],
    goal: "",
  };
}
