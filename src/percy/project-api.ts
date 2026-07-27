/**
 * Project REST API (plan Unit 3, R6/R13). All calls use the USER principal —
 * project tokens are rejected by percy-api for these operations.
 *
 * Endpoint shapes follow the reference helpers in
 * BStackAutomation-vra/percy/percy_playwright/helpers/api/project-api.ts.
 * Exact token-endpoint path/roles are a Phase-0 confirmation item.
 */
import type { HttpClient } from '../http';
import type { ResolvedProfile } from '../profile/schema';
import { userAuthHeaders } from './auth';

export type ProjectTokenRole = 'write_only' | 'read';

export interface ProjectApi {
  createProject(teamId: string, name: string, attributes?: Record<string, unknown>): Promise<{ id: string; slug: string }>;
  editProject(teamId: string, slug: string, attributes: Record<string, unknown>): Promise<void>;
  setAutoApprove(teamId: string, slug: string, branchFilter: string): Promise<void>;
  fetchProjectToken(projectId: string, role: ProjectTokenRole): Promise<string>;
}

export function createProjectApi(profile: ResolvedProfile, http: HttpClient): ProjectApi {
  const api = profile.clientApiUrl;
  const auth = () => userAuthHeaders(profile);

  const projectApi: ProjectApi = {
    async createProject(teamId, name, attributes = {}) {
      const res = await http({
        method: 'POST',
        url: `${api}/organizations/${teamId}/projects`,
        headers: auth(),
        body: { data: { type: 'projects', attributes: { name, ...attributes } } },
      });
      if (!res.ok) throw new Error(`createProject failed (${res.status}): ${res.text}`);
      const data = (res.body as any)?.data;
      return { id: String(data?.id), slug: String(data?.attributes?.slug ?? name) };
    },

    async editProject(teamId, slug, attributes) {
      const res = await http({
        method: 'PATCH',
        url: `${api}/projects/${teamId}/${slug}`,
        headers: auth(),
        body: { data: { attributes } },
      });
      if (!res.ok) throw new Error(`editProject failed (${res.status}): ${res.text}`);
    },

    async setAutoApprove(teamId, slug, branchFilter) {
      // `auto_approve_branch_filter` is a :update?-gated permitted param
      // (verified in percy-api/app/models/percy/project.rb).
      return projectApi.editProject(teamId, slug, { auto_approve_branch_filter: branchFilter });
    },

    async fetchProjectToken(projectId, role) {
      const res = await http({
        method: 'GET',
        url: `${api}/projects/${projectId}/tokens`,
        headers: auth(),
      });
      if (!res.ok) throw new Error(`fetchProjectToken failed (${res.status}): ${res.text}`);
      const tokens = ((res.body as any)?.data ?? []) as Array<{ attributes?: { role?: string; token?: string } }>;
      const match = tokens.find((t) => t?.attributes?.role === role);
      if (!match?.attributes?.token) {
        throw new Error(
          `No "${role}" token for project ${projectId}. ` +
            '(Phase-0 must confirm the tokens endpoint + role names on the target env.)',
        );
      }
      return String(match.attributes.token);
    },
  };

  return projectApi;
}
