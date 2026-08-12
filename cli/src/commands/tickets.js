// ── hc tickets ───────────────────────────────────────────────────────────────

import fs from "node:fs";
import { api } from "../lib/api.js";
import { isJson, printJson, ok, warn } from "../lib/output.js";

export function ticketsCommand(program) {
  const cmd = program.command("tickets").description("Submit and inspect support tickets");

  cmd
    .command("submit")
    .description("Submit a support ticket (Nugget primary, Brevo email fallback)")
    .option("--name <s>", "customer name")
    .option("--email <s>", "customer email")
    .option("--phone <s>", "customer phone")
    .option("--category <s>", "issue category")
    .option("--subcategory <s>", "issue subcategory")
    .option("--device <s>", "device (optional)")
    .option("--description <s>", "issue description")
    .option("--attachment <path>", "path to file to attach")
    .option("--from-stdin", "read JSON payload from stdin")
    .option("--email-only", "skip Nugget — send via /api/send-ticket (Brevo only)")
    .action(async (opts) => {
      let payload;
      if (opts.fromStdin) {
        payload = JSON.parse(fs.readFileSync(0, "utf-8"));
      } else {
        payload = {
          name: opts.name,
          email: opts.email,
          phone: opts.phone,
          category: opts.category,
          subcategory: opts.subcategory,
          device: opts.device,
          description: opts.description,
        };
      }

      if (opts.attachment) {
        const buf = fs.readFileSync(opts.attachment);
        payload.attachment = {
          name: opts.attachment.split("/").pop(),
          base64: buf.toString("base64"),
        };
      }

      const required = ["name", "email", "phone", "category", "subcategory", "description"];
      const missing = required.filter(k => !payload[k]);
      if (missing.length) {
        warn(`Missing required fields: ${missing.join(", ")}`);
        process.exit(1);
      }

      const result = opts.emailOnly
        ? await api.sendTicket(payload)
        : await api.createTicket(payload);

      if (isJson()) return printJson(result);
      ok(`Ticket submitted via ${result.via || "api"}${result.ticket_id ? ` (ID: ${result.ticket_id})` : ""}`);
    });

  cmd
    .command("nugget-token")
    .description("Exchange a UID for a Nugget access token (proxies /api/nugget-token)")
    .requiredOption("--uid <uid>", "session UID")
    .action(async (opts) => {
      const result = await api.nuggetToken(opts.uid);
      if (isJson()) return printJson(result);
      console.log(result.accessToken);
    });
}
