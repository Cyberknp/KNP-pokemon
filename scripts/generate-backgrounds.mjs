/**
 * Background asset generator (Background Beauty, Phase 1).
 *
 * Generates the pixel-art scene layers for the new themes (`volcano`, `snow`)
 * as flat-band pixel art, using the same dimensions and naming contract as the
 * existing hand-drawn assets in media/backgrounds/.
 *
 * Usage:  node scripts/generate-backgrounds.mjs [theme ...]
 * With no arguments it regenerates every theme listed in THEMES below.
 *
 * The output is deterministic (seeded PRNG) so re-runs produce identical
 * files. Replace any generated PNG with real artwork of the same name/dimensions
 * at any time - nothing else needs to change.
 *
 * Layout contract: the walkable ground band occupies only the bottom ~8% of
 * each image so Pokémon sit LOW in the panel, keeping narrow sidebars usable.
 * FLOOR_HEIGHTS in src/panel/main.ts must match GROUND_BAND fractions below.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_BASE = join(ROOT, 'media', 'backgrounds');

/** size tier -> output dimensions (matches existing forest/castle/beach art). */
const SIZES = {
  nano: [351, 300],
  small: [468, 400],
  medium: [585, 500],
  large: [936, 800],
};
const KINDS = ['dark', 'light'];

/** Fraction of image height used by the opaque foreground ground band.
    Must stay in sync with FLOOR_HEIGHTS for these themes. */
const GROUND_BAND = 0.08;

/* ------------------------------------------------------------------ */
/* Minimal PNG encoder (RGBA, 8-bit, no interlace)                    */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ */
/* Tiny canvas helpers                                                */
/* ------------------------------------------------------------------ */

class Scene {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.buf = Buffer.alloc(width * height * 4); // transparent
  }

  px(x, y, [r, g, b, a = 255]) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.buf[i] = r;
    this.buf[i + 1] = g;
    this.buf[i + 2] = b;
    this.buf[i + 3] = a;
  }

  rect(x, y, w, h, color) {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.px(xx, yy, color);
  }

  /**
   * Pixel-art gradient: hard bands with a 2px checkerboard dither seam
   * between neighbours, which reads much softer than raw stripes.
   */
  sky(topColor, bottomColor, steps = 8) {
    const bandH = this.height / steps;
    const mixAt = (t) =>
      topColor.map((c, i) =>
        i === 3 ? 255 : Math.round(c + (bottomColor[i] - c) * t),
      );
    for (let y = 0; y < this.height; y++) {
      const raw = y / bandH;
      const band = Math.min(steps - 1, Math.floor(raw));
      const frac = raw - band;
      let color = mixAt(band / (steps - 1));
      // dither the lower quarter of every band toward the next band's color
      if (frac > 0.75) {
        const next = mixAt(Math.min(1, (band + 1) / (steps - 1)));
        for (let x = 0; x < this.width; x++) {
          this.px(x, y, (x + y) % 2 === 0 ? next : color);
        }
        continue;
      }
      this.rect(0, y, this.width, 1, color);
    }
  }

  /** Rolling hill silhouette starting at `baseY`, amplitude `amp`. */
  hills(baseY, amp, wavelength, color, phase = 0) {
    for (let x = 0; x < this.width; x++) {
      const y =
        baseY +
        Math.round(
          Math.sin((x / wavelength) * Math.PI * 2 + phase) * amp +
            Math.sin((x / (wavelength * 2.7)) * Math.PI * 2 + phase) * (amp / 2),
        );
      this.rect(x, y, 1, this.height - y, color);
    }
  }

  /** Triangle pine tree with trunk; `groundY` is where the trunk meets snow. */
  pine(x, groundY, h, foliage, trunk) {
    const w = Math.max(5, Math.round(h * 0.7));
    for (let row = 0; row < h; row++) {
      const span = Math.round(((row + 1) / h) * w);
      this.rect(x - Math.floor(span / 2), groundY - h + row, span, 1, foliage);
    }
    // snow caps on the upper branches
    for (let row = 0; row < Math.floor(h * 0.35); row++) {
      const span = Math.round(((row + 1) / h) * w);
      this.rect(x - Math.floor(span / 2), groundY - h + row, span, 1, [235, 244, 252]);
    }
    this.rect(x - 1, groundY - 2, 3, 3, trunk);
  }

  /** Deterministic PRNG so regeneration is byte-stable. */
  rng(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
}

/* ------------------------------------------------------------------ */
/* Palette helpers                                                    */
/* ------------------------------------------------------------------ */

