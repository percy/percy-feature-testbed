import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFixtureSet, HOME, PRICING, ABOUT } from './sets';

function seed(kind: Parameters<typeof writeFixtureSet>[1]): { dir: string; files: string[] } {
  const dir = mkdtempSync(join(tmpdir(), 'set-'));
  writeFixtureSet(dir, kind);
  return { dir, files: readdirSync(dir).sort() };
}

test('the new set adds a page and the removed set drops one', () => {
  assert.deepEqual(seed('baseline').files, [HOME, PRICING].sort());
  assert.deepEqual(seed('new').files, [ABOUT, HOME, PRICING].sort());
  assert.deepEqual(seed('removed').files, [HOME]);
});

test('filenames are stable across sets so snapshots line up build to build', () => {
  for (const kind of ['baseline', 'changed', 'noise', 'noise-signal', 'layout-shift'] as const) {
    assert.ok(seed(kind).files.includes(HOME), `${kind} still has ${HOME}`);
  }
});

test('the set kind selects the storefront variant', () => {
  const changed = seed('changed');
  assert.ok(readFileSync(join(changed.dir, HOME), 'utf8').includes('$129'));

  const baseline = seed('baseline');
  assert.ok(readFileSync(join(baseline.dir, HOME), 'utf8').includes('$99'));
});

test('unchanged renders identically to baseline', () => {
  const a = seed('baseline');
  const b = seed('unchanged');
  assert.equal(
    readFileSync(join(a.dir, HOME), 'utf8'),
    readFileSync(join(b.dir, HOME), 'utf8'),
  );
});
