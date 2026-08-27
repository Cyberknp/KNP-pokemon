# 🧪 Testing Vignette — KNP Pokémon Complete Validation (Updated)

**Covers every feature shipped in `Features.md` (Unified Implementation):** Gen 1–5 companions, spawn/recall, shiny, sizing, party cap, motion, persistence, import/export, localization, 6 background scenes, parallax, day/night, random theme, hover recall, cascade, plus all B/S/F bug fixes.
No prior knowledge needed. Tick boxes in order — all green means the extension functions without hiccups.

> **Prerequisites**
> ```bash
> npm install
> npm run compile   # webpack + tsc must end with "compiled successfully"
> ```
> Then press **F5** → **Extension Development Host** window opens. All manual tests run in that window.
> Keep **Help → Toggle Developer Tools → Console** open to spot errors.

---

## 0 — Automated Quality Gates (run before any manual test)

These are the fastest, most reliable methods — run them in your terminal. If any fails, do not proceed to manual vignettes.

### 0.1 Lint (ESLint type-aware)
```bash
npm run lint
```
- [ ] `0 errors` (4 warnings for explicit `any` in `extension.ts:845,954,1017` + `pokemon-collection.ts:85` are expected)
- [ ] No new `browser` field error, no dead `typescript-eslint@alpha` import

### 0.2 Compile (webpack + tsc)
```bash
npm run compile        # dev: source maps
npm run compile:prod   # prod: minified, drop_console
```
- [ ] `webpack 5.95.0 compiled successfully` + `main-bundle.js ~236 KiB`
- [ ] `tsc -p tsconfig.extension.json` exits 0 (no type errors)
- [ ] Prod bundle strips `console.*` (search `main-bundle.js` — no `console.log`)

### 0.3 Unit Tests (vitest + jsdom, 25 tests)
```bash
npm test               # vitest run
npm test -- --coverage # optional coverage
```
- [ ] `tests/states.test.ts 17 tests` — static holdTimes, walk boundaries, run speed 1.6×, climb 100px, jump clamp, chase catch/cancel, `resolveState` fallback
- [ ] `tests/backgrounds.test.ts 8 tests` — floor >0 per theme/size, `none` floor 0, monotonic floors, `resolveSceneVariant` dark/light + dayNight override (19/6 boundaries), registry contains volcano/snow, `THEMES_WITH_MIDGROUND` excludes `none`
- [ ] `25 passed` in <1s
- [ ] Coverage: `states.ts` and `main.ts:calculateFloor/resolveSceneVariant` near 100% (new method: add `--coverage` threshold 90% in CI)

### 0.4 Static Checks (new methods)
```bash
npx tsc --noEmit                          # type-only
grep -r "typescript-eslint" package.json  # should only show @typescript-eslint/*@^5.29.0, not 0.0.1-alpha.0
grep -n "browser" package.json            # should be empty (S-3)
cat .gitignore | grep dev_session.md      # should exist (B-1)
ls dev_session.md 2>&1 | grep "No such"   # should be untracked
```
- [ ] All pass

### 0.5 Package Validation
```bash
npx @vscode/vsce package --no-yarn  # dry-run packaging
```
- [ ] No warning about missing assets, `.vsix` ~ few MB, `media/main-bundle.js` included, `src/` excluded via `.vscodeignore`

> **New automated methods added:** coverage gates, prod-bundle console stripping, `vsce` packaging dry-run, `tsc --noEmit` type-only, `grep` manifest checks. In CI, wire as: `npm ci && npm run lint && npm run compile && npm test` (see IMPLEMENTATION_PLAN R4).

---

## 1 — Core Pokémon Features

### Test 1 — Baseline (theme `none`)
1. `Ctrl+Shift+P` → **Start pokemon coding session** → `Alt+Shift+W` → pick any.
- [ ] Panel plain (editor background), Pokémon walks on bottom edge, no scenery.

### Test 2 — Spawn (QuickPick gen browsing + search)
1. `Alt+Shift+W` → verify first view shows `$(folder) Generation 1..5` separators.
2. Type `pika` → Results appear with `#0025` etc.
3. Pick `pikachu` → name input defaults to random → Enter.
- [ ] Two-level picker works, search filters label+description, custom name applied.

### Test 3 — Spawn Random
1. `Alt+Shift+Q`.
- [ ] Random species appears instantly, obeys `shinyOdds`, respects party cap.

### Test 4 — Recall Single (palette vs hover)
1. `Alt+Shift+D` → QuickPick lists `name · color type` → pick one.
- [ ] Pokéball-close (6-frame steps) + `fade-out`, toast `👋 Removed`, collection updates.
2. Hover a Pokémon → Pokéball appears inside collision box → click it.
- [ ] Same recall flow, `stopPropagation` prevents double-trigger (R2).

### Test 5 — Recall All Cascade
1. Spawn 3–4 Pokémon → `Alt+Shift+Backspace` (Remove all).
- [ ] Balls ripple with 150ms stagger (instant if `motion: reduced`), final `saveState` clears after 500ms.

