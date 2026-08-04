"use client";

import { useMemo, useState } from "react";
import type { GameData } from "@/tools/data-pipeline/schema";

type Tab = "skills" | "passives" | "affixes" | "uniques" | "ailments" | "idols" | "blessings";

const TABS: { id: Tab; label: string }[] = [
  { id: "skills", label: "Skills" },
  { id: "passives", label: "Passives" },
  { id: "affixes", label: "Affixes" },
  { id: "uniques", label: "Uniques" },
  { id: "ailments", label: "Ailments" },
  { id: "idols", label: "Idols" },
  { id: "blessings", label: "Blessings" },
];

function Tags({ tags }: { tags: string[] }) {
  if (!tags?.length) return null;
  return (
    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
      {tags.map((t) => (
        <span key={t} className="chip">
          {t}
        </span>
      ))}
    </div>
  );
}

function Entry({ title, subtitle, children, tags }: { title: string; subtitle?: string; children?: React.ReactNode; tags?: string[] }) {
  return (
    <div className="card" style={{ padding: "0.9rem 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" }}>
        <strong>{title}</strong>
        {subtitle && <span className="faint" style={{ fontSize: "0.75rem" }}>{subtitle}</span>}
      </div>
      {children}
      {tags && <Tags tags={tags} />}
    </div>
  );
}

export default function DataBrowser({ data }: { data: GameData }) {
  const [tab, setTab] = useState<Tab>("skills");
  const [q, setQ] = useState("");

  const matches = (s: string) => s.toLowerCase().includes(q.toLowerCase());

  const items = useMemo(() => {
    switch (tab) {
      case "skills":
        return data.skills
          .filter((s) => !q || matches(s.name) || matches(s.description) || s.tags.some(matches))
          .map((s) => (
            <Entry key={s.id} title={s.name} subtitle={s.masteryId ?? s.classId} tags={s.tags}>
              <p className="muted" style={{ margin: "0.35rem 0", fontSize: "0.88rem" }}>{s.description}</p>
              {s.nodes.length > 0 && (
                <div className="faint" style={{ fontSize: "0.8rem" }}>
                  {s.nodes.length} tree node{s.nodes.length === 1 ? "" : "s"}: {s.nodes.map((n) => n.name).join(", ")}
                </div>
              )}
            </Entry>
          ));
      case "passives":
        return data.passives
          .filter((p) => !q || matches(p.name) || p.nodes.some((n) => matches(n.name)))
          .map((p) => (
            <Entry key={p.id} title={p.name} subtitle={`${p.scope} • ${p.masteryId ?? p.classId}`}>
              <div className="faint" style={{ fontSize: "0.8rem", marginTop: "0.35rem" }}>
                {p.nodes.map((n) => n.name).join(", ")}
              </div>
            </Entry>
          ));
      case "affixes":
        return data.affixes
          .filter((a) => !q || matches(a.name) || a.tags.some(matches))
          .map((a) => (
            <Entry key={a.id} title={a.name} subtitle={a.type} tags={a.tags}>
              <div className="muted" style={{ fontSize: "0.82rem", marginTop: "0.35rem" }}>
                slots: {a.slots.join(", ") || "—"}
              </div>
              {a.tiers.length > 0 && (
                <div className="faint" style={{ fontSize: "0.8rem", marginTop: "0.2rem" }}>
                  {a.tiers.map((t) => `T${t.tier}: ${t.min}–${t.max}`).join("  ·  ")}
                </div>
              )}
            </Entry>
          ));
      case "uniques":
        return data.uniques
          .filter((u) => !q || matches(u.name) || matches(u.note) || u.mods.some((m) => matches(m.text)))
          .map((u) => (
            <Entry key={u.id} title={u.name} subtitle={`${u.slot}${u.isSet ? " • set" : ""}`} tags={u.tags}>
              <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem", fontSize: "0.85rem" }} className="muted">
                {u.mods.map((m, i) => (
                  <li key={i}>{m.text}{m.min != null && m.max != null && m.max > 0 ? ` (${m.min}–${m.max})` : ""}</li>
                ))}
              </ul>
              {u.note && <p className="faint" style={{ fontSize: "0.8rem", marginTop: "0.4rem", fontStyle: "italic" }}>{u.note}</p>}
            </Entry>
          ));
      case "ailments":
        return data.ailments
          .filter((a) => !q || matches(a.name) || matches(a.description))
          .map((a) => (
            <Entry key={a.id} title={a.name} subtitle={a.kind} tags={a.tags}>
              <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>{a.description}</p>
            </Entry>
          ));
      case "idols":
        return data.idols
          .filter((i) => !q || matches(i.name) || i.mods.some((m) => matches(m.text)))
          .map((i) => (
            <Entry key={i.id} title={i.name} subtitle={i.size} tags={i.tags}>
              <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem", fontSize: "0.85rem" }} className="muted">
                {i.mods.map((m, idx) => (
                  <li key={idx}>{m.text}{m.min != null && m.max != null ? ` (${m.min}–${m.max})` : ""}</li>
                ))}
              </ul>
            </Entry>
          ));
      case "blessings":
        return data.blessings
          .filter((b) => !q || matches(b.name) || matches(b.description) || matches(b.timeline))
          .map((b) => (
            <Entry key={b.id} title={b.name} subtitle={b.timeline}>
              <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
                {b.description}
                {b.min != null && b.max != null ? ` (${b.min}–${b.max})` : ""}
              </p>
            </Entry>
          ));
    }
  }, [tab, q, data]);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className="btn"
            onClick={() => setTab(t.id)}
            style={tab === t.id ? { borderColor: "var(--accent)", color: "var(--accent-hover)" } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>
      <input className="input" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
        {items}
      </div>
      {Array.isArray(items) && items.length === 0 && <p className="faint">No matches.</p>}
    </div>
  );
}
