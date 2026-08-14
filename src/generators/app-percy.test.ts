import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAppPercy } from './app-percy';
import { makeGeneratorContext, makeProfile } from '../testing/fakes';

test('app-percy: baseline + changed via app:exec with prod-hub creds + BS_APP_ID', async () => {
  const { ctx, runnerCalls } = makeGeneratorContext();
  const builds = await generateAppPercy(ctx);
  assert.equal(builds.length, 2);
  assert.ok(builds.every((b) => b.requirement === 'R15'));
  assert.equal(runnerCalls[0].command, 'percy');
  assert.deepEqual(runnerCalls[0].args.slice(0, 2), ['app:exec', '--']);
  assert.equal(runnerCalls[0].env.BUILD_VARIANT, 'baseline');
  assert.equal(runnerCalls[1].env.BUILD_VARIANT, 'changed');
  assert.equal(runnerCalls[0].env.BS_APP_ID, 'bs://app-hash');
  assert.equal(runnerCalls[0].env.PERCY_CLIENT_API_URL, 'https://canary.percy.io/api/v1');
});

test('app-percy: missing creds/binary throws (skip-with-reason at the gate)', async () => {
  const { ctx } = makeGeneratorContext();
  const stripped = { ...ctx, profile: makeProfile({ appBinaryId: undefined, secrets: { userToken: 'u' } }) };
  await assert.rejects(() => generateAppPercy(stripped), /BS_APP_ID|BrowserStack/);
});
