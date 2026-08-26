#!/usr/bin/env node
// Asset optimization pipeline (Improvement Item 10).
//
// Recompresses every GIF under media/ with gifsicle (-O3 --lossy=80),
// which typically shrinks sprite assets by 50-70% with no visible
// difference at pet scale.
//
// Usage:
//   npm run optimize-assets
//
// Requirements: the `gifsicle` binary on PATH (e.g. `apt install gifsicle`
// or `brew install gifsicle`). The script prints guidance and exits when
// gifsicle is missing. Files smaller than MIN_SIZE bytes are skipped
// because compression overhead isn't worth it for tiny sprites.

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const MEDIA_DIR = new URL('../media/', import.meta.url).pathname;
const MIN_SIZE = 600; // bytes; skip sprites this small
const GIF_ARGS = ['-O3', '--lossy=80'];

function hasGifsicle() {
  const probe = spawnSync('gifsicle', ['--version'], { stdio: 'ignore' });
  return !probe.error;
}

function collectGifs(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectGifs(full));
    } else if (entry.toLowerCase().endsWith('.gif')) {
      out.push(full);
    }
  }
  return out;
}

if (!hasGifsicle()) {
  console.error(
    'gifsicle not found on PATH.\n' +
      'Install it first (apt install gifsicle | brew install gifsicle),\n' +
      'then re-run: npm run optimize-assets',
  );
  process.exit(1);
}

const gifs = collectGifs(MEDIA_DIR);
console.log(`Found ${gifs.length} gif files under media/`);

let processed = 0;
let keptOriginal = 0;
let skippedSmall = 0;
let failed = 0;
const cleanup = [];

for (const file of gifs) {
  if (statSync(file).size < MIN_SIZE) {
    skippedSmall++;
    continue;
  }
  const tmp = `${file}.tmp.gif`;
  const result = spawnSync('gifsicle', [...GIF_ARGS, file, '-o', tmp], {
    stdio: 'ignore',
  });
  if (result.error || result.status !== 0 || !statSync(tmp, { throwIfNoEntry: false })) {
    failed++;
    continue;
  }
  const before = statSync(file).size;
  const after = statSync(tmp).size;
  if (after < before) {
    renameSync(tmp, file);
    processed++;
  } else {
    // Recompressed output wasn't smaller; keep the original
    cleanup.push(tmp);
    keptOriginal++;
  }
}

for (const tmp of cleanup) {
  try {
    unlinkSync(tmp);
  } catch {
    /* best effort */
  }
}

console.log(
  `Done. recompressed=${processed} kept-original=${keptOriginal} ` +
    `skipped-small=${skippedSmall} failed=${failed}`,
);
