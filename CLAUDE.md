# hoichoi Help Center — CLAUDE.md

Project state as of April 2026. Use this file to orient any new session.

---

## 1. Project Overview

Two separate user-facing products share one Firebase backend:

| Product | Audience | URL |
|---|---|---|
| **Help Center** (public) | hoichoi subscribers | `hoichoi-help-center.vercel.app` |
| **CX Intelligence** (internal) | hoichoi CX team | `hoichoi-cx-intelligence.vercel.app` |

The Help Center has **two admin surfaces**:
1. **Support Hub** inside CX Intelligence (`hoichoi-cx-intelligence.vercel.app`) — primary admin for articles, categories, popular articles, feedback
2. **Standalone admin portal** at `hoichoi-help-center.vercel.app/admin` (file: `admin.html`) — Firebase Auth (email+password), 3 tabs: Articles, Feedback, Tickets (Tickets tab is a placeholder)

---

## 2. Repository Map

**3 separate git repos — all on GitHub under `sayantanraha`:**

| Local path | GitHub repo | Deploys to |
|---|---|---|
| `/Users/sayantanr/fresh-mcp-test/help-center/` | `hoichoi-help-center` | `hoichoi-help-center.vercel.app` |
| `/Users/sayantanr/hoichoi-cx-intelligence/` | `hoichoi-cx-intelligence` | `hoichoi-cx-intelligence.vercel.app` |
| `/Users/sayantanr/fresh-mcp-test/` | `hoichoi-internal-tools` | OTP Dashboard etc. |

> ⚠️ **Critical:** `fresh-mcp-test/help-center/` is a **nested git repo** inside `fresh-mcp-test/`. The parent repo does NOT track it. Always commit and push Help Center changes from inside `help-center/` directly:
> ```bash
> git -C /Users/sayantanr/fresh-mcp-test/help-center add index.html
> git -C /Users/sayantanr/fresh-mcp-test/help-center commit -m "..."
> git -C /Users/sayantanr/fresh-mcp-test/help-center push origin main
> ```

---

## 3. Tech Stack

Both tools are **React 18 SPAs, no build step** — single HTML file, Babel standalone, CDN dependencies. Hosted on Vercel with GitHub auto-deploy on push to `main`.

**Firebase projects:**
- `hoichoi-qa` — CX Intelligence data (tickets, audits, bot events, users)
- `hoichoi-help-center` — Help Center data (articles, feedback, siteConfig)

**Help Center frontend dependencies (CDN):**
- React 18, ReactDOM 18
- Babel standalone
- Tailwind CSS (CDN)
- Firebase compat SDK v9.23.0 (`firebase-app-compat`, `firebase-firestore-compat`)

---

## 4. Firebase Collections — `hoichoi-help-center` project

### `articles` collection
Each document ID = article ID (e.g. `a1`, `b3`, `account-login-otp`).

| Field | Type | Notes |
|---|---|---|
| `title` | string | English title |
| `titleBn` | string | Bengali title |
| `categoryId` | string | Category ID (e.g. `account`, `billing`) |
| `category` | string | Legacy alias for `categoryId` — both are written on save |
| `tag` | string or null | `"popular"`, `"new"`, or `null` |
| `readTime` | string | e.g. `"3 min"` |
| `content` | string | Markdown-style body text |
| `relatedArticles` | array of strings | Article IDs |
| `published` | boolean | `true` = live on Help Center |
| `createdAt` | number | Unix timestamp ms |
| `updatedAt` | number | Unix timestamp ms |
| `updatedBy` | string | Email of last editor |

> Note: Always write **both** `categoryId` and `category` fields when saving from CX Intelligence — public site checks both for compatibility.

### `siteConfig` collection — document `main`

| Field | Type | Notes |
|---|---|---|
| `popularArticles` | array | `[{ id, catId, title }]` — controls hero banner |
| `categories` | array | `[{ id, label, labelBn, icon, color }]` — controls category grid |

If `siteConfig/main` doesn't exist, the public site falls back to hardcoded defaults.

### `articleFeedbackText` collection
Negative feedback submissions from readers.

| Field | Type |
|---|---|
| `articleId` | string |
| `feedback` | string |
| `createdAt` | number |

---

## 5. Public Help Center — Key Architecture

**File:** `/Users/sayantanr/fresh-mcp-test/help-center/index.html`

### Data loading (App component, on mount)
```javascript
// 1. All published articles
db.collection('articles').where('published', '==', true).get()
  .then(snap => setAllArticles(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

// 2. siteConfig — popular articles + categories
db.collection('siteConfig').doc('main').get()
  .then(doc => {
    if (data.popularArticles) setPopularArticles(data.popularArticles);
    if (data.categories?.length > 0) setCategories(data.categories);
  })
```

