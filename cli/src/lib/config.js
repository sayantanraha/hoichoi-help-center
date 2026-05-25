// ── CLI config — env vars + base URL ─────────────────────────────────────────
//
// Loads:
//   HC_API_SECRET      — required for /api/* calls
//   NUGGET_BASIC_AUTH  — only for `hc tickets nugget-token`
//   NUGGET_CLIENT_ID   — same
//
// Optional overrides:
//   HC_BASE_URL        — defaults to https://hoichoi-help-center.vercel.app
//                        (e.g. http://localhost:3000 for local dev)

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_BASE = "https://hoichoi-help-center.vercel.app";

const FIRESTORE_PROJECT = "hoichoi-help-center";
// Public Web API key — same value embedded in index.html + api/error-digest.js
const FIREBASE_API_KEY = "AIzaSyDbaSdfHpLbcKFLu0gP6Ftji6PXW1VJ5Jk";

/**
 * Load env file at ~/.hc-cli.env (if exists), then merge process.env over it.
 */
function loadEnvFile() {
  const candidates = [
    path.join(os.homedir(), ".hc-cli.env"),
    path.join(process.cwd(), ".env"),
  ];
  for (const f of candidates) {
    if (!fs.existsSync(f)) continue;
    try {
      const content = fs.readFileSync(f, "utf-8");
      for (const raw of content.split("\n")) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let val = line.slice(eq + 1).trim();
        // Strip surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = val;
      }
    } catch (_) {
      // ignore parse errors — env vars already in process.env still work
    }
  }
}

loadEnvFile();

export const config = {
  baseUrl:           process.env.HC_BASE_URL || DEFAULT_BASE,
  hcApiSecret:       process.env.HC_API_SECRET || "",
  nuggetBasicAuth:   process.env.NUGGET_BASIC_AUTH || "",
  nuggetClientId:    process.env.NUGGET_CLIENT_ID || "",
  firestoreProject:  FIRESTORE_PROJECT,
  firebaseApiKey:    FIREBASE_API_KEY,
};

export function requireSecret() {
  if (!config.hcApiSecret) {
    throw new Error(
      "HC_API_SECRET not set. Add it to ~/.hc-cli.env or export it in your shell.\n" +
      "Get the secret from Sayantan R. or the hoichoi password vault."
    );
  }
}
