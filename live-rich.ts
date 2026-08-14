const REPO = '/Users/akashsinha/Desktop/percy/percy-feature-testbed';
const { spawnRunner } = await import(`${REPO}/src/exec.ts`);
const { createProjectApi } = await import(`${REPO}/src/percy/project-api.ts`);
const { createBuildApi } = await import(`${REPO}/src/percy/build-api.ts`);
const { generateMatrix, enableIntelliIgnore } = await import(`${REPO}/src/generators/intelli-ignore.ts`);

const API = 'https://percy.io/api/v1';
const U = process.env.BROWSERSTACK_USERNAME;
const K = process.env.BROWSERSTACK_ACCESS_KEY;
const basic = 'Basic ' + Buffer.from(`${U}:${K}`).toString('base64');
const nonce = process.argv[2] || 'mtx';

const profile: any = {
  env: 'prod', baseUrl: 'https://percy.io', clientApiUrl: API, disableTls: false,
  secrets: { browserstackUser: U, browserstackKey: K }, runLocalApp: false, expectedFlags: [],
  upstream: { seedAccounts: '', percyPlaywright: '' }, nonceSeed: nonce,
};
async function api(m: string, p: string, b?: unknown) {
  const res = await fetch(`${API}${p}`, { method: m,
    headers: { authorization: basic, ...(b ? { 'content-type': 'application/vnd.api+json' } : {}) },
    ...(b ? { body: JSON.stringify(b) } : {}) });
  const t = await res.text(); let j: any = null; try { j = JSON.parse(t); } catch {}
  return { ok: res.ok, status: res.status, json: j, text: t };
}
const NAME = `percy-testbed-rich-${nonce}`;
const created = await api('POST', '/projects', { data: { type: 'projects', attributes: { name: NAME, type: 'web' } } });
if (!created.ok) throw new Error(`createProject ${created.status}`);
const fullSlug = created.json.data.attributes['full-slug'];
console.log(`[1] ${fullSlug}`);
const toks = await api('GET', `/projects/${fullSlug}/tokens`);
const tok = (r: string) => toks.json.data.find((t: any) => t.attributes.role === r).attributes.token;
const project = { id: created.json.data.id, slug: fullSlug, writeToken: tok('write_only'), readToken: tok('read_only') };
const http = async (req: any) => {
  const res = await fetch(req.url, { method: req.method,
    headers: { ...(req.headers ?? {}), ...(req.body ? { 'content-type': req.contentType ?? 'application/vnd.api+json' } : {}) },
    ...(req.body ? { body: JSON.stringify(req.body) } : {}) });
  const t = await res.text(); let body: any; try { body = JSON.parse(t); } catch {}
  return { status: res.status, ok: res.ok, body, text: t };
};
const ctx: any = { profile, project, projectApi: createProjectApi(profile, http),
  buildApi: createBuildApi(profile, http), runner: spawnRunner, nonce };
await enableIntelliIgnore(ctx);
console.log('[2] settings applied');
const builds = await generateMatrix(ctx);
console.log('\n=== RESULT ===');
console.log(JSON.stringify({ project: `https://percy.io/${fullSlug}`, builds }, null, 2));
