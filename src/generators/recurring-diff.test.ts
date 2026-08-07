import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRecurringDiff } from './recurring-diff';
import { makeGeneratorContext } from '../testing/fakes';

test('recurring diff: two consecutive changed builds against the master baseline', async () => {
  const { ctx, runnerCalls } = makeGeneratorContext();
  const builds = await generateRecurringDiff(ctx);
  assert.equal(builds.length, 2);
  assert.ok(builds.every((b) => b.requirement === 'R11'));
  assert.ok(runnerCalls.every((c) => c.args.includes('snapshot')));
  // baseline (call 0) + 2 diffs (1,2); diffs target master
  assert.match(String(runnerCalls[1].env.PERCY_TARGET_BRANCH), /^master-/);
});
