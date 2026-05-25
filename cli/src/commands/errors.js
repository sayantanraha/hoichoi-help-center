// ── hc errors ────────────────────────────────────────────────────────────────

import { firestore } from "../lib/firestore.js";
import { api } from "../lib/api.js";
import { isJson, printJson, printTable, parseDuration, ok } from "../lib/output.js";

export function errorsCommand(program) {
  const cmd = program.command("errors").description("Client-side error logs (Firestore clientErrors)");

  cmd
    .command("list")
    .description("Recent client errors")
    .option("--last <dur>", "time window (e.g. 24h, 7d)", "24h")
    .option("--limit <n>", "max results", "50")
    .action(async (opts) => {
      const sinceMs = Date.now() - parseDuration(opts.last);
      const docs = await firestore.listClientErrors({ sinceMs });
      const slice = docs.slice(0, parseInt(opts.limit, 10) || 50);
      if (isJson()) return printJson(slice);

      printTable(slice, [
        { label: "Type",   key: "type",                                          max: 20 },
        { label: "Source", key: "source",                                        max: 30 },
        { label: "Status", key: "status",                                        max: 8 },
        { label: "Msg",    key: (d) => String(d.message || "").slice(0, 60),    max: 60 },
        { label: "When",   key: (d) => fmtDate(d.timestamp),                     max: 16 },
      ]);
    });

  cmd
    .command("stats")
    .description("Group errors by type or source")
    .option("--by <field>", "type | source | status", "type")
    .option("--last <dur>", "time window", "24h")
    .action(async (opts) => {
      const sinceMs = Date.now() - parseDuration(opts.last);
      const docs = await firestore.listClientErrors({ sinceMs });
      const groups = {};
      for (const d of docs) {
        const key = String(d[opts.by] ?? "(none)");
        groups[key] = (groups[key] || 0) + 1;
      }
      const rows = Object.entries(groups)
        .map(([k, v]) => ({ [opts.by]: k, count: v }))
        .sort((a, b) => b.count - a.count);
      if (isJson()) return printJson(rows);
      printTable(rows, [
        { label: opts.by.toUpperCase(), key: opts.by, max: 40 },
        { label: "Count", key: "count", max: 8 },
      ]);
    });

  cmd
    .command("digest")
    .description("Manually trigger the daily error digest (sends email)")
    .action(async () => {
      const result = await api.errorDigest();
      if (isJson()) return printJson(result);
      ok(`Digest triggered. ${result.count || 0} errors, ${result.groups || 0} unique issues.`);
      if (result.sentTo) console.log(`Sent to: ${result.sentTo}`);
    });
}

function fmtDate(ts) {
  if (!ts) return "—";
  const d = new Date(typeof ts === "number" ? ts : Number(ts));
  if (isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 16).replace("T", " ");
}
