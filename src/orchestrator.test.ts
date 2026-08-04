import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orchestrate, selectTiers, selectFeatures, TIERS, type OrchestratorDeps } from './orchestrator';
import { makeProfile, finalizingRunner, recorder, okJson, FAKE_PROJECT } from './testing/fakes';
import { createProjectApi } from './percy/project-api';
import { createBuildApi } from './percy/build-api';
import type { Runner } from './exec';

function makeDeps(overrides: Partial<OrchestratorDeps> = {}): OrchestratorDeps {
  const { runner } = finalizingRunner();
  const { http } = recorder((req) =>
    req.method === 'GET' ? okJson({ data: { attributes: { state: 'finished' } } }) : okJson({}),
  );
  const profile = makeProfile({ expectedFlags: ['recurring_diff', 'ai', 'auto_approve', 'squash_builds'] });
  return {
    profile,
    projectApi: createProjectApi(profile, http),
    buildApi: createBuildApi(profile, http),
    runner,
    nonce: 'nX',
    provisionProject: async (tier) => ({ ...FAKE_PROJECT, slug: `seed-${tier}-web` }),
    ...overrides,
  };
}

test('selectTiers/selectFeatures honor the --only filter shape', () => {
  assert.deepEqual(selectTiers('paid'), ['paid']);
  assert.equal(selectTiers('ai').length, TIERS.length); // 'ai' is a feature => all tiers
  assert.deepEqual(selectFeatures('regions').map((f) => f.key), ['regions']);
  assert.equal(selectFeatures('paid').length, 7); // 'paid' is a tier => all features
});

test('an explicit --tier wins and scopes to a single tier', () => {
  assert.deepEqual(selectTiers(undefined, 'paid'), ['paid']);
  assert.deepEqual(selectTiers('visual-git', 'free'), ['free']); // feature via --only, tier via --tier
});

test('--only <feature> + --tier runs that one feature in one project', async () => {
  const res = await orchestrate({ profile: 'canary', only: 'visual-git', tier: 'paid' }, makeDeps());
  assert.ok(res.builds.length > 0);
  assert.ok(res.builds.every((b) => b.tier === 'paid' && b.feature === 'visual-git'));
});

test('--only core runs core across every tier', async () => {
  const res = await orchestrate({ profile: 'canary', only: 'core' }, makeDeps());
  assert.equal(res.builds.length, TIERS.length * 2); // 2 builds per tier
  assert.ok(res.builds.every((b) => b.feature === 'core'));
});

test('--only paid runs all features on just the paid tier', async () => {
  const res = await orchestrate({ profile: 'canary', only: 'paid' }, makeDeps());
  assert.ok(res.builds.length > 0);
  assert.ok(res.builds.every((b) => b.tier === 'paid'));
  assert.ok(res.builds.some((b) => b.feature === 'ai'));
});

test('AI is skipped on the ai_off tier', async () => {
  const res = await orchestrate({ profile: 'canary', only: 'ai' }, makeDeps());
  assert.ok(res.skipped.some((s) => s.tier === 'ai_off' && s.feature === 'ai'));
  assert.ok(res.builds.every((b) => b.tier !== 'ai_off'));
});

test('a feature error is isolated: skipped, pass continues', async () => {
  const failingRunner: Runner = async (_c, args) => {
    if (args.includes('app:exec')) throw new Error('app runner boom');
    return { stdout: 'Finalized build #1: https://x/builds/1', stderr: '', code: 0 };
  };
  const res = await orchestrate({ profile: 'canary', only: 'app-percy' }, makeDeps({ runner: failingRunner }));
  assert.equal(res.builds.length, 0);
  assert.ok(res.skipped.length > 0);
  assert.ok(res.skipped.every((s) => s.feature === 'app-percy'));
});

test('provisioning failure skips the whole tier', async () => {
  const res = await orchestrate(
    { profile: 'canary', only: 'core' },
    makeDeps({
      provisionProject: async () => {
        throw new Error('no account on env');
      },
    }),
  );
  assert.equal(res.builds.length, 0);
  assert.ok(res.skipped.some((s) => /provisioning failed/.test(s.reason)));
});
