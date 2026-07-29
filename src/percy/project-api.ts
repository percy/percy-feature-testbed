/**
 * Project REST API — public Percy contract (Unit 3 / provisioning).
 *
 * Per the public docs, account-level actions (create/update project) authenticate
 * with HTTP Basic auth = BrowserStack username + access key. There is no public
 * bearer "user token" for project creation.
 *   - Create project:  POST /api/v1/projects   (Basic auth; org inferred from creds)
 *   - Update project:  PATCH /api/v1/projects/{idOrSlug}
 *   - Project token:   linked via a `tokens` relationship on the create response;
 *     the concrete API fetch is NOT fully publicly documented (UI is the solid path),
 *     so treat fetchProjectToken as verify-on-first-run.
 * Refs: browserstack.com/docs/percy/api-reference/{projects,authentication}.
 */
import type { HttpClient } from '../http';
import type { ResolvedProfile } from '../profile/schema';
import { basicAuthHeaders } from './auth';

export type ProjectType = 'web' | 'app';
// Verified live against percy.io: the tokens endpoint returns these role names.
export type ProjectTokenRole = 'write_only' | 'read_only' | 'master' | 'full_access';

export interface ProjectApi {
  createProject(name: string, type?: ProjectType): Promise<{ id: string; slug: string }>;
  editProject(idOrSlug: string, attributes: Record<string, unknown>): Promise<void>;
  setAutoApprove(idOrSlug: string, branchFilter: string): Promise<void>;
  fetchProjectToken(idOrSlug: string, role: ProjectTokenRole): Promise<string>;
}

/** Account/control-plane auth = BrowserStack username + access key (Basic auth). */
function controlAuth(profile: ResolvedProfile): Record<string, string> {
  const { browserstackUser, browserstackKey } = profile.secrets;
  if (!browserstackUser || !browserstackKey) {
    throw new Error(
      'Creating/editing a project needs BrowserStack Basic-auth creds ' +
        '(browserstackUser + browserstackKey). Percy authenticates account-level ' +
        'actions with your BrowserStack username + access key, not a bearer token.',
    );
  }
  return basicAuthHeaders(browserstackUser, browserstackKey);
}

export function createProjectApi(profile: ResolvedProfile, http: HttpClient): ProjectApi {
  const api = profile.clientApiUrl; // e.g. https://percy.io/api/v1 (or the target env)

  const projectApi: ProjectApi = {
    async createProject(name, type = 'web') {
      const res = await http({
        method: 'POST',
        url: `${api}/projects`,
        headers: controlAuth(profile),
        body: { data: { type: 'projects', attributes: { name, type } } },
      });
      if (!res.ok) throw new Error(`createProject failed (${res.status}): ${res.text}`);
      const data = (res.body as any)?.data;
      const slug = data?.attributes?.slug ?? data?.attributes?.['full-slug'] ?? name;
      return { id: String(data?.id), slug: String(slug) };
    },

    async editProject(idOrSlug, attributes) {
      const res = await http({
        method: 'PATCH',
        url: `${api}/projects/${idOrSlug}`,
        headers: controlAuth(profile),
        body: { data: { attributes } },
      });
      if (!res.ok) throw new Error(`editProject failed (${res.status}): ${res.text}`);
    },

    async setAutoApprove(idOrSlug, branchFilter) {
      return projectApi.editProject(idOrSlug, { auto_approve_branch_filter: branchFilter });
    },

    async fetchProjectToken(idOrSlug, role) {
      // NOT fully public-documented — verify on first run (Unit 0); UI is the fallback.
      const res = await http({
        method: 'GET',
        url: `${api}/projects/${idOrSlug}/tokens`,
        headers: controlAuth(profile),
      });
      if (!res.ok) {
        throw new Error(
          `fetchProjectToken failed (${res.status}): ${res.text}. ` +
            'Token fetch is not fully public-documented — the token may only be ' +
            'retrievable from the Project Settings UI.',
        );
      }
      const tokens = ((res.body as any)?.data ?? []) as Array<{
        attributes?: { role?: string; token?: string };
      }>;
      const match = tokens.find((t) => t?.attributes?.role === role);
      if (!match?.attributes?.token) {
        throw new Error(`No "${role}" token found for project ${idOrSlug}.`);
      }
      return String(match.attributes.token);
    },
  };

  return projectApi;
}
