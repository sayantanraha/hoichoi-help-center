// ── hc ai-answer ─────────────────────────────────────────────────────────────
// Calls /api/ai-search after locally finding top matching articles.

import { firestore } from "../lib/firestore.js";
import { api } from "../lib/api.js";
import { isJson, printJson, warn } from "../lib/output.js";

export function aiCommand(program) {
  program
    .command("ai-answer <question>")
    .description("Get an AI-grounded answer from help-center articles")
    .option("--lang <l>", "en | bn", "en")
    .option("--top <n>", "how many articles to use as grounding", "3")
    .action(async (question, opts) => {
      // Find top matching articles by title overlap (mimics frontend behaviour)
      const articles = await firestore.listArticles({ status: "published" });
      const q = String(question).toLowerCase();
      const scored = articles
        .map(a => {
          const t = String(a.title || "").toLowerCase();
          const tBn = String(a.titleBn || "").toLowerCase();
          let score = 0;
          for (const word of q.split(/\s+/).filter(w => w.length > 2)) {
            if (t.includes(word)) score += 2;
            if (tBn.includes(word)) score += 2;
            if (String(a.content || "").toLowerCase().includes(word)) score += 1;
          }
          return { a, score };
        })
        .filter(s => s.score > 0)
        .sort((x, y) => y.score - x.score)
        .slice(0, parseInt(opts.top, 10) || 3)
        .map(s => s.a);

      if (scored.length === 0) {
        warn("No articles matched the question — AI search needs grounding.");
        process.exit(1);
      }

      const result = await api.aiSearch({
        query: question,
        lang: opts.lang,
        articles: scored.map(a => ({
          id: a.id,
          title: a.title,
          titleBn: a.titleBn,
          content: a.content,
        })),
      });

      if (isJson()) return printJson(result);

      console.log();
      console.log(result.answer || "(no answer)");
      console.log();
      if (result.sources?.length) {
        console.log("Sources:");
        for (const id of result.sources) {
          const src = scored.find(a => a.id === id);
          console.log(`  • ${id}${src ? ` — ${src.title}` : ""}`);
        }
        console.log();
      }
      if (result.cost) {
        console.log(`Cost: $${result.cost.toFixed(6)}  (input ${result.inputTokens}, output ${result.outputTokens})`);
      }
    });
}