### Test 6 — Unique Name Deduplication
1. Spawn `pikachu` named `Sparky` twice.
- [ ] Second becomes `Sparky-2` (no delete ambiguity).

### Test 7 — Party Cap (`maxPokemon`)
1. Set `maxPokemon: 2`, spawn 2 → try third via `spawn-pokemon`.
- [ ] Toast `Party is full (2) — recall first`, no spawn.

### Test 8 — Shiny Variants
1. Set `shinyOdds: 2` (50% for testing) → spawn 5.
- [ ] ~half shiny + `shiny-anim.gif` sparkle overlay (1.5s), then removed. Set back to 8192.

### Test 9 — Sizing (nano/small/medium/large)
1. Change `pokemonSize` per value.
- [ ] Sprite width scales (native ×1/1.5/2/2.5), speed scales (0.5×…1.25×), floor adapts.

### Test 10 — Roll-call & List
1. `Ctrl+Shift+P` → **Roll-call** → check toasts `emoji name (color type): hello`.
2. `Export pokemon list` → untitled JSON appears with `type,color,name,generation,originalSpriteSize`.

### Test 11 — Import/Export Round-trip
1. Export → copy JSON → Remove all → `Import pokemon list` → select saved JSON.
- [ ] Party restores, invalid `pool` entries warn in console, valid ones spawn; `normalizeColor` fixes bad colors.

### Test 12 — Persistence Across Reload
1. Spawn 2 at known positions, `Reload Window` (`Ctrl+R`).
- [ ] Same Pokémon at same `left/bottom`, same `States.stand*` labels recovered (B-2), friends re-linked.

### Test 13 — Localization
1. `Change Pokemon language` → `en-US` → pick `bulbasaur` → check label.
2. Set `pokemonLanguage: auto` → restart with different VS Code locale.
- [ ] Names translate, cache resets, `"None"` theme label localized via `bundle.l10n.*.json:35` (F-2).

### Test 14 — Motion & Debug
1. `motion: system` → toggle OS reduce-motion → panel pauses/resumes; `motion: reduced` → no drift/loop freeze; `motion: always` → animates even if OS says reduce.
2. `debug: true` → Console shows `[vscode-pokemon]` logs; `debug: false` silences.

---

## 2 — Background Scenes (6 themes + 5 phases)

### Test 15 — No Background Baseline
- Same as Test 1 — `theme: none` → plain panel, floor 0.

### Test 16 — Core Themes (forest/castle/beach)
For each `forest`, `castle`, `beach`:
- [ ] `background-${variant}-${size}.png` behind, `foreground-…` in front of feet, walk on raised floor (not floating), light/dark editor theme flips variant (Test 5 old).

### Test 17 — New Scenes (volcano/snow) — Phase 1
1. Settings → `Theme: volcano` then `snow`.
- [ ] `volcano`: ember sky, volcano cone, basalt+lava cracks.
- [ ] `snow`: pale sky, hills, pine on snow.
- [ ] All 16 PNGs per theme exist (`background+foreground × dark/light × 4 sizes`), no silent blank.

### Test 18 — Sizes × Themes Floor Tuning
1. For each theme × `nano/small/medium/large`:
- [ ] Correct resolution art, Pokémon on ground line (castle/large 120px visually verified — F-4).

### Test 19 — Theme Picker (Phase 2)
1. Explorer title bar → landscape icon → QuickPick `$(circle-slash) None` + `$(device-camera) t` (6 options, current marked `Current`).
2. Pick `beach` → Esc cancels → palette command `Select background theme`.
- [ ] Instant repaint (<1s), no restart, positions preserved, persists after reload, Esc leaves unchanged.

### Test 20 — Parallax Drift (Phase 3, volcano/snow only)
1. `snow` → watch 30s.
- [ ] Faint cloud/ember band drifts 90s linear infinite behind sprites.
2. `motion: reduced` → drift stops; `forest` → no midground, no broken img.
3. DevTools → `document.getElementById('midground').style.backgroundImage` → detects via `hasMidgroundAsset` cache (F-3 dynamic).

### Test 21 — Day/Night Cycle (Phase 4)
1. `theme: snow` + `dayNightCycle: true`.
- [ ] Stub hour: 23,2 → dark; 6,12 → light; overrides VS Code theme; `false` returns to color-theme behavior (`resolveSceneVariant` tests).
2. Wait 60s across hour boundary → `setInterval` repaints via `applySceneLayers`.

### Test 22 — Random Theme (Phase 5)
1. `randomTheme: true` → Reload.
- [ ] Random scene never `none`, stable across rebuilds (same session), cached in `globalState` (F-6) → no workspace collision; disable returns fixed `theme`.

### Test 23 — Live Switching & Bad Input
1. `forest → beach → none` live swaps without reload, positions kept.
2. `settings.json` → `"vscode-pokemon.theme": "underwater-the-movie"` → save.
- [ ] No crash, falls back to `none`.

