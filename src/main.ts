#!/usr/bin/env node
/**
 * Executable entry point for `seed-testbed`. Kept separate from `cli.ts` so the
 * library stays free of top-level side effects and is safe to import in tests.
 */
import { run, UsageError, usage } from './cli';
import { realDispatch } from './run';

run(process.argv.slice(2), { dispatch: realDispatch }).catch((err) => {
  if (err instanceof UsageError) {
    console.error(`error: ${err.message}`);
    console.error(usage());
    process.exit(1);
  }
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