/** Darkens a palette toward dusk for the `dark` variant. */
function dusk(palette, amount) {
  const out = {};
  for (const [name, c] of Object.entries(palette)) {
    out[name] =
      typeof c === 'number'
        ? c
        : [
            Math.round(c[0] * (1 - amount)),
            Math.round(c[1] * (1 - amount)),
            Math.round(c[2] * (1 - amount)),
            c[3] ?? 255,
          ];
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Theme painters                                                     */
/* ------------------------------------------------------------------ */

const SNOW_PALE = {
  skyTop: [108, 150, 205],
  skyBottom: [222, 236, 248],
  farPeaks: [150, 178, 210],
  peakCap: [238, 246, 252],
  nearHills: [205, 224, 242],
  snowBand: [242, 249, 254],
  bandShade: [216, 231, 245],
  pine: [40, 92, 76],
  pineDark: [28, 68, 58],
  trunk: [74, 52, 38],
  cloud: [238, 245, 252, 215],
  flake: [255, 255, 255, 230],
};

const SNOW_DUSK = dusk(SNOW_PALE, 0.45);

function paintSnow(kind, w, h) {
  const p = kind === 'dark' ? SNOW_DUSK : SNOW_PALE;
  const rand = new Scene(w, h).rng(kind === 'dark' ? 111 : 110);
  const groundY = Math.round(h * (1 - GROUND_BAND));

  // background: winter sky, falling snow, jagged capped peaks + near hills
  const bg = new Scene(w, h);
  bg.sky(p.skyTop, p.skyBottom, 8);
  // snowfall — sparse dots, denser toward the top of the ground line
  const flakes = Math.round((w * h) / 900);
  for (let i = 0; i < flakes; i++) {
    const fx = Math.floor(rand() * w);
    const fy = Math.floor(rand() * groundY);
    bg.rect(fx, fy, rand() > 0.75 ? 2 : 1, 1, p.flake);
  }
  // far mountain range with snow caps
  const peakW = Math.round(w / 5);
  for (let i = -1; i < 7; i++) {
    const px = i * peakW + Math.round(rand() * 20) - 10;
    const ph = Math.round(h * (0.28 + rand() * 0.12));
    for (let row = 0; row < ph; row++) {
      const span = Math.round(((row + 1) / ph) * peakW * 1.4);
      bg.rect(px - Math.floor(span / 2), groundY - ph + row, span, 1, p.farPeaks);
    }
    const capH = Math.round(ph * 0.22);
    for (let row = 0; row < capH; row++) {
      const span = Math.round(((row + 1) / ph) * peakW * 1.4);
      bg.rect(px - Math.floor(span / 2), groundY - ph + row, span, 1, p.peakCap);
    }
  }
  bg.hills(Math.round(groundY * 0.88), Math.round(h * 0.035), w / 1.8, p.nearHills, 1.2);

  // midground: soft cloud band that drifts (parallax layer)
  const mg = new Scene(w, h);
  let cx = Math.round(w * 0.05);
  while (cx < w) {
    const cw = 22 + Math.floor(rand() * 32);
    const ch = 4 + Math.floor(rand() * 3);
    mg.rect(cx, Math.round(h * (0.12 + rand() * 0.1)), cw, ch, p.cloud);
    cx += cw + 14 + Math.floor(rand() * 22);
  }

  // foreground: thin snow field with tree line
  const fg = new Scene(w, h);
  fg.rect(0, groundY, w, h - groundY, p.snowBand);
  fg.rect(0, groundY, w, 2, p.bandShade);
  const trees = Math.max(4, Math.round(w / 95));
  for (let i = 0; i < trees; i++) {
    const tx = Math.round((w / trees) * i + rand() * (w / trees) * 0.6);
    const th = Math.round(h * (0.1 + rand() * 0.06));
    fg.pine(tx, groundY + 2, th, rand() > 0.4 ? p.pine : p.pineDark, p.trunk);
  }
  return { background: bg, midground: mg, foreground: fg };
}

const VOLCANO_PALE = {
  skyTop: [64, 48, 82],
  skyBottom: [250, 178, 102],
  glow: [255, 214, 120],
  ridgeFar: [88, 56, 66],
  ridgeNear: [52, 34, 46],
  cone: [66, 44, 56],
  coneShade: [50, 32, 44],
  rock: [36, 25, 33],
  rockEdge: [58, 40, 48],
  lava: [255, 122, 40],
  lavaHot: [255, 214, 96],
  ember: [255, 176, 80, 200],
  star: [255, 236, 200, 220],
};

const VOLCANO_DUSK = dusk(VOLCANO_PALE, 0.4);

function paintVolcano(kind, w, h) {
  const p = kind === 'dark' ? VOLCANO_DUSK : VOLCANO_PALE;
  const rand = new Scene(w, h).rng(kind === 'dark' ? 211 : 210);
  const groundY = Math.round(h * (1 - GROUND_BAND));

  // background: ember sky with stars (dark), volcano cone + lava river
  const bg = new Scene(w, h);
  bg.sky(p.skyTop, p.skyBottom, 8);
  if (kind === 'dark') {
    const stars = Math.round((w * h) / 1600);
    for (let i = 0; i < stars; i++) {
      const sx = Math.floor(rand() * w);
      const sy = Math.floor(rand() * h * 0.45);
      bg.rect(sx, sy, rand() > 0.8 ? 2 : 1, 1, p.star);
    }
  }
  // main volcano cone sitting on the horizon line
  const coneX = Math.round(w * 0.6);
  const coneH = Math.round(h * 0.34);
  const coneW = Math.round(w * 0.36);
  const craterY = groundY - coneH;
  for (let row = 0; row < coneH; row++) {
    const span = Math.round(((row + 1) / coneH) * coneW);
    const shaded = row > coneH * 0.55; // right-side shading for depth
    bg.rect(
      coneX - Math.floor(span / 2),
      craterY + row,
      span,
      1,
      shaded ? p.coneShade : p.cone,
    );
  }
  // crater glow + lava river snaking down the cone face
  bg.rect(coneX - Math.round(coneW * 0.09), craterY, Math.round(coneW * 0.18), 3, p.lavaHot);
  bg.rect(coneX - Math.round(coneW * 0.13), craterY + 1, Math.round(coneW * 0.06), 2, p.glow);
  bg.rect(coneX + Math.round(coneW * 0.07), craterY + 1, Math.round(coneW * 0.06), 2, p.glow);
  let lx = coneX + 1;
  for (let row = craterY + 3; row < groundY - 2; row++) {
    const t = (row - craterY) / coneH;
    lx += rand() > 0.6 ? (rand() > 0.5 ? 1 : -1) : 0;
    lx = Math.max(coneX - Math.round(coneW * 0.3 * t), Math.min(coneX + Math.round(coneW * 0.3 * t), lx));
    bg.rect(lx, row, 2, 1, row % 5 === 0 ? p.lavaHot : p.lava);
  }
  // distant companion cones
  for (const [fx, fh] of [[0.16, 0.16], [0.86, 0.12]]) {
    const sx = Math.round(w * fx);
    const sh = Math.round(h * fh);
    for (let row = 0; row < sh; row++) {
      const span = Math.round(((row + 1) / sh) * (sh * 2.4));
      bg.rect(sx - Math.floor(span / 2), groundY - sh + row, span, 1, p.ridgeFar);
    }
  }
  bg.hills(Math.round(groundY * 0.93), Math.round(h * 0.02), w / 1.7, p.ridgeNear, 0.6);

  // midground: drifting ember haze (parallax layer)
  const mg = new Scene(w, h);
  const embers = Math.round(w / 12);
  for (let i = 0; i < embers; i++) {
    const ex = Math.floor(rand() * w);
    const ey = Math.round(h * (0.15 + rand() * 0.55));
    mg.rect(ex, ey, rand() > 0.8 ? 2 : 1, 1, p.ember);
  }

  // foreground: thin basalt shelf with glowing lava cracks
  const fg = new Scene(w, h);
  fg.rect(0, groundY, w, h - groundY, p.rock);
  fg.rect(0, groundY, w, 2, p.rockEdge);
  const cracks = Math.max(4, Math.round(w / 90));
  for (let i = 0; i < cracks; i++) {
    const cx2 = Math.floor(rand() * w);
    const cy = groundY + 2 + Math.floor(rand() * Math.max(1, h - groundY - 4));
    const len = 5 + Math.floor(rand() * 14);
    fg.rect(cx2, cy, len, 1, rand() > 0.5 ? p.lava : p.lavaHot);
    if (rand() > 0.6) fg.rect(cx2 + Math.floor(len / 2), cy + 1, 1, 2, p.lava);
  }
  return { background: bg, midground: mg, foreground: fg };
}

/* ------------------------------------------------------------------ */
/* Driver                                                             */
/* ------------------------------------------------------------------ */

const THEMES = {
  snow: paintSnow,
  volcano: paintVolcano,
};

const requested = process.argv.slice(2);
const themes = requested.length ? requested : Object.keys(THEMES);
let written = 0;

for (const theme of themes) {
  const painter = THEMES[theme];
  if (!painter) {
    console.error(`Unknown theme "${theme}". Known: ${Object.keys(THEMES).join(', ')}`);
    process.exitCode = 1;
    continue;
  }
  const dir = join(OUT_BASE, theme);
  mkdirSync(dir, { recursive: true });
  for (const kind of KINDS) {
    for (const [sizeName, [w, h]] of Object.entries(SIZES)) {
      const layers = painter(kind, w, h);
      for (const [layer, scene] of Object.entries(layers)) {
        // Follows the established `{layer}-{kind}-{size}.png` contract.
        const file = join(dir, `${layer}-${kind}-${sizeName}.png`);
        writeFileSync(file, encodePng(scene.width, scene.height, scene.buf));
        written++;
      }
    }
  }
  console.log(`Generated ${KINDS.length * Object.keys(SIZES).length * 3} files for "${theme}"`);
}
console.log(`Done — ${written} PNGs written under media/backgrounds/`);
