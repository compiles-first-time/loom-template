/**
 * Encode/decode a Build to a compact, URL-safe share string.
 *
 * Local-first and single-user, so we favour a transparent, forward-compatible
 * format (base64url of JSON) over a bit-packed binary format. Good enough to
 * drop a build into a URL, a note, or the assistant. If builds get large we can
 * gzip before base64 without changing the call sites.
 */
import { emptyBuild, type Build } from "./types";

function toBase64Url(s: string): string {
  const b64 =
    typeof btoa === "function"
      ? btoa(unescape(encodeURIComponent(s)))
      : Buffer.from(s, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  if (typeof atob === "function") {
    return decodeURIComponent(escape(atob(padded)));
  }
  return Buffer.from(padded, "base64").toString("utf8");
}

export function encodeBuild(build: Build): string {
  return toBase64Url(JSON.stringify(build));
}

export function decodeBuild(code: string): Build {
  const parsed = JSON.parse(fromBase64Url(code));
  // Merge onto an empty build so missing fields get sane defaults.
  return { ...emptyBuild(), ...parsed, version: 1 };
}
