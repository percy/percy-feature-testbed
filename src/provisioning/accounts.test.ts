import { test } from 'node:test';
import assert from 'node:assert/strict';
import { provisionProject, runLocalSeedRake } from './accounts';
import { createProjectApi } from '../percy/project-api';
import { makeProfile, recorder, okJson } from '../testing/fakes';
import type { Runner } from '../exec';

test('provisionProject creates a project then fetches write + read tokens', async () => {
  const { http, calls } = recorder((req) => {
    if (req.method === 'POST') return okJson({ data: { id: '7', attributes: { slug: 'org9/seed-web' } } });
    return okJson({
      data: [
        { attributes: { role: 'write_only', token: 'w' } },
        { attributes: { role: 'read_only', token: 'r' } },
      ],
    });
  });
  const sp = await provisionProject(createProjectApi(makeProfile(), http), 'seed-web');
  assert.equal(sp.id, '7');
  assert.equal(sp.slug, 'org9/seed-web');
  assert.equal(sp.writeToken, 'w');
  assert.equal(sp.readToken, 'r');
  assert.equal(sp.teamId, 'org9'); // derived from the full-slug prefix
  assert.equal(calls[0].method, 'POST'); // create first
  assert.equal(calls[0].url, 'https://canary.percy.io/api/v1/projects');
});

test('provisionProject rejects a reserved project name before creating', async () => {
  const { http } = recorder([okJson({})]);
  await assert.rejects(
    () => provisionProject(createProjectApi(makeProfile(), http), 'canary-seed'),
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
