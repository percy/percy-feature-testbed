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
