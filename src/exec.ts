/**
 * Injectable shell runner for CLI shell-outs (percy exec/snapshot/app:exec, the
 * seed rake). Tests inject a fake so generators are verifiable without running any CLI.
 */
import { spawn } from 'node:child_process';

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export interface ExecOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  timeoutMs?: number;
}

export type Runner = (command: string, args: string[], opts?: ExecOptions) => Promise<ExecResult>;

export const spawnRunner: Runner = (command, args, opts = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...(opts.env ?? {}) },
      cwd: opts.cwd,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += d.toString()));
    child.stderr?.on('data', (d) => (stderr += d.toString()));
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (opts.timeoutMs) timer = setTimeout(() => child.kill('SIGTERM'), opts.timeoutMs);
    child.on('error', (e) => {
      if (timer) clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });

/** Parse the Percy CLI's `Finalized build #N: <url>/builds/<id>` line. */
export function parseFinalizedBuild(
  logs: string,
): { buildNumber?: number; url?: string; id?: string } | null {
  const m = logs.match(/Finalized build #(\d+):\s*(\S+)/i);
  if (!m) return null;
  const url = m[2];
  const id = url.match(/builds\/(\d+)/)?.[1];
  return { buildNumber: Number(m[1]), url, id };
}
