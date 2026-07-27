/**
 * Shared generator context + the web-capture shell-out helper.
 *
 * A generator produces one or more real builds for a feature. It shells out to the
 * upstream capture in place (no vendoring) and always injects PERCY_CLIENT_API_URL
 * so builds land on the target env, never prod.
 */
import type { ResolvedProfile } from '../profile/schema';
import type { Runner } from '../exec';
import { parseFinalizedBuild } from '../exec';
import type { ProjectApi } from '../percy/project-api';
import type { BuildApi } from '../percy/build-api';

export interface SeededProject {
  id: string;
  slug: string;
  teamId: string;
  writeToken: string;
  readToken: string;
}

export interface GeneratorContext {
  profile: ResolvedProfile;
  project: SeededProject;
  projectApi: ProjectApi;
  buildApi: BuildApi;
  runner: Runner;
  /** per-run nonce — applied to branch/snapshot identities to defeat auto-approve carry-forward */
  nonce: string;
}

export interface GeneratedBuild {
  feature: string; // e.g. 'core', 'recurring-diff'
  requirement: string; // e.g. 'R8'
  label: string; // human label for the run summary
  buildId?: string;
  buildUrl?: string;
}

/** Append the run nonce to a branch so re-runs are distinct identities. */
export function noncedBranch(branch: string, nonce: string): string {
  return `${branch}-${nonce}`;
}

export interface WebCaptureOpts {
  /** capture.js inline-HTML path (hardcoded snapshot names — no nonce possible) */
  diffMode?: string;
  /** captureWebPercySnapshots YAML path (nonce-compatible via upstream nonce-yml) */
  snapshotFile?: string;
  branch: string;
  targetBranch?: string;
  skipCache?: boolean;
}

/**
 * Shell out to the upstream web capture and return the finalized build id.
 * Throws if the CLI did not finalize a build.
 */
export async function captureWeb(
  ctx: GeneratorContext,
  opts: WebCaptureOpts,
): Promise<{ id: string; url?: string }> {
  const { profile, project, runner } = ctx;
  const env: NodeJS.ProcessEnv = {
    PERCY_TOKEN: project.writeToken,
    PERCY_BRANCH: opts.branch,
    PERCY_CLIENT_API_URL: profile.clientApiUrl, // always set — unset => builds land on prod
  };
  if (opts.targetBranch) env.PERCY_TARGET_BRANCH = opts.targetBranch;
  if (opts.skipCache) env.PERCY_SKIP_BUILD_CACHE = '1';
  if (profile.disableTls) env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // local dev cert only

  let args: string[];
  if (opts.snapshotFile) {
    args = ['percy', 'snapshot', opts.snapshotFile];
  } else {
    env.DIFF_MODE = opts.diffMode ?? 'baseline';
    args = ['percy', 'exec', '--', 'node', `${profile.upstream.seedAccounts}/scripts/seed-accounts/capture.js`];
  }

  const result = await runner('npx', args, { env, timeoutMs: 480_000 });
  const logs = `${result.stdout}\n${result.stderr}`;
  const parsed = parseFinalizedBuild(logs);
  // The CLI prints "Finalized build" as success even on a non-zero exit (proxy quirks).
  if (!parsed?.id) {
    throw new Error(
      `web capture did not finalize a build (branch=${opts.branch}). Last logs: ${logs.slice(-400)}`,
    );
  }
  return { id: parsed.id, url: parsed.url };
}
