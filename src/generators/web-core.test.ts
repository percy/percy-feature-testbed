import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCoreStates } from './web-core';
import type { GeneratorContext, SeededProject } from './context';
import { createBuildApi } from '../percy/build-api';
import { createProjectApi } from '../percy/project-api';
import { makeProfile, recorder, okJson } from '../testing/fakes';
import type { ExecResult, Runner } from '../exec';

const PROJECT: SeededProject = {
  id: 'p1',
  slug: 'seed-paid-web',
  teamId: 'team-1',
  writeToken: 'write-tok',
  readToken: 'read-tok',
};

/** Runner that finalizes a distinct build id per invocation and records the calls. */
function finalizingRunner(): { runner: Runner; calls: Array<{ args: string[]; env: NodeJS.ProcessEnv }> } {
  const calls: Array<{ args: string[]; env: NodeJS.ProcessEnv }> = [];
  let n = 900;
  const runner: Runner = async (_cmd, args, opts) => {
    calls.push({ args, env: opts?.env ?? {} });
    const id = ++n;
    const res: ExecResult = {
      stdout: `Finalized build #${id}: https://canary.percy.io/o/p/builds/${id}`,
      stderr: '',
      code: 0,
    };
    return res;
  };
  return { runner, calls };
}

test('core states: approved baseline then changed, in order, with client-api-url + nonce', async () => {
  const { runner, calls } = finalizingRunner();
  // Build API: every GET build => finished; review POST => ok.
  const { http } = recorder((req) => {
    if (req.method === 'GET') return okJson({ data: { attributes: { state: 'finished' } } });
    return okJson({});
  });
  const profile = makeProfile();
  const ctx: GeneratorContext = {
    profile,
    project: PROJECT,
    projectApi: createProjectApi(profile, http),
    buildApi: createBuildApi(profile, http),
    runner,
    nonce: 'n123',
  };

  const builds = await generateCoreStates(ctx);

  // Two builds produced, labeled with R8.
  assert.equal(builds.length, 2);
  assert.equal(builds[0].requirement, 'R8');
  assert.equal(builds[0].buildId, '901');
  assert.equal(builds[1].buildId, '902');

  // Both captures injected PERCY_CLIENT_API_URL and nonced the branch.
  for (const c of calls) {
    assert.equal(c.env.PERCY_CLIENT_API_URL, 'https://canary.percy.io/api/v1');
    assert.match(String(c.env.PERCY_BRANCH), /-n123$/);
  }
  // Baseline used DIFF_MODE=baseline; changed used DIFF_MODE=changed + target branch.
  assert.equal(calls[0].env.DIFF_MODE, 'baseline');
  assert.equal(calls[1].env.DIFF_MODE, 'changed');
  assert.match(String(calls[1].env.PERCY_TARGET_BRANCH), /^master-n123$/);
});