### Test 24 — Panel Positions & Resizing
1. `position: panel` → editor tab renders scene; back to `explorer` → sidebar scene.
2. Drag divider narrow→wide.
- [ ] `repeat-x` tiles without gaps, Pokémon clamped inside (`resize` listener).

---

## 3 — Bug Fix Regressions (B/S/F validation)

| ID | Manual check |
|---|---|
| **B-1** | `git ls-files | grep dev_session` empty, file absent, `.gitignore:13` has it |
| **B-2** | Spawn → `standRight`/`standLeft` → reload → `resolveState` recovers exact label (src/panel/states.ts:432 `standRight`, 439 `standLeft`) |
| **S-1** | Settings UI search `throwBallWithMouse` → boolean toggle exists, default true, `click` respects it |
| **S-2** | Open/close panel 10× → DevTools Performance → `dayNightTimer` cleared (no leak), `stopAnimationLoop:158-165` nulls timer |
| **S-3** | `package.json` has no `browser` field |
| **F-1** | `media/backgrounds/volcano|snow/*.png` exist (procedural OK, hand-drawn swappable) |
| **F-2** | Picker shows `vscode.l10n.t('None')` correctly (en-US/en-GB bundles) |
| **F-3** | `volcano/snow` midground loads, `forest` does not, no hardcode required — `THEMES_WITH_MIDGROUND` kept with deprecation note |
| **F-4** | Castle/large visual check: Pokémon not too high (adjust `FLOOR_HEIGHTS` if needed) |
| **F-5** | `package.json` devDeps no `typescript-eslint@alpha`, only `@typescript-eslint/*@^5.29.0` |
| **F-6** | Two workspaces with `randomTheme: true` → each stable, no shared flicker (now `globalState`) |

---

## 4 — Edge, Stress & Integration

### Test 25 — Import Bad JSON
1. Import file with `[{"type":"charizard"}]` missing fields + invalid `type: "missingno"` + pool `["pikachu","fake"]`.
- [ ] Invalid `missingno` skipped with `console.warn`, `fake` warned, valid pool randomized from all.

### Test 26 — Max Party Stress (15)
1. `maxPokemon:15` → spawn 15 → observe loop.
- [ ] Single 100ms interval still, friend scan every 5 ticks, 30s save, no per-Pokémon timers.

### Test 27 — Visibility Pause/Resume
1. Hide panel (switch explorer tab) → `pause-pokemon` → show → `resume-pokemon`.
- [ ] Loop pauses (body `.pokemon-paused`), saves state on pause, resumes without duplicate timers.

### Test 28 — Reduced Motion cascade
1. `motion: reduced` + `remove-all-pokemon`.
- [ ] Stagger 0ms (instant), parallax frozen.

### Test 29 — CSP & Resource Loading
1. DevTools → Network → filter `background|foreground|pokemons`.
- [ ] All `asWebviewUri` with nonce, `img-src cspSource https:`, no `unsafe-inline` script, `localResourceRoots: media/` only.

---

## 5 — Performance & Modern Test Methods

**New methods beyond vitest/lint:**

| Method | How | Pass |
|---|---|---|
| **DevTools Performance** | Record 10s with 6 Pokémon + `snow` drift → CPU delta <2%, no layout thrash | ✅ |
| **Memory leak check** | Heap snapshot before/after 10 open/close cycles → `dayNightTimer` null, `loopTimer` single | ✅ |
| **Coverage gates** | `vitest --coverage --coverage.thresholds.lines=90` | ✅ |
| **Mutation testing** | `npx stryker run` (optional) → survive `holdTime` ±1 should fail | Informational |
| **Visual regression** | `npx playwright test` screenshot `media/backgrounds/*` (optional) | Informational |
| **Accessibility** | Axe in webview: `motion: reduced` honored, `prefers-reduced-motion` listener | ✅ |
| **E2E extension** | `@vscode/test-electron` launch + `vsce` package smoke: commands appear in palette | ✅ |

---

## 🏁 Result Matrix

| Passed | Verdict |
|---|---|
| Suites 0–5 all boxes | Fully working ✅ ship to `main` |
| Suites 0–2 only | Core + backgrounds OK, edge/bug fixes need work — note failed ID |
| Suite 2 Test 16 fails | Background pipeline broken — check 6 touch points (§3.1), recompile |
| Suite 0 fails | Toolchain broken — do not test manually |

**If something fails:**
1. Note suite/test number + screenshot.
2. Copy Console red errors + `npm run lint/compile/test` output tail.
3. Check `Features.md` §3/§5 for file to fix, recompile, F5 retry.

---

*Updated 2026-08-27 to reflect all changes from `BACKGROUND_BEAUTY.md` (Phases 1–5), `IMPLEMENTATION_PLAN.md` (R1,R2,R4), and `BUG_FIXES_PLAN.md` (B-1,B-2,S-1–3,F-1–6). Keep this file next to `Features.md` and `codebase_handbook.md`; update when adding themes, settings, or commands.*
