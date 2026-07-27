/**
 * Upstream-asset locator (plan Unit 1 — "how the repo references upstreams").
 *
 * The testbed DEPENDS ON its upstream repos but does not vendor them: it shells
 * out to their scripts in place (`capture.js`, `app_capture.py`, the seed rake)
 * and reuses their snapshot YAML. There are no copies, so nothing can drift.
 *
 * Default layout assumes the upstreams are siblings of this repo under the same
 * parent directory (the `~/Desktop/percy` hub). Any path can be overridden via
 * an environment variable for non-default checkouts.
 */
import path from 'node:path';

export interface UpstreamPaths {
  /** `percy-api-seed-accounts` — the account rake + capture.js / app_capture.py. */
  seedAccounts: string;
  /** `BStackAutomation-vra/percy/percy_playwright` — snapshot YAML + build helpers. */
  percyPlaywright: string;
}

export const UPSTREAM_ENV_OVERRIDES = {
  seedAccounts: 'PERCY_TESTBED_SEED_ACCOUNTS_DIR',
  percyPlaywright: 'PERCY_TESTBED_PERCY_PLAYWRIGHT_DIR',
} as const;

/**
 * Resolve the upstream repo paths. `repoRoot` is this repo's root directory;
 * defaults are computed as siblings of it. Env overrides win when set.
 */
export function resolveUpstreamPaths(
  repoRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): UpstreamPaths {
  const hub = path.resolve(repoRoot, '..');
  return {
    seedAccounts:
      env[UPSTREAM_ENV_OVERRIDES.seedAccounts] ??
      path.join(hub, 'percy-api-seed-accounts'),
    percyPlaywright:
      env[UPSTREAM_ENV_OVERRIDES.percyPlaywright] ??
      path.join(hub, 'BStackAutomation-vra', 'percy', 'percy_playwright'),
  };
}
