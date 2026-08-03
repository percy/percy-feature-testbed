# percy-feature-testbed

One command that seeds a Percy environment with **real builds of every kind** —
baseline / changed / new / removed, visual-git / A-B, recurring diff, AI, regions,
approval automation — so QA can log in and inspect each feature in the dashboard.

The flow, proven end-to-end against Percy: **create a project → fetch its token →
create builds** (via `percy upload` of static images — no browser needed).

---

## Prerequisites

- **Node ≥ 18.19** and npm.
- A **BrowserStack username + access key** for the account whose Percy org you want to
  seed (this is the Basic-auth credential Percy's API uses to create projects — there is
  no bearer "user token" for project creation).
- A **non-production** target Percy environment (`local` / `staging` / `canary`). The CLI
  **refuses production by design** — to seed a prod project, use the manual recipe below.

```bash
npm install
```

---

## Run it (the CLI)

```bash
# 1. Make a profile for your target env (copy the example, keep secrets out of it)
cp profiles/canary.example.js profiles/canary.js     # edit baseUrl if needed

# 2. Export the credentials the profile references (never commit these)
export BROWSERSTACK_USERNAME=<your-bs-username>
export BROWSERSTACK_ACCESS_KEY=<your-bs-access-key>

# 3. Run — full pass: a project per account tier, each with the build-type spread
npm run cli -- --profile canary
#   or, after `npm run build`:  seed-testbed --profile canary
```

On completion it prints a **run summary**: each build labeled with the feature it
demonstrates + a dashboard deep-link.

### Scope it down with `--only`

```bash
seed-testbed --profile canary --only paid            # all features, just the "paid" tier
seed-testbed --profile canary --only recurring-diff  # one feature, across all tiers
```

- **Features:** `core`, `visual-git`, `recurring-diff`, `ai`, `approval`, `regions`, `app-percy`
- **Tiers:** `free`, `paid`, `ent_global`, `ent_team`, `ai_off`

---

## What gets created

| Build type | How it's produced |
|---|---|
| **baseline / unchanged / changed / new / removed** | `percy upload` of a variant image set; `changed` diffs against an approved `master` baseline |
| **visual-git / A-B** | two branches + `PERCY_TARGET_BRANCH` (variant-A baseline vs variant-B head) |
| **recurring diff** | two consecutive changed builds vs the master baseline |
| **approval** | auto-finalization, supersede (same branch + `skipCache`), and auto-approve (sets a branch rule via the project API) |
| **ai / regions** | build is created, but on the upload path these are **smoke builds** — real AI classification / region config need the SDK/render path (see Limitations) |

Every capture always sets `PERCY_CLIENT_API_URL` to the target env — otherwise the Percy
CLI defaults to `api.percy.io` (prod) and builds land there silently.

---

## How it works

```
seed-testbed --profile <env>
  └─ for each account tier:
       create project   → POST /api/v1/projects            (Basic auth = BS user:key)
       fetch tokens      → GET  /api/v1/projects/<slug>/tokens   (write_only + read_only)
       for each feature:
         write variant images → `npx @percy/cli upload <dir>`  (PERCY_TOKEN=write, branch, target-branch)
         poll the build to finished (read token), approve the baseline where needed
  └─ print a feature-labeled run summary
```

---

## Running against production (manual)

The CLI won't target prod. If you deliberately want to seed a **prod** project (it's real
customer-facing data — create a clearly-named project and archive it after), run the same
primitives directly:

```bash
U=<bs-username>; K=<bs-access-key>

# 1) create a project (org inferred from the creds)
FS=$(curl -sS -X POST https://percy.io/api/v1/projects -u "$U:$K" \
      -H 'Content-Type: application/vnd.api+json' \
      -d '{"data":{"type":"projects","attributes":{"name":"my-testbed","type":"web"}}}' \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['attributes']['full-slug'])")

# 2) fetch the write token
WT=$(curl -sS "https://percy.io/api/v1/projects/$FS/tokens" -u "$U:$K" \
    | python3 -c "import sys,json;print(next(t['attributes']['token'] for t in json.load(sys.stdin)['data'] if t['attributes']['role']=='write_only'))")

# 3) upload images in ./snapshots as a build (add PERCY_TARGET_BRANCH=master for a diff)
PERCY_TOKEN="$WT" PERCY_CLIENT_API_URL=https://percy.io/api/v1 PERCY_BRANCH=master \
  npx -y @percy/cli upload ./snapshots
```

---

## Profiles & secrets

- Each env is a profile under `profiles/`. Copy an `*.example.js` to `profiles/<env>.js`;
  fill in **secret references** (env-var names) only — never inline tokens/keys. Real
  `profiles/*.js` are gitignored; only `*.example.js` templates are tracked.
- The loader always derives `PERCY_CLIENT_API_URL = <baseUrl>/api/v1` and enforces the
  **non-prod allow-list** (prod refused; preprod gated).

---

## Limitations (known)

- **AI** and **regions** are smoke builds on the `percy upload` path — they create builds
  but don't exercise the real AI classifier / region config (those need rendered pages via
  the SDK). Labeled as such in the run summary.
- **App Percy (mobile)** isn't wired to a working capture yet (needs BrowserStack app +
  a pre-uploaded `BS_APP_ID`).
- **Delete:** the public API has no project delete — use `PATCH is-enabled=false` to archive
  via API, or the Project Settings UI for a permanent delete.

---

## Development

```bash
npm test            # 54 unit tests (mocked HTTP + shell — nothing hits the network)
npm run typecheck   # tsc --noEmit
npm run build       # emit dist/ (bin: seed-testbed)
```

Design docs (in the percy hub): `docs/brainstorms/2026-07-27-percy-feature-testbed-requirements.md`
and `docs/plans/2026-07-27-001-feat-percy-feature-testbed-plan.md`.
