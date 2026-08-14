/**
 * Feature-labeled run summary (plan Unit 10, R5). Prints each created build with the
 * requirement/feature it demonstrates + a token-free dashboard deep-link, plus a
 * "skipped" section. Deep-links must never embed secrets (guarded).
 */
import type { ResolvedProfile } from './profile/schema';
import type { RunResult } from './orchestrator';

/**
 * Deep-link to a build.
 *
 * Prefer the URL Percy itself printed (`<base>/<org>/web/<project>/builds/<id>`);
 * the synthesized `<base>/builds/<id>` fallback is NOT a real dashboard route and
 * 404s. Every generator records `buildUrl`, so the fallback is only for builds that
 * somehow lack one — the run summary is the deliverable, and dead links make it
 * worthless to QA.
 */
export function buildDeepLink(
  profile: ResolvedProfile,
  buildId?: string,
  buildUrl?: string,
): string {
  if (buildUrl) return buildUrl;
  return buildId ? `${profile.baseUrl}/builds/${buildId}` : '(no build id)';
}

const SECRET_HINT = /token=|access[_-]?key|password|_percy_session|x-csrf/i;

export function assertNoSecret(link: string): void {
  if (SECRET_HINT.test(link)) {
    throw new Error(`refusing to emit a link that may contain a secret: ${link.slice(0, 40)}…`);
  }
}

export function formatRunSummary(result: RunResult, profile: ResolvedProfile): string {
  const lines: string[] = [];
  lines.push(`Percy Feature Testbed — run summary (env: ${profile.env})`);
  lines.push(`Created ${result.builds.length} build(s); skipped ${result.skipped.length}.`);
  lines.push('');

  if (result.builds.length) {
    lines.push('Builds (open each to verify its feature):');
    for (const b of result.builds) {
      const link = buildDeepLink(profile, b.buildId, b.buildUrl);
      assertNoSecret(link);
      lines.push(`  [${b.requirement}] ${b.tier}/${b.projectSlug} — ${b.label}  ->  ${link}`);
      // The expectation is what makes a rich-DOM build checkable rather than just
      // something to look at — without it "no diffs" is indistinguishable from a no-op.
      if (b.expectation) lines.push(`      expect: ${b.expectation}`);
    }
  }

  if (result.skipped.length) {
    lines.push('');
    lines.push('Skipped (precondition unmet / not applicable / error):');
    for (const s of result.skipped) {
      lines.push(`  ${s.tier}/${s.feature} — ${s.reason}`);
    }
  }

  return lines.join('\n');
}
