/**
 * App Percy (mobile, Android via Appium) generator (plan Unit 7, R15/R4/R3b).
 *
 * Shells out to app_capture.py in place. Needs prod-hub BrowserStack creds + a
 * pre-uploaded BS_APP_ID (or RUN_LOCAL + an app path). PERCY_CLIENT_API_URL is
 * passed via env — the script reads it from env, there is no hardcode to override.
 */
import { noncedBranch, type GeneratorContext, type GeneratedBuild } from './context';
import { parseFinalizedBuild } from '../exec';

export async function generateAppPercy(ctx: GeneratorContext): Promise<GeneratedBuild[]> {
  const { profile, project, runner } = ctx;
  const { browserstackUser, browserstackKey } = profile.secrets;

  if (!profile.runLocalApp && (!browserstackUser || !browserstackKey || !profile.appBinaryId)) {
    throw new Error(
      'App Percy needs prod-hub BrowserStack creds + a pre-uploaded BS_APP_ID (or runLocalApp + an app path).',
    );
  }

  const script = `${profile.upstream.seedAccounts}/scripts/seed-accounts/app_capture.py`;
  const variants: Array<{ variant: 'baseline' | 'changed'; branch: string; label: string }> = [
    { variant: 'baseline', branch: noncedBranch('master', ctx.nonce), label: 'App Percy: baseline' },
    { variant: 'changed', branch: noncedBranch('app-change', ctx.nonce), label: 'App Percy: changed' },
  ];

  const out: GeneratedBuild[] = [];
  for (const v of variants) {
    const env: NodeJS.ProcessEnv = {
      PERCY_TOKEN: project.writeToken,
      PERCY_BRANCH: v.branch,
      PERCY_CLIENT_API_URL: profile.clientApiUrl,
      BUILD_VARIANT: v.variant,
    };
    if (profile.runLocalApp) {
      env.RUN_LOCAL = '1';
      if (profile.appPath) env.APP_PATH = profile.appPath;
    } else {
      env.BROWSERSTACK_USERNAME = browserstackUser!;
      env.BROWSERSTACK_ACCESS_KEY = browserstackKey!;
      env.BS_APP_ID = profile.appBinaryId!;
    }

    const result = await runner('percy', ['app:exec', '--', 'python', script], { env, timeoutMs: 600_000 });
    const parsed = parseFinalizedBuild(`${result.stdout}\n${result.stderr}`);
    if (!parsed?.id) {
      throw new Error(`App capture did not finalize a build (variant=${v.variant}).`);
    }
    await ctx.buildApi.waitForBuildFinished(parsed.id, project.readToken);
    out.push({ feature: 'app-percy', requirement: 'R15', label: v.label, buildId: parsed.id, buildUrl: parsed.url });
  }
  return out;
}
