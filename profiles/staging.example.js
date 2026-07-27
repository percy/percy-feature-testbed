// Example profile — COPY to `profiles/staging.js` and fill secret *references* only.
// See canary.example.js for the full field documentation. NEVER inline secrets.
export default {
  env: 'staging',
  baseUrl: 'https://staging.percy.io', // confirm the exact staging host during Phase-0
  secrets: {
    userToken: 'PERCY_TESTBED_STAGING_USER_TOKEN',
    browserstackUser: 'BROWSERSTACK_USERNAME',
    browserstackKey: 'BROWSERSTACK_ACCESS_KEY',
  },
  appBinaryIdEnv: 'BS_APP_ID',
  expectedFlags: ['ai', 'recurring_diff', 'auto_approve', 'squash_builds'],
};
