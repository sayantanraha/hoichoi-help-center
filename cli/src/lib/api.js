// ── Help Center API client ───────────────────────────────────────────────────
// Wraps /api/* endpoints with HC_API_SECRET header.

import { config, requireSecret } from "./config.js";

async function callApi(path, { method = "GET", body, query } = {}) {
  requireSecret();
  let url = `${config.baseUrl}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  const headers = { "X-HC-Secret": config.hcApiSecret };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }

  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    const err = new Error(`API ${path} failed: ${msg}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

// ── Endpoint wrappers ────────────────────────────────────────────────────────

export const api = {
  /** POST /api/ai-search */
  async aiSearch({ query, lang = "en", articles }) {
    return callApi("/api/ai-search", {
      method: "POST",
      body: { query, lang, articles },
    });
  },

  /** POST /api/create-ticket (Nugget primary, Brevo fallback) */
  async createTicket(payload) {
    return callApi("/api/create-ticket", {
      method: "POST",
      body: payload,
    });
  },

  /** POST /api/send-ticket (Brevo email only) */
  async sendTicket(payload) {
    return callApi("/api/send-ticket", {
      method: "POST",
      body: payload,
    });
  },

  /** GET /api/nugget-token?uid=... */
  async nuggetToken(uid) {
    return callApi("/api/nugget-token", { method: "GET", query: { uid } });
  },

  /** POST /api/translate */
  async translate({ text, target = "bn" }) {
    return callApi("/api/translate", {
      method: "POST",
      body: { text, target },
    });
  },

  /** GET /api/error-digest — manually trigger daily digest */
  async errorDigest() {
    return callApi("/api/error-digest", { method: "GET" });
  },
};

/**
 * Ping the base URL to confirm reachability (no auth needed).
 */
export async function pingBaseUrl() {
  try {
    const res = await fetch(config.baseUrl, { method: "HEAD" });
    return { ok: res.ok || res.status < 500, status: res.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
