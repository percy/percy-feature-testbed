import { test } from 'node:test';
import assert from 'node:assert/strict';
import { provisionProject, runLocalSeedRake } from './accounts';
import { createProjectApi } from '../percy/project-api';
import { makeProfile, recorder, okJson } from '../testing/fakes';
import type { Runner } from '../exec';

test('provisionProject creates a project and fetches write + read tokens', async () => {
  const { http, calls } = recorder((req) => {
    if (req.method === 'POST') return okJson({ data: { id: '7', attributes: { slug: 'seed-paid-web' } } });
    return okJson({
      data: [
        { attributes: { role: 'write_only', token: 'w' } },
        { attributes: { role: 'read', token: 'r' } },
      ],
    });
  });
  const sp = await provisionProject(createProjectApi(makeProfile(), http), 'team-1', 'seed-paid-web');
  assert.deepEqual(sp, { id: '7', slug: 'seed-paid-web', teamId: 'team-1', writeToken: 'w', readToken: 'r' });
  assert.equal(calls[0].method, 'POST');
});

test('provisionProject rejects a reserved project name', async () => {
  const { http } = recorder([okJson({})]);
  await assert.rejects(
    () => provisionProject(createProjectApi(makeProfile(), http), 'team-1', 'canary-seed'),
    /reserved/,
  );
});

test('runLocalSeedRake shells the dev-only rake with the tier arg', async () => {
  let seen: string[] = [];
  const runner: Runner = async (_c, args) => {
    seen = args;
    return { stdout: '', stderr: '', code: 0 };
  };
  await runLocalSeedRake(runner, 'paid');
  assert.ok(seen.join(' ').includes('dev:seed_test_accounts[paid]'));
});
