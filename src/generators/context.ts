/**
 * Shared generator context + the web build helper.
 *
 * Build path = `percy upload` of static images (no browser) — the flow proven live
 * against percy.io. Always injects PERCY_CLIENT_API_URL so builds land on the target
 * env (never prod-by-default). The per-run nonce on branches defeats auto-approve
 * carry-forward so re-runs still diff.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ResolvedProfile } from '../profile/schema';
import type { Runner } from '../exec';
import { parseFinalizedBuild } from '../exec';
import type { ProjectApi } from '../percy/project-api';
import type { BuildApi } from '../percy/build-api';
import { writeSnapshotImages, type Variant } from '../images';

export interface SeededProject {
  id: string;
  slug: string;
  /** org/team id when derivable from the full-slug (e.g. "orgid/proj") — optional */
  teamId?: string;
  writeToken: string;
  readToken: string;
}

export interface GeneratorContext {
  profile: ResolvedProfile;
  project: SeededProject;
  projectApi: ProjectApi;
  buildApi: BuildApi;
  runner: Runner;
  /** per-run nonce — applied to branches to defeat auto-approve carry-forward */
  nonce: string;
}

export interface GeneratedBuild {
  feature: string;
  requirement: string;
  label: string;
  buildId?: string;
  buildUrl?: string;
}

/** Append the run nonce to a branch so re-runs are distinct identities. */
export function noncedBranch(branch: string, nonce: string): string {
  return `${branch}-${nonce}`;
}

export interface WebCaptureOpts {
  /** which snapshot set to upload (drives the review state) */
  diffMode?: Variant;
  branch: string;
  targetBranch?: string;
  skipCache?: boolean;
}

/**
 * Create a real web build by uploading a static image set via `percy upload`
 * (no browser). Returns the finalized build id/url; throws if none was finalized.
 */
export async function captureWeb(
  ctx: GeneratorContext,
  opts: WebCaptureOpts,
): Promise<{ id: string; url?: string }> {
  const { profile, project, runner } = ctx;
  const dir = mkdtempSync(join(tmpdir(), 'percy-testbed-'));
  writeSnapshotImages(dir, opts.diffMode ?? 'baseline');

  const env: NodeJS.ProcessEnv = {
    PERCY_TOKEN: project.writeToken,
    PERCY_BRANCH: opts.branch,
    PERCY_CLIENT_API_URL: profile.clientApiUrl, // unset => builds land on prod
  };
  if (opts.targetBranch) env.PERCY_TARGET_BRANCH = opts.targetBranch;
  if (opts.skipCache) env.PERCY_SKIP_BUILD_CACHE = '1';
  if (profile.disableTls) env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // local dev cert only

  const result = await runner('npx', ['-y', '@percy/cli', 'upload', dir], { env, timeoutMs: 300_000 });
  const logs = `${result.stdout}\n${result.stderr}`;
  const parsed = parseFinalizedBuild(logs);
  if (!parsed?.id) {
    throw new Error(`percy upload did not finalize a build (branch=${opts.branch}). Last logs: ${logs.slice(-400)}`);
  }
  return { id: parsed.id, url: parsed.url };
}
