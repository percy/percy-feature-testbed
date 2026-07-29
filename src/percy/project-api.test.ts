import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProjectApi } from './project-api';
import { makeProfile, recorder, okJson } from '../testing/fakes';

test('createProject POSTs /projects with Basic auth (BrowserStack user:key)', async () => {
  const { http, calls } = recorder([okJson({ data: { id: '42', attributes: { slug: 'org/seed-web' } } })]);
  const out = await createProjectApi(makeProfile(), http).createProject('seed-web', 'web');
  assert.deepEqual(out, { id: '42', slug: 'org/seed-web' });
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].url, 'https://canary.percy.io/api/v1/projects');
  assert.match(calls[0].headers?.authorization ?? '', /^Basic /);
  assert.equal((calls[0].body as any).data.attributes.name, 'seed-web');
  assert.equal((calls[0].body as any).data.attributes.type, 'web');
});

test('createProject requires BrowserStack Basic-auth creds', async () => {
  const { http } = recorder([okJson({})]);
  const api = createProjectApi(makeProfile({ secrets: { userToken: 'u' } }), http);
  await assert.rejects(() => api.createProject('x'), /Basic-auth creds/);
});

test('setAutoApprove PATCHes /projects/{slug} with the branch filter (Basic auth)', async () => {
  const { http, calls } = recorder([okJson({})]);
  await createProjectApi(makeProfile(), http).setAutoApprove('org/seed-web', 'auto/*');
  assert.equal(calls[0].method, 'PATCH');
  assert.equal(calls[0].url, 'https://canary.percy.io/api/v1/projects/org/seed-web');
  assert.match(calls[0].headers?.authorization ?? '', /^Basic /);
  assert.equal((calls[0].body as any).data.attributes.auto_approve_branch_filter, 'auto/*');
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

test('fetchProjectToken throws (with UI hint) when the role is absent', async () => {
  const { http } = recorder([okJson({ data: [{ attributes: { role: 'write_only', token: 'w1' } }] })]);
  await assert.rejects(
    () => createProjectApi(makeProfile(), http).fetchProjectToken('42', 'read'),
    /No "read" token/,
  );
});
