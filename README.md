# percy-feature-testbed

One command that populates a Percy environment with **real renderer-backed** builds
exercising **every Percy feature** — for manual QA. A human then logs into the
pre-populated accounts and inspects each feature in the dashboard.

```
seed-testbed --profile <local|staging|canary> [--only <feature|tier>]
```

- Full pass (default): creates orgs/projects and builds across the account matrix
  (free / paid / ent_global / ent_team / ai_off) for Web + App Percy, covering core
  review states, visual-git / A-B, recurring diff, AI, approval automation, and regions.
- `--only <feature|tier>`: a **coarse** filter for cheap retry/debug — one feature or
  one tier. (It is *not* a per-scenario catalog.)

**Design & plan:** `../docs/plans/2026-07-27-001-feat-percy-feature-testbed-plan.md`
(origin brainstorm: `../docs/brainstorms/2026-07-27-percy-feature-testbed-requirements.md`).

> **Status: scaffold only (plan Unit 1).** The CLI parses and routes; the orchestrator
> and generators are not built yet. This is **not** a thin wrapper over proven parts —
> the capture path is an unrun upstream scaffold, auto-approve is net-new, and the
> shared-env credential/provisioning path is unvalidated. A **Phase-0 validation**
> (plan Unit 0) must precede the capture units, and it needs live credentials
> (see below).

## `--only` keys

| Features | Tiers |
|---|---|
| `core`, `visual-git`, `recurring-diff`, `ai`, `approval`, `regions`, `app-percy` | `free`, `paid`, `ent_global`, `ent_team`, `ai_off` |

## Depends on upstreams (not vendored)

The testbed **shells out to** its upstream repos in place — it never copies them, so
nothing drifts:

- `percy-api-seed-accounts` — the account rake + `capture.js` / `app_capture.py`.
- `BStackAutomation-vra/percy/percy_playwright` — snapshot YAML + build helpers.

By default these are resolved as **siblings** of this repo (the `~/Desktop/percy` hub).
Override for non-default checkouts:

- `PERCY_TESTBED_SEED_ACCOUNTS_DIR`
- `PERCY_TESTBED_PERCY_PLAYWRIGHT_DIR`

See `src/upstream.ts`.

## Profiles & secrets

Each environment is a pluggable profile under `profiles/`. Copy an `*.example.js`
template to `profiles/<env>.js` and fill in **secret references only** (the names of
env vars that carry each secret) — never inline tokens/passwords/cookies. Real
`profiles/*.js` files are gitignored; only the `*.example.js` templates are tracked.

- Runs only against a **non-prod allow-list** (`local` / `staging` / `canary`);
  preprod is gated and prod is never a valid target.
- The loader always injects `PERCY_CLIENT_API_URL = <baseUrl>/api/v1` on captures
  (unset ⇒ builds silently land on prod).
- Project mutations, baseline approval, and region/AI ops require a **user-level
  principal**, not a project token; polling uses a read token. App Percy needs
  valid **prod-hub** BrowserStack creds + a pre-uploaded `BS_APP_ID`.

## Credentials needed before capture (Phase-0 onward)

The scaffold needs nothing. Unit 0 (validation) and every capture unit need Percy +
BrowserStack tokens configured in your shell (`/stack:percy-token-setup`, then restart
the shell so the exports load), plus access to the target env's renderer.

## Development

```
npm install
npm test         # node --test via tsx
npm run typecheck
npm run cli -- --profile canary --only regions   # prints what it *would* run
npm run build    # emit dist/ (bin: seed-testbed)
```

Requires Node ≥ 20.
