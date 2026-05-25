// ── hc doctor ────────────────────────────────────────────────────────────────
// Sanity-check the environment + API reachability.

import { config } from "../lib/config.js";
import { pingBaseUrl } from "../lib/api.js";
import pc from "picocolors";

export function doctorCommand(program) {
  program
    .command("doctor")
    .description("Check env vars + API reachability")
    .action(async () => {
      const checks = [];

      checks.push({
        name: "Node.js >= 20",
        ok: Number(process.versions.node.split(".")[0]) >= 20,
        detail: process.versions.node,
        hint: "Install Node 20+: https://nodejs.org",
      });

      checks.push({
        name: "HC_API_SECRET",
        ok: !!config.hcApiSecret,
        detail: config.hcApiSecret ? `${config.hcApiSecret.slice(0, 4)}…` : "not set",
        hint: "Add to ~/.hc-cli.env or export HC_API_SECRET=...",
      });

      checks.push({
        name: "NUGGET_BASIC_AUTH (optional)",
        ok: !!config.nuggetBasicAuth,
        detail: config.nuggetBasicAuth ? "set" : "not set",
        warning: true,
      });

      checks.push({
        name: "NUGGET_CLIENT_ID (optional)",
        ok: !!config.nuggetClientId,
        detail: config.nuggetClientId || "not set",
        warning: true,
      });

      const ping = await pingBaseUrl();
      checks.push({
        name: `Base URL reachable (${config.baseUrl})`,
        ok: ping.ok,
        detail: ping.ok ? `HTTP ${ping.status}` : (ping.error || "unreachable"),
        hint: "Set HC_BASE_URL to override (e.g. http://localhost:3000)",
      });

      console.log();
      console.log(pc.bold("hc doctor"));
      console.log();
      let failed = 0;
      for (const c of checks) {
        const icon = c.ok ? pc.green("✔") : (c.warning ? pc.yellow("⚠") : pc.red("✖"));
        console.log(icon, pad(c.name, 38), pc.dim(c.detail));
        if (!c.ok && c.hint && !c.warning) {
          console.log("   ", pc.dim("→"), pc.dim(c.hint));
        }
        if (!c.ok && !c.warning) failed++;
      }
      console.log();
      if (failed > 0) {
        console.log(pc.red(`${failed} required check(s) failed`));
        process.exit(1);
      } else {
        console.log(pc.green("Ready."));
      }
    });
}

function pad(s, n) {
  if (s.length >= n) return s.slice(0, n - 1) + "…";
  return s + " ".repeat(n - s.length);
}
