import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRunSummary, buildDeepLink, assertNoSecret } from './report';
import { makeProfile } from './testing/fakes';
import type { RunResult } from './orchestrator';

test('summary labels each build with requirement + feature + a token-free link', () => {
  const profile = makeProfile();
  const result: RunResult = {
    builds: [
      {
        feature: 'recurring-diff',
        requirement: 'R11',
        label: 'recurring diff build #1',
        buildId: '981',
        tier: 'paid',
        projectSlug: 'seed-paid-web',
      },
    ],
    skipped: [{ tier: 'ai_off', feature: 'ai', reason: 'not applicable on tier "ai_off"' }],
  };
  const out = formatRunSummary(result, profile);
  assert.match(out, /\[R11\] paid\/seed-paid-web — recurring diff build #1/);
  assert.match(out, /https:\/\/canary\.percy\.io\/builds\/981/);
  assert.match(out, /Skipped/);
  assert.match(out, /ai_off\/ai/);
});

test('deep links carry no tokens; assertNoSecret rejects one that does', () => {
  const profile = makeProfile();
  assert.equal(buildDeepLink(profile, '981'), 'https://canary.percy.io/builds/981');
  assert.throws(() => assertNoSecret('https://x/builds/1?token=abc'), /secret/);
});

test('the summary links to the URL Percy printed, not a synthesized 404', async () => {
  // `<base>/builds/<id>` is not a dashboard route. Every generator records buildUrl,
  // and the summary is the deliverable — dead links make it worthless to QA.
  const profile = makeProfile();
  const real = 'https://percy.io/9560f98d/web/proj-abc/builds/900';
  assert.equal(buildDeepLink(profile, '900', real), real);

  const summary = formatRunSummary(
    {
      builds: [
        { feature: 'core', requirement: 'R8', label: 'baseline', tier: 'paid', projectSlug: 'p', buildId: '900', buildUrl: real },
      ],
      skipped: [],
    } as any,
    profile,
  );
  assert.ok(summary.includes(real), 'summary carries the real build URL');
  assert.ok(!summary.includes(`${profile.baseUrl}/builds/900`), 'no synthesized 404 link');
});
