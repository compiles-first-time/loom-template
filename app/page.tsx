import Link from "next/link";
import { dataMeta, isUsingSampleData, listClasses } from "@/lib/game";

export default function Home() {
  const usingSample = isUsingSampleData();
  const meta = dataMeta();
  const classes = listClasses();

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <section style={{ padding: "2rem 0 0.5rem" }}>
        <h1 style={{ fontSize: "2rem", margin: 0, letterSpacing: "-0.02em" }}>
          Design builds you can push monoliths with.
        </h1>
        <p className="muted" style={{ maxWidth: 640, marginTop: "0.75rem", lineHeight: 1.6 }}>
          A pristine build editor and a browsable game database, with an LLM assistant wired
          directly into the data — so it reasons over real skills, passives, affixes and uniques
          instead of guessing.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
          <Link href="/editor" className="btn btn-primary">
            Open the editor →
          </Link>
          <Link href="/data" className="btn">
            Browse game data
          </Link>
        </div>
      </section>

      {usingSample && (
        <div
          className="card"
          style={{ padding: "1rem 1.25rem", borderColor: "var(--gold)", background: "var(--accent-soft)" }}
        >
          <strong style={{ color: "var(--gold)" }}>Running on the sample dataset.</strong>{" "}
          <span className="muted">
            The app is fully functional, but the data is a small hand-curated placeholder ({meta.gameVersion}).
            Run the extraction pipeline in <code>tools/data-pipeline/extract.md</code> to load accurate data
            from your own game install.
          </span>
        </div>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        <div className="card" style={{ padding: "1.1rem" }}>
          <div className="faint" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Classes loaded
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, marginTop: "0.25rem" }}>{classes.length}</div>
          <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
            {classes.map((c) => c.name).join(", ") || "—"}
          </div>
        </div>
        <div className="card" style={{ padding: "1.1rem" }}>
          <div className="faint" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Assistant
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 600, marginTop: "0.4rem" }}>Claude, tool-connected</div>
          <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Set <code>ANTHROPIC_API_KEY</code> in <code>.env.local</code> to enable the chat.
          </div>
        </div>
        <div className="card" style={{ padding: "1.1rem" }}>
          <div className="faint" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Data source
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 600, marginTop: "0.4rem" }}>{meta.source}</div>
          <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>{meta.gameVersion}</div>
        </div>
      </section>
    </div>
  );
}
