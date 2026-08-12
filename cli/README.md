# `hc` — hoichoi Help Center CLI

Command-line interface for the hoichoi Help Center. Lets agents (Claude Code,
Codex, etc.) and humans drive the help center from the terminal: read articles,
run AI-grounded Q&A, submit tickets, fetch feedback, and monitor errors.

**Part of the hoichoi Brain `customer-support-cx` plugin.** See the Brain
repo (`hoichoitech/hoichoi-brain`) for the matching SKILL.md.

---

## Install

```bash
npm install -g github:sayantanraha/hoichoi-help-center#main
```

This installs from the `cli/` folder inside this repo. The `hc` binary becomes
available on your `PATH`.

Verify:

```bash
hc --version
hc doctor
```

---

## Configure

Create `~/.hc-cli.env` (or set the same env vars in your shell):

```bash
# Required for any API call
HC_API_SECRET=...

# Required only for `hc tickets nugget-token`
NUGGET_BASIC_AUTH=...
NUGGET_CLIENT_ID=...

# Optional — defaults to https://hoichoi-help-center.vercel.app
HC_BASE_URL=http://localhost:3000
```

Get the secret from Sayantan R. or the hoichoi password vault. **Never commit
your `.env`.**

---

## Commands

### Articles

```bash
hc articles list                              # all published articles
hc articles list --category billing           # filter by category
hc articles list --tag popular|new            # filter by tag
hc articles list --status published|draft|all
hc articles list --json                       # JSON for piping
hc articles get <id>                          # full body
hc articles get <id> --lang bn                # Bengali version
```

### Search & AI

```bash
hc search "<query>"                           # title-only search (matches site behaviour)
hc search "<query>" --lang en|bn
hc search "<query>" --limit 20

hc ai-answer "<question>"                     # GPT-4o Mini grounded in top 3 articles
hc ai-answer "<question>" --lang bn
hc ai-answer "<question>" --top 5
```

### Categories & site config

```bash
hc categories list                            # all categories with article counts
hc categories get <id>                        # one category + its articles
hc config popular                             # current hero banner articles
hc config show                                # full siteConfig/main document
```

### Tickets

```bash
hc tickets submit \
  --name "Jane Doe" \
  --email "jane@example.com" \
  --phone "+91 9876543210" \
  --category "Billing" \
  --subcategory "Payment failed" \
  --description "Card was charged twice..."

hc tickets submit --from-stdin < ticket.json  # pipe JSON
hc tickets submit --email-only ...            # skip Nugget, send Brevo email
hc tickets submit ... --attachment screenshot.png

hc tickets nugget-token --uid <session-uid>
```

### Feedback

```bash
hc feedback list                              # recent feedback text
hc feedback list --last 7d                    # time-windowed
hc feedback list --limit 100

hc feedback stats --article <id>              # one article's likes/dislikes
hc feedback stats --all                       # satisfaction rate per article
hc feedback stats --top 30
```

### Errors

```bash
hc errors list                                # last 24h
hc errors list --last 7d --limit 100

hc errors stats --by type                     # group by type
hc errors stats --by source --last 7d

hc errors digest                              # manually trigger the daily digest
```

### Translation

```bash
hc translate "<text>" --to bn
hc translate "<text>" --to en
```

### Health

```bash
hc doctor                                     # env + reachability checks
hc --help
hc <command> --help
```

---

## How it works

- **Firestore reads** (articles, categories, feedback, errors) — direct calls
  to the public Firestore REST API. No SDK, no auth. Same pattern as
  `api/error-digest.js`.
- **API calls** (`/api/ai-search`, `/api/create-ticket`, `/api/send-ticket`,
  `/api/nugget-token`, `/api/translate`, `/api/error-digest`) — go through
  the deployed Vercel functions using the `X-HC-Secret` header.
- **No Firebase service account** — by design. The CLI only does what an
  authenticated end-user could do.

---

## Architecture

```
cli/
├── package.json
├── bin/hc                       # shebang entry
├── src/
│   ├── index.js                 # commander wire-up
│   ├── lib/
│   │   ├── config.js            # env var loader (~/.hc-cli.env + process.env)
│   │   ├── api.js               # /api/* wrapper
│   │   ├── firestore.js         # Firestore REST reads
│   │   └── output.js            # JSON vs pretty formatting
│   └── commands/
│       ├── articles.js
│       ├── search.js
│       ├── ai.js
│       ├── tickets.js
│       ├── feedback.js
│       ├── errors.js
│       ├── translate.js
│       ├── categories.js
│       ├── config-cmd.js
│       └── doctor.js
└── README.md
```

Plain Node.js 20+ ESM. No build step. Two deps: `commander`, `picocolors`.

---

## Output

Default: human-readable (tables, colors).
Pass `--json` (global flag, before subcommand) for machine output:

```bash
hc --json articles list --category billing  | jq '.[] | .id'
```

---

## What's NOT in v0

Admin writes (create/update/publish/delete articles, update siteConfig) are
**deferred to v1**. They require either a new `/api/admin-articles` endpoint
or a Firebase service account in the CLI — both pending design.

Today, the CLI is **read-heavy plus ticket submission + AI/translation + error
ops**. Article CRUD happens in the Support Hub inside `hoichoi-cx-intelligence`.

---

## License

Internal hoichoi use only.