### Props flow
All views receive: `{ navigate, lang, allArticles, popularArticles, categories }`

### Category count (dynamic)
```javascript
const count = allArticles.filter(a => (a.categoryId || a.category) === cat.id).length;
```

### Related articles lookup (ArticleView)
```javascript
// Looks up from allArticles first, falls back to hardcoded ARTICLES object
const found = allArticles.find(a => a.id === id);
if (found) return { ...found, catId: found.categoryId || found.category };
```

### Article content
Fetched **per article** from Firestore when ArticleView mounts:
```javascript
db.collection('articles').doc(articleId).get()
  .then(doc => { if (doc.exists) setFsContent(doc.data()); })
```
Falls back to hardcoded `ARTICLE_CONTENT` object for legacy stub articles (a1, t1, py1, s1).

### Hash routing
- `#home` → HomeView
- `#getstarted` → GetStartedView
- `#category/{catId}` → CategoryView
- `#article/{articleId}/{catId}` → ArticleView
- `#videos` → VideoLibraryView
- `#search/{query}` → SearchView

### Search behaviour
- Live dropdown searches `allArticles` by **title only** (English + Bengali) — also includes videos
- `SearchView` results: **title-only** filter — body content is NOT searched (pending task)

### Article content loading
- `allArticles` state holds **metadata only** (title, tag, readTime, categoryId, likes, views) — loaded on app mount
- Article **body content** is fetched separately per-article when `ArticleView` mounts — not preloaded
- This means full-text search cannot be done client-side without prefetching or a different strategy

### Hardcoded fallbacks (do not remove)
- `ARTICLES` object — metadata fallback for legacy articles not yet in Firestore
- `ARTICLE_CONTENT` object — body content fallback for a1, t1, py1, s1 only
- `POPULAR_ARTICLES` — fallback if `siteConfig/main` doesn't exist
- `CATEGORIES` — fallback if `siteConfig/main.categories` is empty

### Article view/likes counts
- Counts shown in category lists (views, likes) come from the hardcoded `ARTICLES` object — **not real-time Firestore tracking**
- `ArticleFeedback` component does write live likes/dislikes to `articleFeedback` collection, but views are not tracked

### Feedback behaviour (ArticleFeedback component)
- Thumbs up/down writes to `articleFeedback` collection (increments likes/dislikes)
- Text feedback textarea **only appears on dislike** — not on thumbs up
- Text submitted to `articleFeedbackText` collection with `{ articleId, feedback, vote, createdAt }`
- Vote persisted in `localStorage` key `hc_vote_{articleId}` (one vote per browser)

### Language toggle
- EN/BN toggle exists in topbar — switches article titles and category labels only
- Article **body content** is English only — no auto-translation built yet

### Theme
- Binary light/dark toggle only (no "Auto" mode unlike CX Intelligence)
- `data-theme` attribute on `<html>` — CSS variables handle theming

### Nugget Chat
- `openNuggetChat()` function exists but SDK embed snippet is **commented out**
- Falls back to `alert()` until real Nugget SDK embed is added

### Video Library
- 8 hardcoded videos with emoji thumbnails — **no real video links yet**
- Placeholder content only

---

## 6. Standalone Admin Portal (admin.html)

**File:** `/Users/sayantanr/fresh-mcp-test/help-center/admin.html`
**URL:** `hoichoi-help-center.vercel.app/admin`
**Auth:** Firebase Auth — email + password (separate from CX Intelligence which uses PIN)

3 sidebar tabs:

| Tab | What it does |
|---|---|
| Articles | Full CRUD — create, edit, publish/unpublish, delete. Filters by category/status/search. |
| Feedback | Shows `articleFeedback` (likes/dislikes per article + satisfaction rate) and `articleFeedbackText` (text comments). View-only. |
| Tickets | Placeholder — shows code snippet for adding Firestore logging to `send-ticket.js`. Not built. |

**Key difference from Support Hub:** This admin only manages the `hoichoi-help-center` Firebase project directly (same `db` as `index.html`). No secondary Firebase app needed — it's in the same repo.

**Article save in admin.html** uses `serverTimestamp()` (not `Date.now()`) for `updatedAt` and `createdAt`.

---

## 7. CX Intelligence — Support Hub (Primary Admin)

**File:** `/Users/sayantanr/hoichoi-cx-intelligence/index.html`

The Support Hub is an admin-only section (sidebar: `🛟 Support Hub`) with 4 tabs:

