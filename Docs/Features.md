# 🎮 KNP Pokémon — Unified Implementation Documentation

> **Single-source reference combining `BACKGROUND_BEAUTY.md` + `IMPLEMENTATION_PLAN.md` + `BUG_FIXES_PLAN.md`**
> Covers every feature, change, and fix currently implemented in the codebase.

**Repo:** https://github.com/Cyberknp/KNP-pokemon  
**Package:** `knp-pokemon` v0.1.0 — `publisher: Cyberknp`  
**Engines:** VS Code `^1.73.0` · TypeScript · webpack (panel) + tsc (host) · vitest + jsdom  
**Status:** ✅ All core features implemented · Background Beauty Phases 1–5 shipped · All blockers fixed (PR #4)

---

## Table of Contents
1. [Overview & Licensing](#1-overview--licensing)
2. [Core Features (Implemented)](#2-core-features-implemented)
3. [Background Beauty — Scene System (Phases 1–5)](#3-background-beauty--scene-system-phases-15)
4. [Rebrand, Hover Recall & Extras](#4-rebrand-hover-recall--extras)
5. [Bug Fixes — Blockers & Follow-ups](#5-bug-fixes--blockers--follow-ups)
6. [Technical Architecture](#6-technical-architecture)
7. [Settings, Commands & Messaging](#7-settings-commands--messaging)
8. [Assets & Styling](#8-assets--styling)
9. [Development Workflow & Quality Gates](#9-development-workflow--quality-gates)
10. [Testing Checklist](#10-testing-checklist)
11. [File Map](#11-file-map)

---

## 1. Overview & Licensing

Personal-use Pokémon companion extension for VS Code (Gen 1–5, 728 sprites). Derived from `jakobhoeg/vscode-pokemon` (CC0) and inspired by `tonybaloney/vscode-pets`.

| Asset | License | Use |
|---|---|---|
| All source code | CC0 1.0 / MIT waiver (upstream) | ✅ Copy/modify/redistribute |
| Pokémon sprite GIFs (`media/genN/…`) | © The Pokémon Company / Nintendo / Game Freak | ⚠️ Fan use only, no commercial use |

README must include fan-project disclaimer and credits to Nintendo/TPC, `jakobhoeg`, and `tonybaloney/vscode-pets`. `package.json` declares `license: MIT` for code (image disclaimer to be added on rebrand).

---

## 2. Core Features (Implemented)

All items from `IMPLEMENTATION_PLAN §1` are shipped on `25082026_pokemon_extension_genesis` + optimization pass:

| Feature | Implementation |
|---|---|
| **Gen 1–5 registry** | `src/common/pokemon-gen1–5.ts` merged in `pokemon-data.ts` → `POKEMON_DATA` (728 entries, `id/name/generation/cry/possibleColors/originalSpriteSize`) |
| **Webview panel** | `pokemonView` in Explorer sidebar (`when: vscode-pokemon.position == 'explorer'`) + `PokemonPanel` editor-tab fallback |
| **Spawn** | `spawn-pokemon` → two-level QuickPick (generation folders → search) + custom name + shiny roll; `spawn-random-pokemon` instant |
| **Recall** | Single / all, Pokéball open/close animations (6-frame `pokeball_sprite_sheet.png`), fade/pop effects |
| **Throw ball + chase** | `throwBallWithMouse` flag threaded host→webview, `ChaseState` |
| **Shiny variants** | `maybeMakeShiny()` with `vscode-pokemon.shinyOdds` (default 8192) + sparkle overlay (`shiny-anim.gif`) |
| **Size scaling** | `PokemonSize nano/small/medium/large` → multiplier on `originalSpriteSize` |
| **Party cap** | `maxPokemon` (1–15, default 6), enforced in webview with toast |
| **Reduced motion** | `motion: system/always/reduced`, OS `prefers-reduced-motion` listener, pauses loop + parallax |
| **Debug logging** | `debug` flag, `log()` stripped in `compile:prod` (`drop_console`) |
| **Themes** | `none/forest/castle/beach/volcano/snow` (light+dark × 4 sizes) |
| **Persistence** | `globalState` mementos (`extra-pokemon.types/colors/names`, `setKeysForSync`) + webview `setState` (positions/state/friends), saved on spawn/recall/reset/pause + 30s safety net |
| **Import/Export** | JSON party backup via untitled doc / file picker, color normalization |
| **Localization** | `vscode.l10n` + `src/common/localize.ts` (`pokemon/{locale}/genN.json`, `pokemonLanguage: auto/en-US`) |
| **Animation loop** | Single `setInterval 100ms` (`ensureAnimationLoop`), friend scan every 5 ticks, pause/resume on visibility |
| **Quality** | ESLint strict, vitest 25 tests (states + backgrounds), `webpack` + `tsc` builds |

---

## 3. Background Beauty — Scene System (Phases 1–5)

### 3.1 Current Architecture (6 touch points)

| # | Touch point | File | Role |
|---|---|---|---|
| 1 | `Theme` enum | `src/common/types.ts:55` | `none, forest, castle, beach, volcano, snow` |
| 2 | `ALL_THEMES` | `src/common/types.ts:87` | Validation list |
| 3 | Setting declaration | `package.json` → `vscode-pokemon.theme` enum | Settings UI |
| 4 | Config read | `src/extension/extension.ts:74` `getConfiguredTheme()` + `DEFAULT_THEME` | Fallback to `none`; handles `randomTheme`/`dayNightCycle` |
| 5 | HTML injection | `src/extension/extension.ts:1427-1517` `_getHtmlForWebview` | `basePokemonUri/theme/themeKind/size` → `pokemonPanelApp()` |
| 6 | CSS application | `src/panel/main.ts:240-310` `applySceneLayers()` | Sets `body` + `#foreground` + `#midground` images, returns `floor` |

### 3.2 Layering (2.5D)

```
#foreground (z-index top)  ← foreground-${variant}-${size}.png  (transparent, bottom band)
Pokémon sprites (pokemonContainer) ← lifted by floor offset
body backgroundImage        ← background-${variant}-${size}.png  (sky/horizon)
#midground (parallax)      ← midground-${variant}-${size}.png   (optional, drift)
```

`media/pokemon.css:13-36` uses `repeat-x bottom left` tiling; images must tile horizontally.

### 3.3 Asset Contract

Every theme ships **16 PNGs** (+ optional 8 midgrounds):

```
media/backgrounds/<theme>/background-{dark|light}-{nano|small|medium|large}.png  (8)
media/backgrounds/<theme>/foreground-{dark|light}-{nano|small|medium|large}.png  (8)
media/backgrounds/<theme>/midground-{dark|light}-{nano|small|medium|large}.png  (8, volcano/snow only)
```

Missing file fails silently. Production generator: `scripts/generate-backgrounds.mjs` (deterministic, swap with hand-drawn art same names).

### 3.4 Floor Heights (`src/panel/main.ts:180-216`)

```ts
[Theme.forest]: { nano:23, small:30, medium:40, large:65 }
[Theme.castle]: { nano:45, small:60, medium:80, large:120 }
[Theme.beach]:  { nano:20, small:28, medium:36, large:56 }
[Theme.volcano]:{ nano:24, small:32, medium:40, large:64 }
[Theme.snow]:   { nano:24, small:32, medium:40, large:64 }
[Theme.none]:   {}
```

`calculateFloor(size, theme)` → 0 fallback. Tune by eye vs. foreground band.

### 3.5 Phase 1 — New Scenes (✅ Shipped)

Added `volcano` (crater sky, basalt) + `snow` (icy plain, pine) — assets + `Theme` enum + `ALL_THEMES` + `package.json` enum + `FLOOR_HEIGHTS`. Generic injection/URL builder requires no extra code; live-reload via `onDidChangeConfiguration`.

### 3.6 Phase 2 — In-Panel Theme Picker (✅ Shipped)

* Command `vscode-pokemon.select-theme` (`package.json` commands + `activationEvents` + `view/title` button `navigation@4`, icons `media/icon/dark-scene.svg`).
* Implementation `src/extension/extension.ts:1129-1157`: `ALL_THEMES.map` → `showQuickPick` (`$(circle-slash) None` / `$(device-camera) ${t}`), updates `theme` globally. Existing `onDidChangeConfiguration` listener repaints via `panel.updateTheme()+update()` automatically.

### 3.7 Phase 3 — Parallax Midground (✅ Shipped)

* HTML: `<div id="midground"></div>` between canvas and foreground.
* CSS: `animation: drift 90s linear infinite` on `background-position-x`, `pointer-events:none`, `z-index:5`.
* Logic `src/panel/main.ts:32-61,237-280`: `midgroundCache` + `hasMidgroundAsset()` feature-detects via `Image` load; `applySceneLayers()` sets/clears `midgroundEl.style.backgroundImage`; `THEMES_WITH_MIDGROUND` kept for tests/back-compat but runtime is dynamic; paused when `motionReduced` or panel hidden.

### 3.8 Phase 4 — Day/Night Auto-Switching (✅ Shipped)

* Setting `vscode-pokemon.dayNightCycle` boolean (default `false`).
* `resolveSceneVariant(themeKind, dayNightCycle, hour)` (`main.ts:226-235`): if `dayNightCycle` then `hour>=19||hour<6 ? dark : light` else `themeKind===dark ? dark : light`.
* Threaded via `extension.ts:1491-1517` options → `main.ts:696,708`; `startDayNightCycle()` sets 60s interval, clears on theme change / `stopAnimationLoop()`, repaints via `applySceneLayers`.

### 3.9 Phase 5 — Random Theme Rotation (✅ Shipped)

* Setting `vscode-pokemon.randomTheme` boolean (default `false`).
* `getConfiguredTheme()` (`extension.ts:74-96`): when enabled, `Math.random` over `ALL_THEMES.filter(t!==none)`, cached in `context.globalState` (`RANDOM_THEME_CACHE_KEY`) so reloads don't flicker. Uses `globalState` (fix F-6) for stable per-session cache.

---

## 4. Rebrand, Hover Recall & Extras

### Phase R1 — Rebrand & Legal (✅ Done)
`package.json`: `name: knp-pokemon`, `displayName: KNP Pokémon`, `publisher: Cyberknp`, `repository/homepage/bugs → Cyberknp/KNP-pokemon`, `version 0.1.0`. README credits block added. `.vscodeignore` excludes sources/tests/node_modules.

### Phase R2 — Hover Pokéball Click-to-Recall (✅ Done)
`src/panel/main.ts:386-404` inside `addPokemonToPanel()`: creates `div.pokeball-hover` inside `collision` (inherits `:hover`), `click` → `removePokemonFromPanel({name})` with `stopPropagation`. Respects party cap/reduced-motion via existing flows.

### Phase R4 — Optional Extras (Implemented vs. Pending)

| Item | Status |
|---|---|
| Remaining Gen 5 sprites (PokeAPI `generation-v/black-white/animated` → `{name}_{anim}_8fps.gif`) | ⬜ Pending |
| Asset compression `npm run optimize-assets` (gifsicle / pngquant) | ✅ Script ready |
| Recall-all cascade stagger 150ms (`reset-pokemon` → `setTimeout` per index) | ✅ Done (`main.ts:850-874`, respects `motionReduced`) |
| Unique instance IDs (name-based today → suffix `-2`, `-3` dedup in `addPokemonToPanel:354-358`) | ✅ Done |
| Cries/sounds (`cry` field in registry) | ⬜ Pending (off by default) |
| Drag & drop repositioning | ⬜ Pending |
| CI (`npm ci && lint && compile && test`) | ⬜ Pending |

---

## 5. Bug Fixes — Blockers & Follow-ups

All items from `BUG_FIXES_PLAN.md` are now **fixed and verified** (`npm run lint 0 errors`, `npm run compile` success, `npm test 25 passed`).

### 🔴 Blockers

| ID | File | Fix | Status |
|---|---|---|---|
| **B-1** `dev_session.md` leaks to `main` | `.gitignore:13` + `git rm --cached` | Added `dev_session.md` to `.gitignore`, untracked (5,479 lines removed) | ✅ |
| **B-2** `StandLeftState` label typo | `src/panel/states.ts:439` `States.standRight→standLeft` + regressed `StandRightState:432` `standLeft→standRight` | Both stand states now correct, persistence/recovery works | ✅ |

### 🟡 Should-Fix (Post-Merge)

| ID | File | Fix | Status |
|---|---|---|---|
| **S-1** `throwBallWithMouse` invisible | `package.json:232-236` declare `vscode-pokemon.throwBallWithMouse` bool default `true` | Appears in Settings UI | ✅ |
| **S-2** `dayNightTimer` leak | `src/panel/main.ts:158-165` `stopAnimationLoop()` clears `dayNightTimer`, `unload` listener | No leak on webview destroy | ✅ |
| **S-3** Dead `browser` field | `package.json:49` removed `"browser": "./dist/web/extension-web.js"` | Clean manifest | ✅ |

### 🟡 Follow-up

| ID | File | Fix | Status |
|---|---|---|---|
| **F-1** Hand-drawn art | `media/backgrounds/{volcano,snow}/*.png` procedural via `scripts/generate-backgrounds.mjs` | ✅ Placeholder done; swap with hand-drawn same filenames when ready | ✅ |
| **F-2** Localize `None` | `src/extension/extension.ts:1138` + `l10n/bundle.l10n.en-US/Gb.json:35` `"None":"None"` | ✅ |
| **F-3** Hardcoded `THEMES_WITH_MIDGROUND` | `src/common/types.ts:100` + `src/panel/main.ts:34-61` dynamic `hasMidgroundAsset()` (`Image` load + `midgroundCache`) | Runtime detection; constant kept with deprecation note for tests | ✅ |
| **F-4** `castle/large` floor 120px | `src/panel/main.ts:192` | Manual Dev Host visual test pending | ⬜ Visual check needed |
| **F-5** Bad dep `typescript-eslint@^0.0.1-alpha.0` | `package.json:303` `npm uninstall typescript-eslint` | Removed (keep `@typescript-eslint/*@^5.29.0`) | ✅ |
| **F-6** `randomTheme` workspace collision | `src/extension/extension.ts:36,485` `workspaceState→globalState` | `globalState` cache, no multi-workspace collision | ✅ |

**Verification Checklist (all green):**
- [x] `dev_session.md` untracked + ignored
- [x] `Stand*State.label` correct
- [x] `throwBallWithMouse` in Settings
- [x] No timer leak (open/close panel)
- [x] No `browser` field
- [x] `npm test` 25 passed
- [x] `npm run lint` 0 errors (4 pre-existing warnings)
- [x] `npm run compile` passes

Execution order (for reference):
```bash
git rm --cached dev_session.md && echo "dev_session.md" >> .gitignore
# fix states.ts labels, package.json settings/browser/dep, main.ts timer, extension.ts globalState
npm run lint && npm run compile && npm test && git push origin develop
```

---

## 6. Technical Architecture

**Two worlds, one contract:**

| World | Runtime | Code | Talk |
|---|---|---|---|
| Extension Host (Node) | VS Code process | `src/extension/` | `postMessage({command})` |
| Webview (Chromium iframe) | Sidebar | `src/panel/` | shared `src/common` types |

**Rendering:** Absolutely-positioned `<img>` GIFs (`image-rendering:pixelated`), one shared 100ms loop (`ensureAnimationLoop`/`pauseAnimationLoop`/`stopAnimationLoop` in `main.ts:115-167`). Never per-Pokémon timers. Friend scan O(n²) every 5 ticks; position save every 30s; canvas + resize clamping.

**State machine:** `src/panel/states.ts` — `States` enum, `FrameResult`, `resolveState()`, `AbstractStaticState` (holdTime) + `Walk/Run/Chase/ChaseFriend/Climb/Jump` classes. Transitions via `ISequenceTree` in `pokemon.ts`/`base-pokemon-type.ts`.

**Base class:** `BasePokemonType` — owns sprite element, `left/bottom`, `calculateSpriteWidth()`, ±30% speed randomization × size (nano 0.5×…large 1.25×), `faceLeft/faceRight` + `setAnimation()` swapping `${root}_{anim}_8fps.gif` (flips if no `left_facing` art), `nextFrame()` → friend chase → state tick → `resolveState`, `swipe()/chase()`, friend bubble.

**Concrete:** `Pokemon` (`pokemon.ts`) → Pokédex lookup + sequence tree (`idle⇄walk`, `swipe→idle`) + `POKEMON_NAMES`. `PokemonCollection` (`pokemon-collection.ts`) → `PokemonElement` + `locate/remove/seekNewFriends()` (overlap → mutual `_friend`).

**Panel:** `PokemonWebviewContainer` → `PokemonPanel` (editor tab singleton) / `PokemonWebviewViewProvider` (sidebar) share `postMessage` wrappers + `_getHtmlForWebview()` (CSP nonce, `localResourceRoots: media/`, `Silkscreen` font, `main-bundle.js` → `pokemonPanelApp(...)`).

**Registry:** `pokemon-gen1–5.ts` → `pokemon-data.ts` (`getAllPokemon`, `getPokemonByGeneration`, `getRandomPokemonConfig[From]`).

**Localization:** `localize.ts` loads `l10n/pokemon/{locale}/genN.json` per `pokemonLanguage`/`VS Code locale`.

**Security:** CSP nonce + `asWebviewUri()`.

---

## 7. Settings, Commands & Messaging

### 7.1 Settings (`vscode-pokemon.*`)

| Setting | Type | Default | Description |
|---|---|---|---|
| `pokemonSize` | `nano/small/medium/large` | `medium` | Sprite scale |
| `position` | `panel/explorer` | `explorer` | Panel location (`setContext`) |
| `theme` | `none/forest/castle/beach/volcano/snow` | `none` | Scene |
| `dayNightCycle` | boolean | `false` | Dark 7PM–6AM else light (overrides `themeKind`) |
| `randomTheme` | boolean | `false` | Random scene per session (globalState cached) |
| `throwBallWithMouse` | boolean | `true` | Click Pokémon to recall (S-1) |
| `defaultPokemon` | array `{type,name?,shiny?,pool?}` | `[]` | Auto-spawn; `type:random` + pool |
| `shinyOdds` | number ≥1 | `8192` | 1-in-N shiny |
| `pokemonLanguage` | `auto/en-US` | `auto` | Name locale |
| `maxPokemon` | 1–15 | `6` | Party cap |
| `motion` | `system/always/reduced` | `system` | Honor OS reduced-motion |
| `debug` | boolean | `false` | Webview logs (stripped in prod) |

### 7.2 Commands

| Command | Keybinding | Action |
|---|---|---|
| `vscode-pokemon.start` | — | Focus sidebar or create panel |
| `spawn-pokemon` | `Alt+Shift+W` | QuickPick type |
| `spawn-random-pokemon` | `Alt+Shift+Q` | Random |
| `delete-pokemon` | `Alt+Shift+D` | Pick one to recall |
| `remove-all-pokemon` | `Alt+Shift+Backspace` | Cascade recall |
| `roll-call` | — | Greeting toasts |
| `select-theme` | title bar (explorer) | Scene QuickPick (Phase 2) |
| `export-pokemon-list` / `import-pokemon-list` | — | JSON backup |
| `configure-keybindings` / `change-pokemon-language` | — | UX helpers |

### 7.3 Messaging

**Host → Webview:** `spawn-pokemon` (type/color/name/gen/size), `spawn-random-pokemon`, `delete-pokemon {name}`, `reset-pokemon`, `list-pokemon`, `roll-call`, `pause-pokemon`/`resume-pokemon`, `throw-with-mouse`, `set-size`, `throw-ball`.  
**Webview → Host:** `info` / `alert` / `error` toasts, `list-pokemon` reply (`type,name,color` lines).

---

## 8. Assets & Styling

```
media/
  main-bundle.js (webpack → pokemonApp global)
  pokemon.css / reset.css / Silkscreen-Regular.ttf
  pokeball_sprite_sheet.png / shiny-anim.gif / heart.png
  icon/{dark,light}-{add,trash,random,scene}.svg
  backgrounds/<theme>/background|foreground|midground-{dark|light}-{nano|small|medium|large}.png
  gen1..gen5/<pokemon>/<color>/{name}_{idle|walk|walk_left|walk_fast|run|...}_8fps.gif
```

`pokemon.css`: `body` theme bg, `#foreground` overlay, `#midground` drift 90s, `#pokemonCanvas` hidden, `img.pokemon` pixelated, `.collision` z999 hover zone, `.bubble` sizes, `.pokeball-sprite` steps(6), `spawn-pop`/`shiny-sparkle`/`fade-out` keyframes, `.pokemon-paused` / `.pokemon-reduced-motion`.

---

## 9. Development Workflow & Quality Gates

```bash
npm install
npm run compile          # webpack + tsc
npm run compile:prod     # minified, drop_console (prepublish)
npm run watch            # tsc -watch
npm run lint             # ESLint src --ext ts
npm run lint:fix
npm test                 # vitest run (jsdom)
npm run optimize-assets  # gifsicle -O3 --lossy=80 + pngquant
npx @vscode/vsce package && code --install-extension knp-pokemon-0.1.0.vsix
```

**Build:** `webpack.config.js` → `media/main-bundle.js`; `tsconfig.extension.json` → `out/` (CommonJS). Production: Terser minify.

---

## 10. Testing Checklist

**Themes (Phase 1):** 16 PNGs/theme exist, Settings enum, correct size art, light+dark variants, floor tuned (not floating), garbage fallback → `none`, `npm test` green.  
**Picker (Phase 2):** Palette + title button, instant repaint no reload, Esc preserves, survives restart.  
**Parallax (Phase 3):** Drift <2% CPU, `motion:reduced` freezes, missing midground graceful.  
**Day/Night (Phase 4):** Hour boundaries (19/6) flip, `false` preserves old behavior.  
**Random (Phase 5):** Never `none`, stable across webview rebuilds.  
**Bug fixes:** All 8 checklist items above.

---

## 11. File Map

| Path | Role |
|---|---|
| `package.json` | Manifest, commands, keybindings, settings (incl. volcano/snow/dayNight/random/throwBall), scripts, no `browser` field |
| `src/common/types.ts` | `Theme/Size/Color/ExtPosition`, `ALL_*`, `THEMES_WITH_MIDGROUND` (dynamic note) |
| `src/common/pokemon-data.ts` + `pokemon-gen1–5.ts` | Registry + helpers |
| `src/common/localize.ts` / `names.ts` | Translations / `randomName()` |
| `src/extension/extension.ts` | `getConfigured*`, `PokemonSpecification`, `activate()` (commands + config listener + serializer), `PokemonWebviewContainer` / `PokemonPanel` / `PokemonWebviewViewProvider` (uses `globalState` for random theme) |
| `src/panel/main.ts` | Single loop, `FLOOR_HEIGHTS`, `hasMidgroundAsset`/`applySceneLayers`/`startDayNightCycle`, `add/removePokemon`, `save/recoverState`, `pokemonPanelApp`, resize/canvas |
| `src/panel/states.ts` | State machine (`StandRight/Left` labels corrected) |
| `src/panel/base-pokemon-type.ts` / `pokemon.ts` / `pokemon-collection.ts` / `sequences.ts` | Pokémon classes & collection |
| `media/pokemon.css` | All panel styling + parallax + animations |
| `l10n/bundle.l10n.*.json` | `"None":"None"` included |
| `scripts/generate-backgrounds.mjs` | Procedural background generator |
| `tests/states.test.ts` / `backgrounds.test.ts` | 25 tests |
| `Docs/` | This file + `codebase_handbook.md` / original plans archived |

---

*This document is the authoritative inventory of implemented functionality. Update it when adding themes, settings, commands, or fixing bugs.*
