// Example profile — COPY to `profiles/local.js` and fill secret *references* only.
// See canary.example.js for the full field documentation. NEVER inline secrets.
export default {
  env: 'local',
  baseUrl: 'https://localhost:4200', // local percy-api / dashboard
  // NOTE: the upstream harness relies on NODE_TLS_REJECT_UNAUTHORIZED=0 for the local
  // mkcert dev cert. Prefer trusting the local CA (add the mkcert root to your trust
  // store). If you must disable TLS verification, scope it strictly to `local` — never
  // to a shared/remote profile (it enables MITM). See plan Unit 2.
  secrets: {
    // Locally, tokens can be minted via `docker compose exec api bundle exec rails runner ...`
    userToken: 'PERCY_TESTBED_LOCAL_USER_TOKEN',
  },
  // App Percy locally uses an emulator instead of BrowserStack:
  app: {
    runLocal: true, // sets RUN_LOCAL=1 for app_capture.py
    appPathEnv: 'PERCY_TESTBED_LOCAL_APP_PATH', // env var → path to the .apk
  },
  expectedFlags: ['ai', 'recurring_diff', 'auto_approve', 'squash_builds'],
};
