import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRecurringDiff } from './recurring-diff';
import { makeGeneratorContext } from '../testing/fakes';

test('recurring diff: two consecutive diff builds against the master baseline', async () => {
  const { ctx, runnerCalls } = makeGeneratorContext();
  const builds = await generateRecurringDiff(ctx);
  assert.equal(builds.length, 2);
  assert.ok(builds.every((b) => b.requirement === 'R11'));
  // baseline (call 0) + 2 diffs (calls 1,2); each diff targets master and uses the YAML.
  assert.match(String(runnerCalls[1].env.PERCY_TARGET_BRANCH), /^master-/);
  assert.ok(runnerCalls[1].args.join(' ').includes('recurring_diff_snapshot.yml'));
});
