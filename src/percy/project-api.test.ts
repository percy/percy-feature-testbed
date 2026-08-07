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
  assert.equal((calls[0].body as any).data.attributes['auto-approve-branch-filter'], 'auto/*');
});

test('fetchProjectToken returns the matching-role token (read_only)', async () => {
  const { http } = recorder([
    okJson({
      data: [
        { attributes: { role: 'write_only', token: 'w1' } },
        { attributes: { role: 'read_only', token: 'r1' } },
      ],
    }),
  ]);
  assert.equal(await createProjectApi(makeProfile(), http).fetchProjectToken('42', 'read_only'), 'r1');
});

test('fetchProjectToken throws (with UI hint) when the role is absent', async () => {
  const { http } = recorder([okJson({ data: [{ attributes: { role: 'write_only', token: 'w1' } }] })]);
  await assert.rejects(
    () => createProjectApi(makeProfile(), http).fetchProjectToken('42', 'read_only'),
    /No "read_only" token/,
  );
});

test('editProject fails loudly when a 200 did not actually apply the setting', async () => {
  // Percy answers 200 for unknown attribute keys and ignores them. Without this
  // read-back the caller sees success while the setting stays false — which is how a
  // broken settings write survived a full live run.
  const { http } = recorder([
    okJson({ data: { attributes: { 'ignore-carousels-enabled': false } } }),
  ]);
  await assert.rejects(
    () => createProjectApi(makeProfile(), http).editProject('o/p', { 'ignore-carousels-enabled': true }),
    /did not apply/,
  );
});

test('editProject passes when the setting is reflected back', async () => {
  const { http } = recorder([
    okJson({ data: { attributes: { 'ignore-carousels-enabled': true } } }),
  ]);
  await createProjectApi(makeProfile(), http).editProject('o/p', { 'ignore-carousels-enabled': true });
});
