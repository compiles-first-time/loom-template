# Extracting Last Epoch game data (Phase 2)

The app runs on the hand-curated sample in `data/sample/` until you produce a real
`data/game/game.json`. Because Last Epoch is a Unity game, "accurate data" means
extracting the game's own data assets and normalizing them into our schema
(`schema.ts`). This runs **on your machine** (the code lives in the repo, but the
game files never leave your computer).

> This is a collaborative step. Do steps 1–3, then share a **small sample** of the
> extracted assets (a handful of skill / affix / unique files) so the parser's
> `map*` functions can be written against the real field names. Then we finish 4–5.

## 1. Locate your Last Epoch install

- Steam → Library → right-click **Last Epoch** → **Manage → Browse local files**.
- Note the path (e.g. `.../steamapps/common/Last Epoch`). The data lives in the
  Unity asset bundles / `*_Data` folder.

## 2. Extract the Unity assets

Use a Unity asset extractor. **AssetRipper** (cross-platform, .NET) is the common
choice; the community `LastEpochItemDb` project uses uTinyRipper for the same job.

1. Download AssetRipper (https://github.com/AssetRipper/AssetRipper).
2. Point it at the Last Epoch `*_Data` folder and export.
3. The relevant data is exported as **ScriptableObjects / MonoBehaviours**
   (skills, affixes, uniques, passive trees, etc.), typically as YAML or JSON.

## 3. Stage the raw output

Copy the exported asset files into:

```
tools/data-pipeline/raw/
```

This directory is git-ignored — extracted game assets are yours and are not
committed. Then **share a small sample** (a few representative skill, affix, and
unique asset files) so we can map the real field names.

## 4. Normalize into our schema

```
npm run data:parse
```

`parse.ts` reads `tools/data-pipeline/raw/`, maps assets into the schema in
`schema.ts`, validates, and writes `data/game/game.json`. The `map*` functions in
`parse.ts` are stubs until step 3's sample lets us wire them to the real shape.

## 5. Point the app at the real data

Once `data/game/game.json` exists, the app loads it automatically (see
`lib/game/index.ts`). To keep the raw extraction elsewhere, set `LE_DATA_DIR` in
`.env.local` to the directory containing your `game.json`.

## Refreshing per patch

Re-run steps 2–4 after a game patch. If a patch adds fields we don't model, extend
`schema.ts` first, then the relevant `map*` function, then re-parse.

## Legality note

You're extracting data from a game you own, for personal use, on your own machine.
Don't redistribute the extracted assets or the game's proprietary data; the repo
only commits the normalization code and the small illustrative sample.
