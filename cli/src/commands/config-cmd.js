// ── hc config ────────────────────────────────────────────────────────────────

import { firestore } from "../lib/firestore.js";
import { isJson, printJson, printTable } from "../lib/output.js";

export function configCommand(program) {
  const cmd = program.command("config").description("Help center site configuration (read-only)");

  cmd
    .command("popular")
    .description("Show the current popular articles list (hero banner)")
    .action(async () => {
      const cfg = await firestore.getSiteConfig();
      const popular = cfg?.popularArticles || [];
      if (isJson()) return printJson(popular);
      printTable(popular, [
        { label: "ID",       key: "id",      max: 24 },
        { label: "Category", key: "catId",   max: 16 },
        { label: "Title",    key: "title",   max: 60 },
      ]);
    });

  cmd
    .command("show")
    .description("Show full siteConfig/main document")
    .action(async () => {
      const cfg = await firestore.getSiteConfig();
      if (isJson()) return printJson(cfg);
      console.log(JSON.stringify(cfg, null, 2));
    });
}
