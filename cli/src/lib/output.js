// ── Output formatting helpers ────────────────────────────────────────────────
// Default: pretty human output. Pass --json for machine-readable.

import pc from "picocolors";

let GLOBAL_JSON = false;

export function setJsonMode(on) { GLOBAL_JSON = !!on; }
export function isJson() { return GLOBAL_JSON; }

export function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

export function ok(msg) { console.log(pc.green("✔"), msg); }
export function warn(msg) { console.log(pc.yellow("⚠"), msg); }
export function err(msg) { console.error(pc.red("✖"), msg); }
export function info(msg) { console.log(pc.dim("→"), msg); }

/** Print a list of records as a simple table (no external dep). */
export function printTable(rows, columns) {
  if (rows.length === 0) {
    console.log(pc.dim("(no results)"));
    return;
  }
  const widths = columns.map(c => {
    const w = Math.max(
      c.label.length,
      ...rows.map(r => String(extract(r, c.key) ?? "").length),
    );
    return Math.min(w, c.max || 60);
  });

  const fmtRow = (vals) => vals.map((v, i) => pad(String(v ?? ""), widths[i])).join("  ");

  console.log(pc.bold(fmtRow(columns.map(c => c.label))));
  console.log(pc.dim(widths.map(w => "─".repeat(w)).join("  ")));
  for (const r of rows) {
    console.log(fmtRow(columns.map(c => {
      const v = extract(r, c.key);
      return c.fmt ? c.fmt(v, r) : (v ?? "");
    })));
  }
  console.log();
  console.log(pc.dim(`${rows.length} row(s)`));
}

function extract(obj, key) {
  if (typeof key === "function") return key(obj);
  return obj?.[key];
}

function pad(s, n) {
  if (s.length >= n) return s.slice(0, n - 1) + "…";
  return s + " ".repeat(n - s.length);
}

/** Parse args like "--last 24h" / "--last 7d" into milliseconds. */
export function parseDuration(str) {
  if (!str) return null;
  const m = String(str).match(/^(\d+)\s*(h|d|m|w)$/i);
  if (!m) throw new Error(`Invalid duration: ${str} (use 24h, 7d, 30m, 4w)`);
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const mult = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[unit];
  return n * mult;
}
