// ── hc categories ────────────────────────────────────────────────────────────

import { firestore } from "../lib/firestore.js";
import { isJson, printJson, printTable, warn } from "../lib/output.js";

export function categoriesCommand(program) {
  const cmd = program.command("categories").description("Help center categories (from siteConfig)");

  cmd
    .command("list")
    .description("List all categories")
    .action(async () => {
      const cfg = await firestore.getSiteConfig();
      const cats = cfg?.categories || [];
      if (isJson()) return printJson(cats);

      // Count articles per category
      const articles = await firestore.listArticles({ status: "published" });
      const counts = {};
      for (const a of articles) {
        const c = a.categoryId || a.category;
        if (c) counts[c] = (counts[c] || 0) + 1;
      }

      printTable(cats.map(c => ({ ...c, articleCount: counts[c.id] || 0 })), [
        { label: "ID",      key: "id",            max: 16 },
        { label: "Label",   key: "label",         max: 30 },
        { label: "Bengali", key: "labelBn",       max: 30 },
        { label: "Icon",    key: "icon",          max: 8 },
        { label: "Color",   key: "color",         max: 10 },
        { label: "#Articles", key: "articleCount", max: 10 },
      ]);
    });

  cmd
    .command("get <id>")
    .description("Category details + article list")
    .action(async (id) => {
      const cfg = await firestore.getSiteConfig();
      const cat = (cfg?.categories || []).find(c => c.id === id);
      if (!cat) {
        warn(`Category "${id}" not found in siteConfig`);
        process.exit(1);
      }
      const articles = await firestore.listArticles({ category: id, status: "published" });
      const out = { category: cat, articles };
      if (isJson()) return printJson(out);
      console.log();
      console.log(`Category: ${cat.label} (${cat.id})`);
      if (cat.labelBn) console.log(`Bengali: ${cat.labelBn}`);
      console.log(`Articles: ${articles.length}`);
      console.log();
      printTable(articles, [
        { label: "ID",    key: "id",    max: 30 },
        { label: "Title", key: "title", max: 60 },
        { label: "Tag",   key: "tag",   max: 10 },
      ]);
    });
}
