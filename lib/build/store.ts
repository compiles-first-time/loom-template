"use client";
/**
 * Client-side build state. The editor mutates this; it persists to localStorage
 * so a local session survives reloads. The assistant reads a snapshot of this
 * (sent with each chat request) via get_current_build.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { emptyBuild, MAX_SKILLS, type Build, type GearSelection } from "./types";
import type { ItemSlot } from "@/tools/data-pipeline/schema";

interface BuildStore {
  build: Build;
  setMeta: (patch: Partial<Pick<Build, "name" | "goal">>) => void;
  setClass: (classId: string) => void;
  setMastery: (masteryId: string) => void;
  addSkill: (skillId: string) => void;
  removeSkill: (skillId: string) => void;
  setSkillNode: (skillId: string, nodeId: string, points: number) => void;
  setPassive: (nodeId: string, points: number) => void;
  setGear: (slot: ItemSlot, gear: GearSelection) => void;
  clearGear: (slot: ItemSlot) => void;
  toggleIdol: (idolId: string) => void;
  toggleBlessing: (blessingId: string) => void;
  load: (build: Build) => void;
  reset: () => void;
}

export const useBuild = create<BuildStore>()(
  persist(
    (set) => ({
      build: emptyBuild(),
      setMeta: (patch) => set((s) => ({ build: { ...s.build, ...patch } })),
      setClass: (classId) =>
        set((s) => ({
          // Changing class invalidates mastery-locked selections.
          build: { ...s.build, classId, masteryId: undefined },
        })),
      setMastery: (masteryId) => set((s) => ({ build: { ...s.build, masteryId } })),
      addSkill: (skillId) =>
        set((s) => {
          if (s.build.skills.some((sk) => sk.skillId === skillId)) return s;
          if (s.build.skills.length >= MAX_SKILLS) return s;
          return { build: { ...s.build, skills: [...s.build.skills, { skillId, nodes: {} }] } };
        }),
      removeSkill: (skillId) =>
        set((s) => ({
          build: { ...s.build, skills: s.build.skills.filter((sk) => sk.skillId !== skillId) },
        })),
      setSkillNode: (skillId, nodeId, points) =>
        set((s) => ({
          build: {
            ...s.build,
            skills: s.build.skills.map((sk) =>
              sk.skillId === skillId
                ? { ...sk, nodes: pruneZero({ ...sk.nodes, [nodeId]: points }) }
                : sk,
            ),
          },
        })),
      setPassive: (nodeId, points) =>
        set((s) => ({ build: { ...s.build, passives: pruneZero({ ...s.build.passives, [nodeId]: points }) } })),
      setGear: (slot, gear) => set((s) => ({ build: { ...s.build, gear: { ...s.build.gear, [slot]: gear } } })),
      clearGear: (slot) =>
        set((s) => {
          const gear = { ...s.build.gear };
          delete gear[slot];
          return { build: { ...s.build, gear } };
        }),
      toggleIdol: (idolId) => set((s) => ({ build: { ...s.build, idols: toggle(s.build.idols, idolId) } })),
      toggleBlessing: (blessingId) =>
        set((s) => ({ build: { ...s.build, blessings: toggle(s.build.blessings, blessingId) } })),
      load: (build) => set({ build }),
      reset: () => set({ build: emptyBuild() }),
    }),
    { name: "leba-build" },
  ),
);

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function pruneZero(rec: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec)) if (v > 0) out[k] = v;
  return out;
}
