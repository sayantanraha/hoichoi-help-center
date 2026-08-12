// ── hc articles ──────────────────────────────────────────────────────────────

import { firestore } from "../lib/firestore.js";
import { isJson, printJson, printTable, warn } from "../lib/output.js";

export function articlesCommand(program) {
  const cmd = program.command("articles").description("Read help-center articles");

  cmd
    .command("list")
    .description("List articles (default: published only)")
    .option("--category <id>", "Filter by category ID")
    .option("--tag <tag>", "Filter by tag: popular | new")
    .option("--status <s>", "published | draft | all", "published")
    .action(async (opts) => {
      const articles = await firestore.listArticles({
        category: opts.category,
        tag: opts.tag,
        status: opts.status,
      });
      if (isJson()) return printJson(articles);

      printTable(articles.sort(byUpdatedDesc), [
        { label: "ID",       key: "id",        max: 30 },
        { label: "Title",    key: "title",     max: 48 },
        { label: "Category", key: (a) => a.categoryId || a.category, max: 18 },
        { label: "Tag",      key: "tag",       max: 10 },
        { label: "Pub",      key: (a) => a.published ? "✓" : "✗", max: 4 },
        { label: "Updated",  key: (a) => fmtDate(a.updatedAt), max: 12 },
      ]);
    });

  cmd
    .command("get <id>")
    .description("Get full article body (use --lang bn for Bengali)")
    .option("--lang <l>", "en | bn", "en")
    .action(async (id, opts) => {
      const article = await firestore.getArticle(id);
      if (!article) {
        warn(`Article "${id}" not found`);
        process.exit(1);
      }
      if (isJson()) return printJson(article);
      const title = opts.lang === "bn" ? (article.titleBn || article.title) : article.title;
      console.log();
      console.log(`# ${title}`);
      console.log();
      console.log(`ID: ${article.id}`);
      console.log(`Category: ${article.categoryId || article.category}`);
      console.log(`Tag: ${article.tag || "—"}`);
      console.log(`Read time: ${article.readTime || "—"}`);
      console.log(`Published: ${article.published ? "yes" : "no"}`);
      console.log();
      console.log("─".repeat(60));
      console.log();
      console.log(article.content || "(no body)");
      console.log();
    });
}

function fmtDate(ts) {
  if (!ts) return "—";
  const d = new Date(typeof ts === "number" ? ts : Number(ts));
  if (isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function byUpdatedDesc(a, b) {
  return (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0);
}
