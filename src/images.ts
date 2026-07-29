/**
 * Static PNG generator for the image-based build path (`percy upload`, no browser).
 * This is the path proven live against percy.io. Each "variant" yields a snapshot
 * set whose differences drive the review states:
 *   baseline/unchanged — same images; changed — one image differs; new — extra
 *   snapshot; removed — one snapshot dropped.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

export type Variant = 'baseline' | 'unchanged' | 'changed' | 'new' | 'removed';
export type Rgb = [number, number, number];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** A solid-color 8-bit truecolor PNG. */
export function pngSolid(width: number, height: number, rgb: Rgb): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  const rowLen = 1 + width * 3;
  const raw = Buffer.alloc(rowLen * height);
  for (let y = 0; y < height; y++) {
    const off = y * rowLen;
    raw[off] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const p = off + 1 + x * 3;
      raw[p] = rgb[0];
      raw[p + 1] = rgb[1];
      raw[p + 2] = rgb[2];
    }
  }
  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const BLUE: Rgb = [76, 110, 245];
const GREEN: Rgb = [34, 139, 87];
const RED: Rgb = [220, 50, 50];
const AMBER: Rgb = [200, 150, 50];

const SETS: Record<Variant, Record<string, Rgb>> = {
  baseline: { home: BLUE, pricing: GREEN },
  unchanged: { home: BLUE, pricing: GREEN }, // identical to baseline
  changed: { home: RED, pricing: GREEN }, // home differs from baseline
  new: { home: BLUE, pricing: GREEN, about: AMBER }, // extra snapshot
  removed: { home: BLUE }, // pricing dropped
};

/**
 * Write the snapshot images for a variant into `dir` (must exist). Returns the
 * file paths. Filenames become the Percy snapshot names on `percy upload`.
 */
export function writeSnapshotImages(dir: string, variant: Variant, width = 1280, height = 800): string[] {
  const set = SETS[variant] ?? SETS.baseline;
  const files: string[] = [];
  for (const [name, rgb] of Object.entries(set)) {
    const path = join(dir, `${name}.png`);
    writeFileSync(path, pngSolid(width, height, rgb));
    files.push(path);
  }
  return files;
}
