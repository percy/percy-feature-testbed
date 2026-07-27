/**
 * seed-testbed CLI — argument parsing and routing (plan Unit 1, requirement R1).
 *
 * This module is intentionally pure (no top-level side effects) so it is safe to
 * import from tests. The executable entry point lives in `main.ts`.
 *
 * The full one-pass orchestrator arrives in Unit 9; until then `run()` calls a
 * stub dispatch so the wiring is observable without touching any environment.
 */

import { parseArgs } from 'node:util';

/** Raised for any user-facing usage problem (bad/missing flags). */
export class UsageError extends Error {}

/**
 * Valid `--only <feature>` keys — one per generator in the plan (R8–R15).
 * `approval` covers auto-approve + auto/manual finalization + supersede (R13).
 */
export const FEATURE_KEYS = [
  'core', // R8  — new/unchanged/changed/removed review states
  'visual-git', // R9/R10 — target-branch baseline + A/B variant comparison
  'recurring-diff', // R11
  'ai', // R12 — AI diff / bug-classification / build summary
  'approval', // R13 — auto-approve + finalization + supersede
  'regions', // R14
  'app-percy', // R15 — App Percy (mobile)
] as const;

/** Valid `--only <tier>` keys — the existing account matrix. */
export const TIER_KEYS = ['free', 'paid', 'ent_global', 'ent_team', 'ai_off'] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type TierKey = (typeof TIER_KEYS)[number];
export type OnlyKey = FeatureKey | TierKey;

export interface CliConfig {
  /** Target environment profile name (validated against the allow-list in Unit 2). */
  profile: string;
  /** Optional coarse filter: run a single feature or a single tier. */
  only?: OnlyKey;
}

export function usage(): string {
  return 'Usage: seed-testbed --profile <local|staging|canary> [--only <feature|tier>]';
}

function isKnownOnly(value: string): value is OnlyKey {
  return (
    (FEATURE_KEYS as readonly string[]).includes(value) ||
    (TIER_KEYS as readonly string[]).includes(value)
  );
}

/**
 * Parse argv (without the leading `node script` entries) into a CliConfig.
 * Throws UsageError on unknown flags, a missing `--profile`, or an unknown
 * `--only` value. Does NOT validate the profile against the environment
 * allow-list — that belongs to the profile loader (Unit 2).
 */
export function parseCliArgs(argv: string[]): CliConfig {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        profile: { type: 'string' },
        only: { type: 'string' },
      },
      allowPositionals: false,
      strict: true,
    });
  } catch (err) {
    throw new UsageError((err as Error).message);
  }

  const { profile, only } = parsed.values;

  if (!profile) {
    throw new UsageError('Missing required --profile <env>.');
  }
  if (only !== undefined && !isKnownOnly(only)) {
    throw new UsageError(
      `Unknown --only "${only}". ` +
        `Valid features: ${FEATURE_KEYS.join(', ')}. ` +
        `Valid tiers: ${TIER_KEYS.join(', ')}.`,
    );
  }

  return { profile, only: only as OnlyKey | undefined };
}

/** A run dispatcher — injected so the CLI is testable without a real pass. */
export type Dispatch = (config: CliConfig) => Promise<void> | void;

/**
 * Placeholder dispatch. Unit 9 replaces this with the real one-pass
 * orchestrator. It only reports what *would* run so routing is observable.
 */
export const stubDispatch: Dispatch = (config) => {
  const scope = config.only ? `only="${config.only}"` : 'full pass';
  console.log(
    `[seed-testbed] resolved profile="${config.profile}" (${scope}). ` +
      'Orchestrator not yet implemented (plan Unit 9) — no builds created.',
  );
};

/**
 * Parse argv and route to the dispatcher. Returns the resolved config (handy
 * for tests). The default dispatch is the no-op stub above.
 */
export async function run(
  argv: string[],
  deps: { dispatch?: Dispatch } = {},
): Promise<CliConfig> {
  const config = parseCliArgs(argv);
  await (deps.dispatch ?? stubDispatch)(config);
  return config;
}
