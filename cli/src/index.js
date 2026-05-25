// ── hc — hoichoi Help Center CLI ─────────────────────────────────────────────
//
// Entry point. Wires up all subcommands via commander.js.
//
// Usage:
//   hc <command> [options]
//   hc doctor
//   hc articles list
//   hc ai-answer "how do I cancel subscription?"
//
// Set HC_API_SECRET in ~/.hc-cli.env or your shell env.

import { Command } from "commander";
import pc from "picocolors";
import { createRequire } from "node:module";

import { articlesCommand } from "./commands/articles.js";
import { searchCommand } from "./commands/search.js";
import { aiCommand } from "./commands/ai.js";
import { ticketsCommand } from "./commands/tickets.js";
import { feedbackCommand } from "./commands/feedback.js";
import { errorsCommand } from "./commands/errors.js";
import { translateCommand } from "./commands/translate.js";
import { categoriesCommand } from "./commands/categories.js";
import { configCommand } from "./commands/config-cmd.js";
import { doctorCommand } from "./commands/doctor.js";
import { setJsonMode } from "./lib/output.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const program = new Command();

program
  .name("hc")
  .description("hoichoi Help Center CLI — read articles, run AI search, submit tickets, monitor errors")
  .version(pkg.version)
  .option("--json", "machine-readable JSON output")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.json) setJsonMode(true);
  });

// Subcommands
articlesCommand(program);
searchCommand(program);
aiCommand(program);
ticketsCommand(program);
feedbackCommand(program);
errorsCommand(program);
translateCommand(program);
categoriesCommand(program);
configCommand(program);
doctorCommand(program);

program.parseAsync(process.argv).catch((err) => {
  console.error(pc.red("✖"), err.message);
  if (err.body) console.error(pc.dim(JSON.stringify(err.body, null, 2)));
  process.exit(1);
});
