import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProjectApi } from './project-api';
import { makeProfile, recorder, okJson } from '../testing/fakes';

test('createProject POSTs JSON:API to the org projects endpoint with user auth', async () => {
  const { http, calls } = recorder([okJson({ data: { id: '42', attributes: { slug: 'seed-paid-web' } } })]);
  const out = await createProjectApi(makeProfile(), http).createProject('team-1', 'seed-paid-web');
  assert.deepEqual(out, { id: '42', slug: 'seed-paid-web' });
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].url, 'https://canary.percy.io/api/v1/organizations/team-1/projects');
  assert.equal(calls[0].headers?.authorization, 'Token token=user-tok');
  assert.equal((calls[0].body as any).data.attributes.name, 'seed-paid-web');
});

test('setAutoApprove PATCHes the project with auto_approve_branch_filter', async () => {
  const { http, calls } = recorder([okJson({})]);
  await createProjectApi(makeProfile(), http).setAutoApprove('team-1', 'seed-paid-web', 'auto/*');
  assert.equal(calls[0].method, 'PATCH');
  assert.equal(calls[0].url, 'https://canary.percy.io/api/v1/projects/team-1/seed-paid-web');
  assert.equal((calls[0].body as any).data.attributes.auto_approve_branch_filter, 'auto/*');
});

test('createProject requires a user principal (project-token-only profile rejected)', async () => {
  const { http } = recorder([okJson({})]);
  const api = createProjectApi(makeProfile({ secrets: {} }), http);
  await assert.rejects(() => api.createProject('t', 'n'), /user-level principal/);
});

test('fetchProjectToken returns the matching-role token', async () => {
  const { http } = recorder([
    okJson({
      data: [
        { attributes: { role: 'write_only', token: 'w1' } },
        { attributes: { role: 'read', token: 'r1' } },
      ],
    }),
  ]);
  assert.equal(await createProjectApi(makeProfile(), http).fetchProjectToken('42', 'read'), 'r1');
});

test('fetchProjectToken throws when the requested role is absent', async () => {
  const { http } = recorder([okJson({ data: [{ attributes: { role: 'write_only', token: 'w1' } }] })]);
  await assert.rejects(
    () => createProjectApi(makeProfile(), http).fetchProjectToken('42', 'read'),
    /No "read" token/,
  );
});
