import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCoreStates } from './web-core';
import { makeGeneratorContext } from '../testing/fakes';

test('core states: approved baseline then changed via percy snapshot (client-api-url + nonce)', async () => {
  const { ctx, runnerCalls } = makeGeneratorContext({ nonce: 'n123' });
  const builds = await generateCoreStates(ctx);

  assert.equal(builds.length, 2);
  assert.ok(builds.every((b) => b.requirement === 'R8'));
  assert.ok(builds.every((b) => b.expectation), 'every build states what QA should see');

  // Both captures render real DOM via `percy snapshot`, inject PERCY_CLIENT_API_URL,
  // and nonce the branch.
  for (const c of runnerCalls) {
    assert.ok(c.args.includes('snapshot'), 'uses percy snapshot, not upload');
    assert.equal(c.env.PERCY_CLIENT_API_URL, 'https://canary.percy.io/api/v1');
    assert.match(String(c.env.PERCY_BRANCH), /-n123$/);
  }
  // The changed build targets the baseline branch.
  assert.match(String(runnerCalls[1].env.PERCY_TARGET_BRANCH), /^master-n123$/);
});
