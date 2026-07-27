import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSupersede, generateAutoApprove, generateAutoFinalization } from './approval';
import { makeGeneratorContext } from '../testing/fakes';

test('auto-finalization: a single finished build (R13)', async () => {
  const { ctx } = makeGeneratorContext();
  const builds = await generateAutoFinalization(ctx);
  assert.equal(builds.length, 1);
  assert.equal(builds[0].requirement, 'R13');
});

test('supersede: two builds on the SAME branch with skipCache', async () => {
  const { ctx, runnerCalls } = makeGeneratorContext();
  const builds = await generateSupersede(ctx);
  assert.equal(builds.length, 1);
  assert.equal(runnerCalls[0].env.PERCY_BRANCH, runnerCalls[1].env.PERCY_BRANCH);
  assert.equal(runnerCalls[0].env.PERCY_SKIP_BUILD_CACHE, '1');
  assert.equal(runnerCalls[1].env.PERCY_SKIP_BUILD_CACHE, '1');
});

test('auto-approve: sets the branch rule (PATCH) then builds matching + control', async () => {
  const { ctx, runnerCalls, httpCalls } = makeGeneratorContext({ reviewState: 'auto_approved' });
  const builds = await generateAutoApprove(ctx);
  assert.equal(builds.length, 2);

  // The branch rule was PATCHed with auto_approve_branch_filter (user principal).
  const patch = httpCalls.find((c) => c.method === 'PATCH');
  assert.ok(patch, 'expected an editProject PATCH');
  assert.equal((patch!.body as any).data.attributes.auto_approve_branch_filter, 'auto-approved/*');

  // Matching branch matches the rule prefix; control does not.
  assert.match(String(runnerCalls[0].env.PERCY_BRANCH), /^auto-approved\/x-/);
  assert.match(String(runnerCalls[1].env.PERCY_BRANCH), /^not-matching-/);
});
