import { watch, promises as fs, existsSync, statSync } from "node:fs";
import path from "node:path";

export class FileWatcher {
  constructor({ debounceMs = 150 } = {}) {
    this._watchers = [];
    this._debounceMs = debounceMs;
    this._offsets = new Map();
    this._listeners = { jsonl: [], file: [] };
    this._timers = new Map();
  }

  onJsonlAppend(fn) { this._listeners.jsonl.push(fn); }
  onFileChange(fn) { this._listeners.file.push(fn); }

  watchJsonlDir(dir) {
    if (!existsSync(dir)) return;
    const w = watch(dir, { persistent: false }, (_event, filename) => {
      if (!filename || !filename.endsWith(".jsonl")) return;
      this._debounce(path.join(dir, filename), () => this._tailJsonl(path.join(dir, filename)));
    });
    this._watchers.push(w);
  }

  watchFile(filePath) {
    const dir = path.dirname(filePath);
    const base = path.basename(filePath);
    if (!existsSync(dir)) return;
    const w = watch(dir, { persistent: false }, (_event, filename) => {
      if (filename !== base) return;
      this._debounce(filePath, () => this._emitFileChange(filePath));
    });
    this._watchers.push(w);
  }

  watchDir(dir, filter) {
    if (!existsSync(dir)) return;
    const w = watch(dir, { persistent: false }, (_event, filename) => {
      if (!filename) return;
      if (filter && !filter(filename)) return;
      const full = path.join(dir, filename);
      this._debounce(full, () => this._emitFileChange(full));
    });
    this._watchers.push(w);
  }

  async _tailJsonl(filePath) {
    try {
      const stat = statSync(filePath);
      const prev = this._offsets.get(filePath) || 0;
      if (stat.size <= prev) return;

      const fh = await fs.open(filePath, "r");
      const buf = Buffer.alloc(stat.size - prev);
      await fh.read(buf, 0, buf.length, prev);
      await fh.close();
      this._offsets.set(filePath, stat.size);

      const text = buf.toString("utf8");
      const lines = text.split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          for (const fn of this._listeners.jsonl) fn(record, filePath);
        } catch { /* skip malformed lines */ }
      }
    } catch { /* file may have been deleted mid-read */ }
  }

  _emitFileChange(filePath) {
    for (const fn of this._listeners.file) fn(filePath);
  }

  _debounce(key, fn) {
    const existing = this._timers.get(key);
    if (existing) clearTimeout(existing);
    this._timers.set(key, setTimeout(() => {
      this._timers.delete(key);
      fn();
    }, this._debounceMs));
  }

  async replayJsonlFiles(dir, daysBack = 7) {
    if (!existsSync(dir)) return;
    const now = new Date();
    const entries = await fs.readdir(dir);
    const jsonlFiles = entries
      .filter((f) => f.endsWith(".jsonl"))
      .sort();

    const cutoff = new Date(now);
    cutoff.setUTCDate(cutoff.getUTCDate() - daysBack);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    for (const file of jsonlFiles) {
      const dateStr = file.replace(".jsonl", "");
      if (dateStr < cutoffStr) continue;

      const fullPath = path.join(dir, file);
      const text = await fs.readFile(fullPath, "utf8");
      const lines = text.split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          for (const fn of this._listeners.jsonl) fn(record, fullPath);
        } catch { /* skip */ }
      }
      const stat = statSync(fullPath);
      this._offsets.set(fullPath, stat.size);
    }
  }

  close() {
    for (const w of this._watchers) w.close();
    for (const t of this._timers.values()) clearTimeout(t);
    this._watchers = [];
    this._timers.clear();
  }
}
