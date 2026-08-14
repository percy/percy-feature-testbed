/**
 * Auth header builders. Verified against percy-api policies:
 *  - project mutations / approval / regions / AI need a USER principal
 *    (ProjectPolicy#update? => is_user_token?; BuildPolicy#_approve? rejects project tokens)
 *  - build capture/finalize uses a project WRITE token; polling uses a READ token
 *  - reviewBuild uses BrowserStack Basic auth
 */
import type { ResolvedProfile } from '../profile/schema';

export function userAuthHeaders(profile: ResolvedProfile): Record<string, string> {
  const s = profile.secrets;
  if (s.sessionCookie && s.xsrfToken) {
    return { cookie: `_percy_session=${s.sessionCookie}`, 'x-csrf-token': s.xsrfToken };
  }
  if (s.userToken) {
    return { authorization: `Token token=${s.userToken}` };
  }
  throw new Error(
    'This operation needs a user-level principal (userToken, or sessionCookie+xsrfToken). ' +
      'percy-api rejects project tokens for project mutations / approval / regions / AI.',
  );
}

export function projectTokenHeaders(token: string): Record<string, string> {
  return { authorization: `Token token=${token}` };
}

export function basicAuthHeaders(user: string, key: string): Record<string, string> {
  return { authorization: `Basic ${Buffer.from(`${user}:${key}`).toString('base64')}` };
}
