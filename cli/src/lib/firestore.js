// ── Firestore REST reads ─────────────────────────────────────────────────────
// Uses the public Firestore REST API directly. No SDK needed.
// Pattern matches api/error-digest.js — Firebase Web API key is public.
//
// Project: hoichoi-help-center
// Collections we read:
//   - articles
//   - siteConfig (doc `main`)
//   - articleFeedback
//   - articleFeedbackText
//   - clientErrors

import { config } from "./config.js";

const BASE = `https://firestore.googleapis.com/v1/projects/${config.firestoreProject}/databases/(default)/documents`;

/**
 * Convert a Firestore document value into a plain JS value.
 */
function unwrapValue(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue"  in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue"  in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue"    in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) {
    return (v.arrayValue.values || []).map(unwrapValue);
  }
  if ("mapValue" in v) {
    const fields = v.mapValue.fields || {};
    const out = {};
    for (const k in fields) out[k] = unwrapValue(fields[k]);
    return out;
  }
  return null;
}

/**
 * Convert a Firestore document into { id, ...data }.
 */
function unwrapDoc(doc) {
  if (!doc) return null;
  const id = doc.name?.split("/").pop();
  const fields = doc.fields || {};
  const data = {};
  for (const k in fields) data[k] = unwrapValue(fields[k]);
  return { id, ...data };
}

async function fetchDoc(path) {
  const url = `${BASE}/${path}?key=${config.firebaseApiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Firestore GET ${path} failed: ${res.status}`);
  }
  const data = await res.json();
  return unwrapDoc(data);
}

async function listDocs(collection, { pageSize = 500 } = {}) {
  const url = `${BASE}/${collection}?key=${config.firebaseApiKey}&pageSize=${pageSize}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firestore LIST ${collection} failed: ${res.status}`);
  const data = await res.json();
  return (data.documents || []).map(unwrapDoc);
}

async function runQuery(structuredQuery) {
  const url = `https://firestore.googleapis.com/v1/projects/${config.firestoreProject}/databases/(default)/documents:runQuery?key=${config.firebaseApiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) throw new Error(`Firestore runQuery failed: ${res.status}`);
  const rows = await res.json();
  return rows.filter(r => r.document).map(r => unwrapDoc(r.document));
}

// ── Domain reads ─────────────────────────────────────────────────────────────

export const firestore = {
  async listArticles({ category, tag, status = "published" } = {}) {
    const docs = await listDocs("articles", { pageSize: 500 });
    return docs.filter(a => {
      if (status === "published" && a.published !== true) return false;
      if (status === "draft" && a.published === true) return false;
      // "all" → no filter
      if (category && (a.categoryId || a.category) !== category) return false;
      if (tag && a.tag !== tag) return false;
      return true;
    });
  },

  async getArticle(id) {
    return fetchDoc(`articles/${id}`);
  },

  async getSiteConfig() {
    return fetchDoc("siteConfig/main");
  },

  async listFeedbackText({ sinceMs } = {}) {
    if (sinceMs) {
      return runQuery({
        from: [{ collectionId: "articleFeedbackText" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "createdAt" },
            op: "GREATER_THAN_OR_EQUAL",
            value: { integerValue: String(sinceMs) },
          },
        },
        orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }],
        limit: 200,
      });
    }
    const docs = await listDocs("articleFeedbackText", { pageSize: 200 });
    return docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  async getArticleFeedback(articleId) {
    return fetchDoc(`articleFeedback/${articleId}`);
  },

  async listAllFeedbackStats() {
    return listDocs("articleFeedback", { pageSize: 500 });
  },

  async listClientErrors({ sinceMs } = {}) {
    const where = sinceMs ? {
      fieldFilter: {
        field: { fieldPath: "timestamp" },
        op: "GREATER_THAN_OR_EQUAL",
        value: { integerValue: String(sinceMs) },
      },
    } : undefined;
    return runQuery({
      from: [{ collectionId: "clientErrors" }],
      ...(where ? { where } : {}),
      orderBy: [{ field: { fieldPath: "timestamp" }, direction: "DESCENDING" }],
      limit: 500,
    });
  },
};
