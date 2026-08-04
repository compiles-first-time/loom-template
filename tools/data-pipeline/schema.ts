/**
 * Canonical game-data schema for the Last Epoch Build Assistant.
 *
 * This is the CONTRACT between the data pipeline (which fills it from your
 * extracted game files — see extract.md) and the app (which reads it). Both the
 * hand-curated sample dataset in `data/sample/` and the real extracted dataset
 * in `data/game/` must validate against these schemas.
 *
 * Keep this schema faithful to how Last Epoch actually structures its data so
 * the LLM assistant reasons over accurate shapes. When the real extraction
 * (Phase 2) reveals fields we're missing, extend the schemas here first, then
 * re-run the parser.
 */
import { z } from "zod";

/** A stable, lowercase, hyphenated identifier (e.g. "forge-guard"). */
export const Id = z.string().min(1);

/** Item equipment slots. */
export const ItemSlot = z.enum([
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
]);
export type ItemSlot = z.infer<typeof ItemSlot>;

/** A mastery is a specialization of a base class (e.g. Paladin under Sentinel). */
export const Mastery = z.object({
  id: Id,
  name: z.string(),
  classId: Id,
  description: z.string().default(""),
  /** Playstyle summary the assistant leans on when recommending. */
  playstyle: z.string().default(""),
});
export type Mastery = z.infer<typeof Mastery>;

/** One of the base character classes. */
export const GameClass = z.object({
  id: Id,
  name: z.string(),
  description: z.string().default(""),
  masteries: z.array(Mastery).default([]),
});
export type GameClass = z.infer<typeof GameClass>;

/** A single node in a skill or passive tree. */
export const TreeNode = z.object({
  id: Id,
  name: z.string(),
  description: z.string().default(""),
  maxPoints: z.number().int().positive().default(1),
  /** Optional tags used for grouping/search (e.g. "damage", "defence"). */
  tags: z.array(z.string()).default([]),
});
export type TreeNode = z.infer<typeof TreeNode>;

/** A specializable skill and its specialization tree. */
export const Skill = z.object({
  id: Id,
  name: z.string(),
  /** Owning class id; masteryId set when the skill is mastery-locked. */
  classId: Id,
  masteryId: Id.optional(),
  description: z.string().default(""),
  /** e.g. ["melee", "fire", "movement"]. Drives synergy reasoning. */
  tags: z.array(z.string()).default([]),
  nodes: z.array(TreeNode).default([]),
});
export type Skill = z.infer<typeof Skill>;

/** A passive tree: the class base tree or a mastery tree. */
export const PassiveTree = z.object({
  id: Id,
  name: z.string(),
  scope: z.enum(["class", "mastery"]),
  classId: Id,
  masteryId: Id.optional(),
  nodes: z.array(TreeNode).default([]),
});
export type PassiveTree = z.infer<typeof PassiveTree>;

/** One tier of an affix, with the roll range at that tier. */
export const AffixTier = z.object({
  tier: z.number().int().min(1).max(8),
  min: z.number(),
  max: z.number(),
});
export type AffixTier = z.infer<typeof AffixTier>;

/** A craftable affix (prefix or suffix). */
export const Affix = z.object({
  id: Id,
  name: z.string(),
  type: z.enum(["prefix", "suffix"]),
  /** Which item slots this affix can appear on. */
  slots: z.array(ItemSlot).default([]),
  tags: z.array(z.string()).default([]),
  tiers: z.array(AffixTier).default([]),
});
export type Affix = z.infer<typeof Affix>;

/** A single modifier line on a unique/set item or idol. */
export const ItemMod = z.object({
  text: z.string(),
  min: z.number().optional(),
  max: z.number().optional(),
});
export type ItemMod = z.infer<typeof ItemMod>;

/** A unique or set item. */
export const UniqueItem = z.object({
  id: Id,
  name: z.string(),
  slot: ItemSlot,
  baseType: z.string().default(""),
  isSet: z.boolean().default(false),
  mods: z.array(ItemMod).default([]),
  /** Build-relevant note / lore blurb. */
  note: z.string().default(""),
  tags: z.array(z.string()).default([]),
});
export type UniqueItem = z.infer<typeof UniqueItem>;

/** An ailment / status effect. */
export const Ailment = z.object({
  id: Id,
  name: z.string(),
  kind: z.enum(["damage-over-time", "debuff", "buff"]),
  description: z.string().default(""),
  tags: z.array(z.string()).default([]),
});
export type Ailment = z.infer<typeof Ailment>;

/** An idol (grid modifier item). */
export const Idol = z.object({
  id: Id,
  name: z.string(),
  size: z.string().default(""),
  mods: z.array(ItemMod).default([]),
  tags: z.array(z.string()).default([]),
});
export type Idol = z.infer<typeof Idol>;

/** A monolith timeline blessing. */
export const Blessing = z.object({
  id: Id,
  name: z.string(),
  timeline: z.string().default(""),
  description: z.string().default(""),
  min: z.number().optional(),
  max: z.number().optional(),
});
export type Blessing = z.infer<typeof Blessing>;

/** Top-level game dataset. Each category loads from data/<set>/<category>.json. */
export const GameData = z.object({
  meta: z
    .object({
      source: z.string().default("sample"),
      gameVersion: z.string().default("unknown"),
      note: z.string().default(""),
    })
    .default({ source: "sample", gameVersion: "unknown", note: "" }),
  classes: z.array(GameClass).default([]),
  skills: z.array(Skill).default([]),
  passives: z.array(PassiveTree).default([]),
  affixes: z.array(Affix).default([]),
  uniques: z.array(UniqueItem).default([]),
  ailments: z.array(Ailment).default([]),
  idols: z.array(Idol).default([]),
  blessings: z.array(Blessing).default([]),
});
export type GameData = z.infer<typeof GameData>;
