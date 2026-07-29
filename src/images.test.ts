import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pngSolid, writeSnapshotImages } from './images';

test('pngSolid emits a valid PNG signature + IHDR chunk', () => {
  const buf = pngSolid(4, 4, [1, 2, 3]);
  assert.deepEqual([...buf.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(buf.subarray(12, 16).toString('ascii'), 'IHDR');
});

test('changed variant differs from baseline on home, matches on pricing', () => {
  const b = mkdtempSync(join(tmpdir(), 'itb-'));
  const c = mkdtempSync(join(tmpdir(), 'itc-'));
  writeSnapshotImages(b, 'baseline');
  writeSnapshotImages(c, 'changed');
  assert.ok(!readFileSync(join(b, 'home.png')).equals(readFileSync(join(c, 'home.png'))), 'home differs');
  assert.ok(readFileSync(join(b, 'pricing.png')).equals(readFileSync(join(c, 'pricing.png'))), 'pricing matches');
});

test('new adds a snapshot (3); removed drops one (1)', () => {
  const n = mkdtempSync(join(tmpdir(), 'itn-'));
  const r = mkdtempSync(join(tmpdir(), 'itr-'));
  assert.equal(writeSnapshotImages(n, 'new').length, 3);
  assert.equal(writeSnapshotImages(r, 'removed').length, 1);
});
