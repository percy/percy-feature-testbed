# percy-feature-testbed

One command that seeds a Percy environment with **real builds of every kind** —
baseline / changed / new / removed, visual-git / A-B, recurring diff, AI, regions,
approval automation — so QA can log in and inspect each feature in the dashboard.

The flow, proven end-to-end against Percy: **create a project → fetch its token →
create builds** — `percy snapshot` serves generated fixture pages and renders them in a
real browser, so builds carry actual DOM (headings, tables, carousel, banner, ad slot)
rather than flat colour blocks.

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

### Scope it down with `--only` / `--tier`

```bash
seed-testbed --profile canary --only paid                  # all features, just the "paid" tier
seed-testbed --profile canary --only recurring-diff        # one feature, across all tiers
seed-testbed --profile canary --only visual-git --tier paid # one feature, one project
```

- **Features:** `core`, `visual-git`, `recurring-diff`, `ai`, `approval`, `regions`, `app-percy`
- **Tiers:** `free`, `paid`, `ent_global`, `ent_team`, `ai_off`

### Per-feature shortcuts

Each feature is a one-liner that seeds just that suite's builds in a **single project**:

| Command | Seeds |
|---|---|
| `npm run core` | new / changed / unchanged / removed |
| `npm run ab` | **A/B** variant comparison (visual-git / target-branch) |
| `npm run recurring-diff` | recurring diff |
| `npm run ai` | AI review over the upstream `test_bed/ai` pages |
| `npm run regions` | `ignore` + `layout` region rules, each with a `standard` control |
| `npm run intelli-ignore` | IntelliIgnore + sensitivity sweep, with a `standard` control |
| `npm run approval` | auto-finalization, supersede, auto-approve |
| `npm run app` | App Percy *(not yet wired)* |
| `npm run seed:all` | the full matrix (all tiers × all features) |

Each defaults to `--profile canary --tier paid`; override with env vars:

```bash
PROFILE=staging TIER=free npm run ai
```

(You still need a `profiles/<env>.js` file and the creds exported — see above.)

---

## What gets created

| Build type | How it's produced |
|---|---|
| **baseline / unchanged / changed / new / removed** | `percy snapshot` of a generated fixture set; adding/removing a page produces NEW/REMOVED, and `changed` moves the Growth plan price ($99 -> $129) against an approved `master` baseline |
| **visual-git / A-B** | two branches + `PERCY_TARGET_BRANCH` (variant-A baseline vs variant-B head) |
| **recurring diff** | two consecutive changed builds vs the master baseline |
| **approval** | auto-finalization, supersede (same branch + `skipCache`), and auto-approve (sets a branch rule via the project API) |
| **ai** | renders the upstream `percy_playwright/test_bed/ai` pages in place (8 baseline/changed pairs + reduce-diff) — real content for the classifier to work on |
| **regions / intelli-ignore** | region rules (`standard` / `layout` / `ignore` / `intelliignore`) attached per snapshot via a generated Percy config; each rule build is paired with a `standard` **control** over the same fixture pair |

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
         render fixture pages → `npx @percy/cli snapshot <dir> --config <cfg>`
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

- **Region-rule outcomes are not yet verified.** The fixtures render, the config is
  accepted, and `algorithm` demonstrably changes results (the same layout-shift pair gives
  0 diffs under `standard` and 4 under `layout`). But an `ignore` region on the carousel did
  **not** reduce the build's diff count, and IntelliIgnore did not measurably suppress the
  noise zones. `total-comparisons-diff` is per comparison, not per region, so it cannot tell
  you whether a rule fired — verifying these properly needs per-region comparison data.
  Treat the current expectations in the run summary as *intended*, not *confirmed*.
- **AI** builds now use real pages, but AI output quality is not asserted (and the
  requirements doc exempts AI from determinism).
- **App Percy (mobile)** isn't wired to a working capture yet (needs BrowserStack app +
  a pre-uploaded `BS_APP_ID`).
- **Fixtures are a fixed 1280px layout**, so snapshots are pinned to that width. At Percy's
  default 375px the price table falls outside the render and a real change produces no diff.
- **`npm run build` output is not runnable** — `tsc` emits extensionless ESM imports, so
  `dist/main.js` (the declared `bin`) fails to resolve. Everything runs through `tsx`.
- **Delete:** the public API has no project delete — use `PATCH is-enabled=false` to archive
  via API, or the Project Settings UI for a permanent delete.

---

## Development

```bash
npm test            # 80 unit tests (mocked HTTP + shell — nothing hits the network)
npm run typecheck   # tsc --noEmit
npm run build       # emit dist/ (bin: seed-testbed)
```

Design docs (in the percy hub): `docs/brainstorms/2026-07-27-percy-feature-testbed-requirements.md`
and `docs/plans/2026-07-27-001-feat-percy-feature-testbed-plan.md`.
