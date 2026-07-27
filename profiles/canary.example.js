// Example profile — COPY to `profiles/canary.js` and fill secret *references* only.
// NEVER inline real tokens/passwords/cookies here. Secrets are resolved at runtime
// from env vars (or a secrets manager); this file holds only non-secret config plus
// the NAMES of the env vars that carry each secret. `profiles/*.js` (non-example)
// is gitignored. (Plan R2a + security review.)
export default {
  env: 'canary', // must be on the non-prod allow-list (enforced by the loader, Unit 2)
  baseUrl: 'https://canary.percy.io',
  // The loader derives PERCY_CLIENT_API_URL = `${baseUrl}/api/v1` and injects it on
  // EVERY capture. If unset, the Percy CLI defaults to api.percy.io (prod) and builds
  // silently land on prod — see plan risks.

  // Secret *references* (env var names), resolved at runtime — never inline values.
  secrets: {
    // User-level principal — required for createProject / editProject (auto-approve) /
    // token fetch / region + AI ops / baseline approval (project tokens are rejected).
    userToken: 'PERCY_TESTBED_CANARY_USER_TOKEN',
    // ...or a Rails session cookie + XSRF pair, if that is how this env authenticates:
    // sessionCookie: 'PERCY_TESTBED_CANARY_SESSION_COOKIE',
    // xsrfToken: 'PERCY_TESTBED_CANARY_XSRF_TOKEN',

    // App Percy needs valid PROD-hub BrowserStack creds (staging creds fail on prod hub).
    browserstackUser: 'BROWSERSTACK_USERNAME',
    browserstackKey: 'BROWSERSTACK_ACCESS_KEY',
    // Per-project write/read tokens are fetched at provisioning time (Unit 8) using
    // the user principal above — not stored here.
  },

  // env var carrying bs://<hash> for the pre-uploaded App Percy binary (Android-only).
  appBinaryIdEnv: 'BS_APP_ID',

  // Features expected to be ENABLED on this env. The gate cannot read live LaunchDarkly
  // state, so it relies on this declaration + post-build inert-detection (plan Unit 8).
  expectedFlags: ['ai', 'recurring_diff', 'auto_approve', 'squash_builds'],

  // Optional: override upstream sibling repo locations (defaults = hub siblings).
  // upstream: {
  //   seedAccounts: '../percy-api-seed-accounts',
  //   percyPlaywright: '../BStackAutomation-vra/percy/percy_playwright',
  // },
};
