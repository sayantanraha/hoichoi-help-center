// ── hc search ────────────────────────────────────────────────────────────────
// Matches the current site behaviour: title-only search across all articles.

import { firestore } from "../lib/firestore.js";
import { isJson, printJson, printTable, warn } from "../lib/output.js";

export function searchCommand(program) {
  program
    .command("search <query>")
    .description("Search articles by title (English + Bengali)")
    .option("--lang <l>", "en | bn", "en")
    .option("--limit <n>", "max results", "10")
    .action(async (query, opts) => {
      const q = String(query).toLowerCase().trim();
      if (q.length < 2) {
        warn("Query too short (need >=2 chars)");
        process.exit(1);
      }

      const articles = await firestore.listArticles({ status: "published" });
      const matches = articles.filter(a => {
        const t = String(a.title || "").toLowerCase();
        const tBn = String(a.titleBn || "").toLowerCase();
        return t.includes(q) || tBn.includes(q);
      }).slice(0, parseInt(opts.limit, 10) || 10);

      if (isJson()) return printJson(matches);

      printTable(matches, [
        { label: "ID",       key: "id",       max: 30 },
        { label: "Title",    key: (a) => opts.lang === "bn" ? (a.titleBn || a.title) : a.title, max: 60 },
        { label: "Category", key: (a) => a.categoryId || a.category, max: 18 },
      ]);
    });
}
