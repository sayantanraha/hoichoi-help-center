// ── hc feedback ──────────────────────────────────────────────────────────────

import { firestore } from "../lib/firestore.js";
import { isJson, printJson, printTable, parseDuration } from "../lib/output.js";

export function feedbackCommand(program) {
  const cmd = program.command("feedback").description("Article feedback insights");

  cmd
    .command("list")
    .description("List recent negative feedback (articleFeedbackText)")
    .option("--negative", "only show negative feedback (currently always negative)")
    .option("--last <dur>", "time window (e.g. 7d, 24h, 30d)")
    .option("--limit <n>", "max results", "50")
    .action(async (opts) => {
      const sinceMs = opts.last
        ? Date.now() - parseDuration(opts.last)
        : null;
      const docs = await firestore.listFeedbackText({ sinceMs });
      const slice = docs.slice(0, parseInt(opts.limit, 10) || 50);
      if (isJson()) return printJson(slice);

      printTable(slice, [
        { label: "Article",  key: "articleId", max: 22 },
        { label: "Feedback", key: "feedback",  max: 70 },
        { label: "When",     key: (d) => fmtDate(d.createdAt), max: 16 },
      ]);
    });

  cmd
    .command("stats")
    .description("Likes/dislikes per article")
    .option("--article <id>", "show one article")
    .option("--all", "show all articles")
    .option("--top <n>", "show only top N by total votes", "20")
    .action(async (opts) => {
      if (opts.article) {
        const stats = await firestore.getArticleFeedback(opts.article);
        if (isJson()) return printJson(stats);
        if (!stats) {
          console.log(`(no feedback yet for ${opts.article})`);
          return;
        }
        const total = (stats.likes || 0) + (stats.dislikes || 0);
        const rate = total ? ((stats.likes || 0) / total * 100).toFixed(1) : "—";
        console.log();
        console.log(`Article: ${opts.article}`);
        console.log(`Likes:        ${stats.likes || 0}`);
        console.log(`Dislikes:     ${stats.dislikes || 0}`);
        console.log(`Satisfaction: ${rate}%`);
        return;
      }

      const all = await firestore.listAllFeedbackStats();
      const enriched = all.map(s => {
        const likes = Number(s.likes) || 0;
        const dislikes = Number(s.dislikes) || 0;
        const total = likes + dislikes;
        return { id: s.id, likes, dislikes, total, rate: total ? likes / total : 0 };
      })
      .filter(s => s.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, parseInt(opts.top, 10) || 20);

      if (isJson()) return printJson(enriched);

      printTable(enriched, [
        { label: "Article",   key: "id",       max: 24 },
        { label: "Likes",     key: "likes",    max: 8 },
        { label: "Dislikes",  key: "dislikes", max: 10 },
        { label: "Total",     key: "total",    max: 8 },
        { label: "Sat %",     key: (s) => (s.rate * 100).toFixed(1), max: 8 },
      ]);
    });
}

function fmtDate(ts) {
  if (!ts) return "—";
  const d = new Date(typeof ts === "number" ? ts : Number(ts));
  if (isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 16).replace("T", " ");
}
