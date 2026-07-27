/**
 * Org token API (plan Unit 3). Uses the USER principal. NB: the reference helper
 * hardcodes ORG_ID='test' — here the team/org id is a parameter (parameterized).
 */
import type { HttpClient } from '../http';
import type { ResolvedProfile } from '../profile/schema';
import { userAuthHeaders } from './auth';

export interface OrgTokenApi {
  createOrgToken(teamId: string): Promise<string>;
}

export function createOrgTokenApi(profile: ResolvedProfile, http: HttpClient): OrgTokenApi {
  const api = profile.clientApiUrl;
  return {
    async createOrgToken(teamId) {
      const res = await http({
        method: 'POST',
        url: `${api}/organizations/${teamId}/tokens`,
        headers: userAuthHeaders(profile),
      });
      if (!res.ok) throw new Error(`createOrgToken failed (${res.status}): ${res.text}`);
      return String((res.body as any)?.data?.attributes?.token);
    },
  };
}
