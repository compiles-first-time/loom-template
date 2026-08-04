"use client";

import { useState } from "react";
import { useBuild } from "@/lib/build/store";
import { encodeBuild, decodeBuild } from "@/lib/build/share";
import { MAX_SKILLS } from "@/lib/build/types";
import Assistant from "@/components/Assistant";
import type { GameData, ItemSlot } from "@/tools/data-pipeline/schema";

const SLOTS: ItemSlot[] = [
  "weapon",
  "off-hand",
  "helmet",
  "body-armour",
  "gloves",
  "boots",
  "belt",
  "amulet",
  "ring",
  "relic",
];

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: "1rem 1.15rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>{title}</h3>
        {subtitle && <span className="faint" style={{ fontSize: "0.78rem" }}>{subtitle}</span>}
      </div>
      <div style={{ marginTop: "0.85rem" }}>{children}</div>
    </div>
  );
}

function Stepper({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
      <button className="btn" style={{ padding: "0.15rem 0.5rem" }} onClick={() => onChange(Math.max(0, value - 1))}>
        −
      </button>
      <span style={{ minWidth: 34, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
        {value}/{max}
      </span>
      <button className="btn" style={{ padding: "0.15rem 0.5rem" }} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </span>
  );
}

export default function Editor({ data }: { data: GameData }) {
  const b = useBuild();
  const build = b.build;
  const [shareOpen, setShareOpen] = useState(false);
  const [importCode, setImportCode] = useState("");

  const selectedClass = data.classes.find((c) => c.id === build.classId);
  const masteries = selectedClass?.masteries ?? [];
  const availableSkills = data.skills.filter(
    (s) => (!s.classId || s.classId === build.classId) && (!s.masteryId || s.masteryId === build.masteryId),
  );
  const passiveTrees = data.passives.filter(
    (p) => p.classId === build.classId && (p.scope === "class" || p.masteryId === build.masteryId),
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 420px)", gap: "1.25rem", alignItems: "start" }}>
      {/* Left: build */}
      <div style={{ display: "grid", gap: "1rem" }}>
        <Section title="Build">
          <div style={{ display: "grid", gap: "0.6rem" }}>
            <input
              className="input"
              value={build.name}
              onChange={(e) => b.setMeta({ name: e.target.value })}
              placeholder="Build name"
            />
            <textarea
              className="input"
              value={build.goal}
              onChange={(e) => b.setMeta({ goal: e.target.value })}
              placeholder="Goal — e.g. 'push corruption 300+ with a tanky void melee build'. The assistant uses this."
              rows={2}
              style={{ resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button className="btn" onClick={() => setShareOpen((v) => !v)}>
                Share / import
              </button>
              <button className="btn" onClick={() => b.reset()}>
                Reset
              </button>
            </div>
            {shareOpen && (
              <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.25rem" }}>
                <label className="faint" style={{ fontSize: "0.78rem" }}>Share code (copy):</label>
                <textarea className="input" readOnly rows={2} value={encodeBuild(build)} style={{ fontFamily: "monospace", fontSize: "0.75rem" }} />
                <label className="faint" style={{ fontSize: "0.78rem" }}>Import a code:</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input className="input" value={importCode} onChange={(e) => setImportCode(e.target.value)} placeholder="paste code" />
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      try {
                        b.load(decodeBuild(importCode.trim()));
                        setImportCode("");
                      } catch {
                        alert("Invalid build code.");
                      }
                    }}
                  >
                    Load
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>

        <Section title="Class & Mastery">
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: masteries.length ? "0.75rem" : 0 }}>
            {data.classes.map((c) => (
              <button
                key={c.id}
                className="btn"
                onClick={() => b.setClass(c.id)}
                style={build.classId === c.id ? { borderColor: "var(--accent)", color: "var(--accent-hover)" } : undefined}
              >
                {c.name}
              </button>
            ))}
          </div>
          {masteries.length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {masteries.map((m) => (
                <button
                  key={m.id}
                  className="btn"
                  onClick={() => b.setMastery(m.id)}
                  title={m.playstyle}
                  style={build.masteryId === m.id ? { borderColor: "var(--gold)", color: "var(--gold)" } : undefined}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </Section>

        <Section title="Skills" subtitle={`${build.skills.length}/${MAX_SKILLS} specialized`}>
          {!build.classId && <p className="faint">Pick a class first.</p>}
          {build.classId && (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {availableSkills.map((s) => {
                  const selected = build.skills.some((x) => x.skillId === s.id);
                  return (
                    <button
                      key={s.id}
                      className="btn"
                      onClick={() => (selected ? b.removeSkill(s.id) : b.addSkill(s.id))}
                      disabled={!selected && build.skills.length >= MAX_SKILLS}
                      style={selected ? { borderColor: "var(--accent)", color: "var(--accent-hover)" } : undefined}
                    >
                      {selected ? "✓ " : "+ "}
                      {s.name}
                    </button>
                  );
                })}
                {availableSkills.length === 0 && <p className="faint">No skills for this class in the dataset yet.</p>}
              </div>
              {build.skills.map((sel) => {
                const skill = data.skills.find((s) => s.id === sel.skillId);
                if (!skill) return null;
                return (
                  <div key={sel.skillId} className="card" style={{ padding: "0.75rem 0.9rem", background: "var(--bg)" }}>
                    <strong>{skill.name}</strong>
                    <div style={{ display: "grid", gap: "0.4rem", marginTop: "0.6rem" }}>
                      {skill.nodes.map((n) => (
                        <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontSize: "0.85rem" }} title={n.description}>{n.name}</span>
                          <Stepper value={sel.nodes[n.id] ?? 0} max={n.maxPoints} onChange={(v) => b.setSkillNode(sel.skillId, n.id, v)} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="Passives">
          {!build.classId && <p className="faint">Pick a class first.</p>}
          {passiveTrees.map((tree) => (
            <div key={tree.id} style={{ marginBottom: "0.9rem" }}>
              <div className="faint" style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>
                {tree.name} ({tree.scope})
              </div>
              <div style={{ display: "grid", gap: "0.4rem" }}>
                {tree.nodes.map((n) => (
                  <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.85rem" }} title={n.description}>{n.name}</span>
                    <Stepper value={build.passives[n.id] ?? 0} max={n.maxPoints} onChange={(v) => b.setPassive(n.id, v)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Section>

        <Section title="Gear">
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {SLOTS.map((slot) => {
              const gear = build.gear[slot];
              const uniquesForSlot = data.uniques.filter((u) => u.slot === slot);
              const affixesForSlot = data.affixes.filter((a) => a.slots.includes(slot));
              return (
                <div key={slot} className="card" style={{ padding: "0.6rem 0.75rem", background: "var(--bg)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "0.85rem", textTransform: "capitalize" }}>{slot.replace("-", " ")}</strong>
                    <select
                      className="input"
                      style={{ width: "auto", flex: 1, minWidth: 140 }}
                      value={gear?.uniqueId ?? ""}
                      onChange={(e) =>
                        b.setGear(slot, { uniqueId: e.target.value || undefined, affixes: gear?.affixes ?? [] })
                      }
                    >
                      <option value="">— rare / no unique —</option>
                      {uniquesForSlot.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* affixes */}
                  <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.35rem" }}>
                    {(gear?.affixes ?? []).map((af, idx) => {
                      const affix = data.affixes.find((a) => a.id === af.affixId);
                      return (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem" }}>
                          <span className="chip">{affix?.type ?? "?"}</span>
                          <span style={{ flex: 1 }}>{affix?.name ?? af.affixId}</span>
                          <span className="faint">T{af.tier}</span>
                          <button
                            className="btn"
                            style={{ padding: "0.1rem 0.45rem" }}
                            onClick={() => {
                              const next = (gear?.affixes ?? []).filter((_, i) => i !== idx);
                              b.setGear(slot, { uniqueId: gear?.uniqueId, affixes: next });
                            }}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                    {affixesForSlot.length > 0 && (
                      <select
                        className="input"
                        style={{ fontSize: "0.8rem" }}
                        value=""
                        onChange={(e) => {
                          const affix = data.affixes.find((a) => a.id === e.target.value);
                          if (!affix) return;
                          const tier = affix.tiers.length ? affix.tiers[affix.tiers.length - 1].tier : 1;
                          const next = [...(gear?.affixes ?? []), { affixId: affix.id, tier }];
                          b.setGear(slot, { uniqueId: gear?.uniqueId, affixes: next });
                        }}
                      >
                        <option value="">+ add affix…</option>
                        {affixesForSlot.map((a) => (
                          <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Idols">
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {data.idols.map((i) => (
              <button
                key={i.id}
                className="btn"
                onClick={() => b.toggleIdol(i.id)}
                title={i.mods.map((m) => m.text).join("; ")}
                style={build.idols.includes(i.id) ? { borderColor: "var(--accent)", color: "var(--accent-hover)" } : undefined}
              >
                {build.idols.includes(i.id) ? "✓ " : ""}
                {i.name}
              </button>
            ))}
            {data.idols.length === 0 && <p className="faint">No idols in the dataset yet.</p>}
          </div>
        </Section>

        <Section title="Blessings">
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {data.blessings.map((bl) => (
              <button
                key={bl.id}
                className="btn"
                onClick={() => b.toggleBlessing(bl.id)}
                title={bl.description}
                style={build.blessings.includes(bl.id) ? { borderColor: "var(--gold)", color: "var(--gold)" } : undefined}
              >
                {build.blessings.includes(bl.id) ? "✓ " : ""}
                {bl.name}
              </button>
            ))}
            {data.blessings.length === 0 && <p className="faint">No blessings in the dataset yet.</p>}
          </div>
        </Section>
      </div>

      {/* Right: assistant */}
      <Assistant />
    </div>
  );
}
