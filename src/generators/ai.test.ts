import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAI } from './ai';
import { makeGeneratorContext, makeFakeUpstreamPlaywright } from '../testing/fakes';

test('ai: renders the upstream test_bed pages, one build per suite', async () => {
  const percyPlaywright = makeFakeUpstreamPlaywright();
  const { ctx, runnerCalls } = makeGeneratorContext({
    profile: { upstream: { seedAccounts: '/up/seed', percyPlaywright } },
  });

  const builds = await generateAI(ctx);

  // build-summary and ai-details each yield one changed build.
  assert.equal(builds.length, 2);
  assert.ok(builds.every((b) => b.requirement === 'R12'));
  assert.ok(builds.every((b) => b.expectation), 'every build states what QA should see');

  assert.ok(runnerCalls.every((c) => c.args.includes('snapshot')));
  assert.match(String(runnerCalls[1].env.PERCY_TARGET_BRANCH), /^ai-ai-summary-master-/);
});

test('ai: a missing upstream checkout fails with an actionable message', async () => {
  const { ctx } = makeGeneratorContext(); // profile points at /up/pw, which does not exist
  await assert.rejects(generateAI(ctx), /PERCY_TESTBED_PERCY_PLAYWRIGHT_DIR/);
});
