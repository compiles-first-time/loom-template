import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Last Epoch Build Assistant",
  description: "Design monolith-pushing Last Epoch builds with an LLM wired into the game data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header
          style={{
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-elev)",
            position: "sticky",
            top: 0,
            zIndex: 20,
          }}
        >
          <div
            style={{
              maxWidth: 1400,
              margin: "0 auto",
              padding: "0.75rem 1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "1.5rem",
            }}
          >
            <Link href="/" style={{ fontWeight: 700, letterSpacing: "-0.01em" }}>
              <span style={{ color: "var(--accent)" }}>◆</span> LE Build Assistant
            </Link>
            <nav style={{ display: "flex", gap: "1rem", fontSize: "0.9rem" }} className="muted">
              <Link href="/editor">Editor</Link>
              <Link href="/data">Data</Link>
            </nav>
          </div>
        </header>
        <main style={{ maxWidth: 1400, margin: "0 auto", padding: "1.25rem" }}>{children}</main>
      </body>
    </html>
  );
}
