/**
 * Shared generator context + the web build helper.
 *
 * Build path = `percy snapshot <static-dir>` — the Percy CLI serves the generated
 * fixture pages and renders them in a real browser, so builds carry actual DOM.
 * That is what makes AI review, region rules and IntelliIgnore meaningful; the old
 * solid-colour `percy upload` path could only prove the plumbing.
 *
 * Always injects PERCY_CLIENT_API_URL so builds land on the target env (never
 * prod-by-default). The per-run nonce on branches defeats auto-approve carry-forward
 * so re-runs still diff.
 */
import { mkdtempSync, writeFileSync, existsSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ResolvedProfile } from '../profile/schema';
import type { Runner } from '../exec';
import { parseFinalizedBuild } from '../exec';
import type { ProjectApi } from '../percy/project-api';
import type { BuildApi } from '../percy/build-api';
import { writeFixtureSet, TALL, HOME, type FixtureKind } from '../fixtures/sets';
import { buildPercyConfig, buildMatrixConfig, type RegionRule } from '../fixtures/rules';

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
  /**
   * What QA should SEE in this build for the feature to count as working. Rich DOM
   * makes builds complex enough that "looks fine" stops being a judgement anyone can
   * make unaided — the expectation is what turns a link into a check.
   */
  expectation?: string;
  buildId?: string;
  buildUrl?: string;
}

/** Append the run nonce to a branch so re-runs are distinct identities. */
export function noncedBranch(branch: string, nonce: string): string {
  return `${branch}-${nonce}`;
}

export interface WebCaptureOpts {
  /** which fixture set to render (drives the review state) */
  diffMode?: FixtureKind;
  branch: string;
  targetBranch?: string;
  skipCache?: boolean;
  /** region rules applied to the storefront page for this capture */
  rules?: RegionRule[];
  /**
   * Render HTML from an existing directory instead of the generated fixtures.
   * Used for the AI suite, which reuses the curated upstream `test_bed/ai` pages
   * in place rather than duplicating them here.
   */
  sourceDir?: string;
}

/**
 * Create a real web build by rendering the fixture pages with `percy snapshot`.
 * Returns the finalized build id/url; throws if none was finalized.
 */
export async function captureWeb(
  ctx: GeneratorContext,
  opts: WebCaptureOpts,
): Promise<{ id: string; url?: string }> {
  const { profile, project, runner, nonce } = ctx;
  const dir = mkdtempSync(join(tmpdir(), 'percy-testbed-'));
  const kind = opts.diffMode ?? 'baseline';

  if (opts.sourceDir) {
    if (!existsSync(opts.sourceDir)) {
      throw new Error(
        `fixture source directory not found: ${opts.sourceDir}. ` +
          'Set PERCY_TESTBED_PERCY_PLAYWRIGHT_DIR if the upstream checkout is not a sibling of this repo.',
      );
    }
    cpSync(opts.sourceDir, dir, { recursive: true });
  } else {
    writeFixtureSet(dir, kind, nonce);
  }

  const configPath = join(dir, 'percy.config.json');
  const isMatrix = kind === 'matrix' || kind === 'matrix-changed';
  const zonePage = kind === 'tall' || kind === 'tall-changed' ? TALL : HOME;
  // The matrix needs a different rule per page, which the single-page helper cannot express.
  const config = isMatrix ? buildMatrixConfig() : buildPercyConfig(opts.rules ?? [], zonePage);
  writeFileSync(configPath, JSON.stringify(config, null, 2));

  const env: NodeJS.ProcessEnv = {
    PERCY_TOKEN: project.writeToken,
    PERCY_BRANCH: opts.branch,
    PERCY_CLIENT_API_URL: profile.clientApiUrl, // unset => builds land on prod
  };
  if (opts.targetBranch) env.PERCY_TARGET_BRANCH = opts.targetBranch;
  if (opts.skipCache) env.PERCY_SKIP_BUILD_CACHE = '1';
  if (profile.disableTls) env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // local dev cert only

  const result = await runner(
    'npx',
    ['-y', '@percy/cli', 'snapshot', dir, '--config', configPath],
    { env, timeoutMs: 300_000 },
  );
  const logs = `${result.stdout}\n${result.stderr}`;
  const parsed = parseFinalizedBuild(logs);
  if (!parsed?.id) {
    throw new Error(
      `percy snapshot did not finalize a build (branch=${opts.branch}). Last logs: ${logs.slice(-400)}`,
    );
  }
  return { id: parsed.id, url: parsed.url };
}