| Tab | What it does |
|---|---|
| 📄 Articles | Full CRUD for Help Center articles — create, edit, publish/unpublish, delete |
| 🗂️ Categories | Add/edit/delete categories → saved to `siteConfig/main.categories` |
| ⭐ Popular Articles | Manage hero banner list → saved to `siteConfig/main.popularArticles` |
| 💬 Feedback | View `articleFeedbackText` collection — negative reader feedback |

**Second Firebase app inside CX Intelligence:**
```javascript
const hcApp = firebase.initializeApp(hcFirebaseConfig, 'hoichoi-help-center');
const hcDb = firebase.firestore(hcApp);
```
All Support Hub operations use `hcDb` (pointing to `hoichoi-help-center` project), not the main `db` (which points to `hoichoi-qa`).

**Article save payload:**
```javascript
{
  title, titleBn,
  categoryId: data.category,  // new field name
  category: data.category,    // legacy alias — keep both
  tag, readTime, content,
  relatedArticles: data.relatedArticles.split(',').map(s => s.trim()).filter(Boolean),
  published,
  updatedAt: Date.now(),
  updatedBy: currentUser.email,
  // on new articles only:
  createdAt: Date.now(), views: 0, likes: 0, dislikes: 0
}
```

---

## 8. Firestore Security Rules — `hoichoi-help-center`

Currently set to:
```
allow read: if true;         // public reads for Help Center
allow write: if false;       // locked — change temporarily to upload articles
```

To upload articles from CX Intelligence (Support Hub), rules must be:
```
allow write: if request.auth != null;
```
Revert to `if false` after bulk operations. Regular Support Hub writes go through Firebase Auth (user must be logged in to CX Intelligence).

---

## 9. Completed Work (this project cycle)

### 67 Articles uploaded to Firestore
- 15 Account & Login (`a1`–`a15`)
- 21 Subscription & Payments (`b1`–`b21`)
- 10 Streaming & Playback (`s1`–`s10`)
- 13 Downloads & Offline (`d1`–`d13`)
- 7 Top Queries (deferred — not yet uploaded)
- 2 Content Discovery
- 6 New articles
- Source: `CX Responses.docx` — improved, deduped, formal tone, step-by-step, no emojis

### 4 Bugs fixed (public Help Center)
1. **Category counts wrong** — now computed from live Firestore data
2. **Related articles wrong navigation** — now uses `categoryId` from Firestore
3. **Popular articles hardcoded** — now loaded from `siteConfig/main.popularArticles`
4. **No category management in admin** — added Categories + Popular Articles tabs to Support Hub

---

## 10. Pending Tasks

### High Priority
- [ ] **Full-text search** — currently searches article titles only; should also search body content fetched from Firestore
- [ ] **Article analytics** — views per article; D360 tracks views, searches, engagement, top articles — we have none
- [ ] **Auto Bengali translation** — 95% of users are Bengali; use Google Translate API to translate article content on-the-fly when `lang === 'bn'`
- [ ] **Draft/Published workflow** — currently only a Published/Unpublished toggle; add Draft state before publishing
- [ ] **Feedback with reason** — add required reason dropdown to article feedback (Inaccurate / Difficult to understand / Missing info / Other) — aligns with D360 pattern
- [ ] **Callout blocks in editor** — add Info/Warning/Error callout block type to article content renderer (frontend) and ArticleEditor textarea (Support Hub)

### Medium Priority
- [ ] **SEO fields per article** — meta title, meta description, URL slug (D360 has per-article SEO config)
- [ ] **Team audit log** — track who changed what and when; currently only `updatedBy` field on articles
- [ ] **Bulk operations in Support Hub** — bulk publish/unpublish/delete articles

### Longer Term
- [ ] **Article versioning** — revision history, ability to revert to previous versions
- [ ] **Top Queries articles** — 7 articles not yet uploaded (deferred)

---

## 11. Key Rules / Lessons Learned

1. **Never re-declare variables in the same function scope** — duplicate `const isAdmin` in CX Intelligence caused a Babel SyntaxError → blank page. Always check for existing declarations before adding new ones.
2. **Always push Help Center from its own repo** — `fresh-mcp-test/help-center/` is a nested git repo. Pushing from the parent (`fresh-mcp-test/`) does nothing for the Help Center.
3. **Both `categoryId` and `category` fields must be written** — uploaded articles use `categoryId`, CX Intelligence editor historically used `category`. Public site checks `a.categoryId || a.category` for compatibility.
4. **Firestore security rules must allow writes before Support Hub can save** — if writes fail, check `hoichoi-help-center` project rules in Firebase Console.
