import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAI } from './ai';
import { makeGeneratorContext, makeFakeUpstreamPlaywright } from '../testing/fakes';

test('ai: covers all three R12 capabilities, one build per suite', async () => {
  const percyPlaywright = makeFakeUpstreamPlaywright();
  const { ctx, runnerCalls } = makeGeneratorContext({
    profile: { upstream: { seedAccounts: '/up/seed', percyPlaywright } },
  });

  const builds = await generateAI(ctx);

  // bug-classification (in-repo fixtures) + build-summary + ai-details.
  assert.equal(builds.length, 3);
  assert.ok(
    builds.some((b) => /bug classification/i.test(b.label)),
    'all three R12 capabilities are covered',
  );
  assert.ok(builds.every((b) => b.requirement === 'R12'));
  assert.ok(builds.every((b) => b.expectation), 'every build states what QA should see');

  assert.ok(runnerCalls.every((c) => c.args.includes('snapshot')));

  // Each suite gets its own baseline, and its head build targets that baseline —
  // asserted by pairing rather than by call index, so adding a suite can't break it.
  const heads = runnerCalls.filter((c) => c.env.PERCY_TARGET_BRANCH);
  const baselines = runnerCalls.filter((c) => !c.env.PERCY_TARGET_BRANCH).map((c) => c.env.PERCY_BRANCH);
  assert.equal(heads.length, 3);
  for (const h of heads) {
    assert.ok(
      baselines.includes(h.env.PERCY_TARGET_BRANCH),
      `${h.env.PERCY_BRANCH} targets a baseline this run created`,
    );
  }
});

test('ai: a missing upstream checkout fails with an actionable message', async () => {
  const { ctx } = makeGeneratorContext(); // profile points at /up/pw, which does not exist
  await assert.rejects(generateAI(ctx), /PERCY_TESTBED_PERCY_PLAYWRIGHT_DIR/);
});
