// ── hc translate ─────────────────────────────────────────────────────────────

import { api } from "../lib/api.js";
import { isJson, printJson } from "../lib/output.js";

export function translateCommand(program) {
  program
    .command("translate <text>")
    .description("Translate text via /api/translate (Langbly / Google Translate v2)")
    .option("--to <lang>", "target language code (bn, en, hi, ...)", "bn")
    .action(async (text, opts) => {
      const result = await api.translate({ text, target: opts.to });
      if (isJson()) return printJson(result);
      console.log(result.translated);
    });
}
