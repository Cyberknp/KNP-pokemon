# 📖 KNP Pokémon — Codebase Handbook

**A complete, plain-language guide to every file and piece of code in this repository.**

> This extension adds live Pokémon companions to VS Code. Pokémon appear as animated pixel-art sprites in a webview panel, walk around, interact with each other, and can be released/recalled with Pokéball animations.
>
> **Current snapshot (2026-08-27):** `knp-pokemon` v0.1.0 (`publisher: Cyberknp`), 6 background scenes (`none/forest/castle/beach/volcano/snow`), 728 sprites (Gen 1–5), 25 vitest tests, all Background Beauty phases 1–5 shipped, all BUG_FIXES_PLAN blockers fixed. This handbook reflects that state.
>
> **How to read this document:** Section 1 explains the big picture first. Sections 2–6 then go file-by-file. Sections 7–9 are reference tables you can consult anytime. Section 10 lists what changed to get here.

---

## Table of Contents

1. [The Big Picture](#1-the-big-picture)
2. [Root & Config Files](#2-root--config-files)
3. [`src/common/` — Shared Code](#3-srccommon--shared-code)
4. [`src/extension/` — The Extension Host](#4-srcextension--the-extension-host)
5. [`src/panel/` — The Webview UI](#5-srcpanel--the-webview-ui)
6. [`tests/` & `scripts/`](#6-tests--scripts)
7. [`media/` — Assets & Styling](#7-media--assets--styling)
8. [`l10n/` — Translations](#8-l10n--translations)
9. [Reference: Messages, Commands, Settings](#9-reference-tables)
10. [Recent Changes (What Was Fixed)](#10-recent-changes)

---

## 1. The Big Picture

### 1.1 The two halves of a VS Code extension

A VS Code extension that shows graphics runs in two separate worlds:

| World | Where it runs | What it does here | Code folder |
|---|---|---|---|
| **Extension Host** (Node.js) | Inside VS Code's main process | Registers commands, reads settings, remembers your party between restarts, builds the panel's HTML page | `src/extension/` |
| **Webview** (a sandboxed browser page) | A hidden Chromium iframe in the sidebar | Shows the sprites, animates them, handles clicks/hovers | `src/panel/` |

These two halves **cannot call each other's functions directly**. They talk by passing JSON messages back and forth using `postMessage`. The shared vocabulary for those messages lives in `src/common/`.

### 1.2 How a Pokémon appears on screen (life of a spawn)

```
You press Alt+Shift+W  (or click the sidebar ➕ icon)
        │
        ▼
EXTENSION HOST (extension.ts)
  QuickPick asks which Pokémon → creates a PokemonSpecification
  (type, color, name, generation, originalSpriteSize)
        │  postMessage({ command: 'spawn-pokemon', … })
        ▼
WEBVIEW (main.ts)
  Receives message → checks party cap → addPokemonToPanel()
        │
        ├─ creates 3 DOM elements: <img> sprite, collision box, speech bubble
        ├─ unique-name guard: Sparky → Sparky-2 if needed
        ├─ createPokemon() (pokemon-collection.ts) → new Pokemon() (pokemon.ts)
        │    └─ BasePokemonType constructor sets position, speed, starting state
        ├─ hover-to-swipe + hover Pokéball button bound to this collision box
        ├─ plays the Pokéball-open animation
        └─ after ~70% of the animation, reveals the sprite with a "spawn-pop"
        │
        ▼
GAME LOOP (one shared setInterval, 100 ms)
  Every tick : every Pokémon's state.nextFrame() moves it one step
  Every 5th tick: seekNewFriends() checks for overlapping friends
  Every 30 s : saveState() persists positions
```

### 1.3 How movement works

Each Pokémon is a small **state machine**. At any moment it is in exactly one *state*
(`sitIdle`, `walkLeft`, `climbWallLeft`, `chase`, `standLeft`, …). Every 100 ms the loop calls
`nextFrame()` on the current state object, which either:
- returns `stateContinue` (keep doing this), or
- returns `stateComplete` (pick a random next state from the sequence tree), or
- returns `stateCancel` (abnormal exit, e.g. ball already caught).

Changing the state changes which GIF file the sprite `<img>` points at
(`{name}_{animation}_8fps.gif`), so the visible animation follows the logic automatically.
`StandRightState`/`StandLeftState` labels were fixed in 2026-08 to `stand-right`/`stand-left` so persistence round-trips correctly.

### 1.4 How backgrounds work (the 2.5D sandwich)

Scenes are not one image — they are **up to three stacked layers** that sandwich the sprites:

```
#foreground (z top)              ← foreground-${variant}-${size}.png  (transparent, bottom band)
Pokémon sprites (pokemonContainer) ← lifted by floor offset (FLOOR_HEIGHTS)
#midground (parallax, optional)   ← midground-${variant}-${size}.png (volcano/snow, drift)
body backgroundImage              ← background-${variant}-${size}.png  (sky/horizon)
```

`applySceneLayers()` in `main.ts` paints all three, `resolveSceneVariant()` picks `dark` vs `light`, `hasMidgroundAsset()` feature-detects the mid layer at runtime.

---

## 2. Root & Config Files

### `package.json`
The manifest — everything VS Code needs to know about the extension.

Key parts (current as of 2026-08-27):
- **`name: knp-pokemon`, `displayName: KNP Pokémon`, `publisher: Cyberknp`, `version: 0.1.0`**, `repository/homepage/bugs → Cyberknp/KNP-pokemon` (rebrand R1 done).
- **`main: "./out/extension/extension.js"`** — Node host entry after `tsc`.
- **`browser` field removed** (was dead `./dist/web/extension-web.js` — fix S-3).
- **`activationEvents`** — `onStartupFinished` + all commands + `onWebviewPanel:pokemonCoding`/`onView:pokemonView`.
- **`contributes.views`** — `pokemonView` webview in Explorer, shown when `vscode-pokemon.position == 'explorer'`.
- **`contributes.commands`** — `start`, `spawn-pokemon`, `spawn-random-pokemon`, `delete-pokemon`, `remove-all-pokemon`, `roll-call`, `export/import-pokemon-list`, `configure-keybindings`, `change-pokemon-language`, **`select-theme`** (new Phase 2, title-bar landscape icon `media/icon/dark-scene.svg`).
- **`contributes.menus.view/title`** — 4 title-bar buttons for the sidebar view, `select-theme` is `navigation@4`.
- **`contributes.keybindings`** — `Alt+Shift+W` spawn, `Alt+Shift+Q` spawn-random, `Alt+Shift+D` delete, `Alt+Shift+Backspace` remove-all.
- **`contributes.configuration`** — 11 settings (see §9.3): `pokemonSize`, `position`, `theme` (now 6 values `none/forest/castle/beach/volcano/snow`), **`dayNightCycle`** (Phase 4), **`randomTheme`** (Phase 5), **`throwBallWithMouse`** (S-1, now visible), `defaultPokemon`, `shinyOdds`, `pokemonLanguage`, `maxPokemon`, `motion`, `debug`.
- **Scripts:**

| Script | What it does |
|---|---|
| `compile` | webpack dev bundle + tsc host compile |
| `compile:prod` | same but minified with all `console.*` stripped |
| `watch` | recompiles on save during development |
| `lint` / `lint:fix` | ESLint over `src/` (4 pre-existing `any` warnings) |
| `test` | vitest 25 tests (jsdom) |
| `optimize-assets` | recompresses every GIF via gifsicle |

### `webpack.config.js`
Bundles the entire webview side (`src/panel/main.ts` + everything it imports) into **one file: `media/main-bundle.js`**, exposed as the global object `pokemonApp` so an inline `<script>` in the HTML can call into it.
- Development mode (default): inline source maps for debugging.
- `NODE_ENV=production`: minified via Terser with `drop_console: true`.

### `tsconfig.json` / `tsconfig.extension.json` / `tsconfig.panel.json`
Three TypeScript configs sharing one repo:
- `tsconfig.json` — base; used by ESLint for type information.
- `tsconfig.extension.json` — compiles the host to CommonJS in `out/`; excludes panel/test folders.
- `tsconfig.panel.json` — compiles the webview bundle through ts-loader (browser-style target).

### `.eslintrc.json`
Lint rules: `no-var`, `prefer-const`, `radix`, `eqeqeq`, naming conventions, no unused imports. Run with `npm run lint`.

### `vitest.config.ts`
Unit-test setup: jsdom environment (simulates a browser so DOM-touching code can be tested), test files live in `tests/`.

### `.vscodeignore` / `.gitignore`
- `.vscodeignore` keeps sources, tests, configs out of the packaged `.vsix` (only compiled output + media ship).
- `.gitignore` excludes `node_modules`, build outputs, the generated `media/main-bundle.js`, and **`dev_session.md`** (added 2026-08, fix B-1 — was a 5,479-line log).

### `.vscode/`
Editor conveniences: `launch.json` ("Run Extension" → F5 opens a clean VS Code window with your extension loaded), `tasks.json` (build tasks), recommended extensions.

### `LICENSE`, `README.md`, `icon.png`
Standard repo furniture. ⚠️ Licensing note: code license applies to **code only** — the sprite GIFs remain © Nintendo/The Pokémon Company (fan-use disclaimer required).

---

## 3. `src/common/` — Shared Code

Code here is imported by **both** the host and the webview.

### `src/common/types.ts` — the shared vocabulary

Every concept both sides need to agree on:

| Export | Meaning |
|---|---|
| `PokemonColor` | `default` or `shiny` (plus internal `null`) |
| `PokemonGeneration` | Enum `Gen1`…`Gen5` (numeric values 1–5) |
| `PokemonType` | A string that must be a key of the registry (e.g. `'pikachu'`) |
| `PokemonConfig` | One registry entry: `id`, `name`, `generation`, `cry`, `possibleColors`, `originalSpriteSize`, `extraSprites` |
| `PokemonExtraSprite` | Optional extra art, currently `left_facing` |
| `PokemonSpeed` | Numeric speeds `still`(0) … `veryFast`(5) |
| `PokemonSize` | `nano` / `small` / `medium` / `large` |
| `ExtPosition` | Where the panel lives: `panel` or `explorer` |
| `Theme` | Backgrounds: `none` / `forest` / `castle` / `beach` / **`volcano` / `snow`** (added Phase 1) |
| `ColorThemeKind` | VS Code theme: light / dark / high contrast |
| `WebviewMessage` | The `{ text, command }` envelope for messages |
| `ALL_COLORS`, `ALL_SCALES`, `ALL_THEMES` | Validation lists used when reading settings (now 6 themes) |
| `THEMES_WITH_MIDGROUND` | `ReadonlyArray<Theme>` = `[volcano, snow]` — kept for tests/back-compat; **runtime availability is now dynamically detected** via `hasMidgroundAsset()` in `main.ts` (fix F-3) instead of relying on this list |

### `src/common/pokemon-data.ts` (+ `pokemon-gen1.ts` … `pokemon-gen5.ts`) — the Pokédex

- **`pokemon-genN.ts`** (5 files) — each exports `GENn_POKEMON`, a plain record of every Gen-N Pokémon: dex number, display name, cry, available colors, original sprite pixel size, and whether left-facing art exists. Together they hold **728 entries**.
- **`pokemon-data.ts`** merges them with spread operators into `POKEMON_DATA_RAW`, filters out entries with empty `possibleColors` into the exported `POKEMON_DATA`, and provides helper functions:

| Function | Purpose |
|---|---|
| `getAllPokemon()` | Every valid type key as an array |
| `getPokemonByGeneration(n)` | Type keys belonging to one generation |
| `getDefaultPokemon()` | `'bulbasaur'` — the safe fallback |
| `getRandomPokemonConfig()` / `...From(types)` | Pick a random entry (optionally from a limited pool) |

The split into per-generation files exists so future code can lazy-load generations independently without changing any caller.

### `src/common/localize.ts` — translated Pokémon names

Loads optional translation dictionaries from `l10n/pokemon/{locale}/gen{1-5}.json`.
Flow: read the `vscode-pokemon.pokemonLanguage` setting (or fall back to VS Code's own locale) → find the matching folder → merge all five gen JSON files into a cache keyed by locale → `getLocalizedPokemonName(type)` returns the translation, falling back to the English name in `POKEMON_DATA`.
Also contains `resetPokemonTranslationsCache()` (called when the user changes language) and QuickPick-item helpers.

### `src/common/names.ts` — pet names

One function, `randomName()`: picks a random pet-style name ('Bella', 'Zeus', 'Pixel'…) from the big list defined in `src/panel/pokemon.ts`. Used whenever a spawn doesn't provide a name.

---

## 4. `src/extension/` — The Extension Host

### `src/extension/extension.ts` (the largest file, ~1,850 lines)

Everything that runs on the Node side. Major pieces, top to bottom:

#### 4.1 Settings readers (top of file)
Small functions that each read one `vscode-pokemon.*` setting and sanitize it:
`getConfiguredSize()`, **`getConfiguredTheme()`** (now handles `randomTheme` via `globalState` + fallback), `getConfiguredThemeKind()`, `getConfigurationPosition()`, `getThrowWithMouseConfiguration()`, `getConfiguredShinyOdds()`, `getConfiguredDebug()`, `getConfiguredMaxPokemon()`, `getConfiguredMotion()`, **`getConfiguredDayNightCycle()`** (Phase 4).
Also `maybeMakeShiny(colors)` — rolls the shiny dice (1-in-N odds) when a color isn't forced.

`getConfiguredTheme()` detail (Phases 5 + fix F-6):
```ts
if (randomTheme && extensionState) {
  const cached = extensionState.get<Theme>(RANDOM_THEME_CACHE_KEY);
  if (cached && ALL_THEMES.includes(cached)) return cached;
  const picked = scenes[Math.floor(Math.random()*scenes.length)]; // never 'none'
  void extensionState.update(RANDOM_THEME_CACHE_KEY, picked);
  return picked;
}
```
`extensionState` is now `context.globalState` (was `workspaceState` — fix F-6 workspace collision). `RANDOM_THEME_CACHE_KEY = 'vscode-pokemon.random-theme-cache'`.

#### 4.2 `resolveRandomPokemonType(pool?)`
Resolves the special `'random'` entry in `defaultPokemon` settings to a concrete species, optionally restricted to a user-provided pool; warns about invalid pool entries.

#### 4.3 `PokemonSpecification`
A plain description of one companion (color, type, size, name, generation string like `"gen2"`, original sprite size). It has three constructors:
- `fromConfiguration()` — from the legacy single-Pokémon settings.
- `collectionFromMemento(context)` — restores the saved party from global storage (three parallel arrays: types, colors, names, stored under keys `vscode-pokemon.extra-pokemon.types/colors/names`). These keys are registered for Settings Sync.
- `storeCollectionAsMemento(...)` — writes the party back.

This is how your team survives VS Code restarts.

#### 4.4 `activate(context)` — the entry point
Runs once at startup. Registers, in order:
1. `vscode-pokemon.start` — focuses the sidebar view (explorer mode) or creates the editor panel. Now sets `extensionState = context.globalState`.
2. Status-bar 🐿️ button + listeners that keep it visible.
3. The webview view provider (`registerWebviewViewProvider`).
4. All other commands:
   - **delete-pokemon** — asks the webview for its current list, shows a QuickPick of companions, deletes the chosen one, updates stored roster.
   - **remove-all-pokemon** — resets everything and clears storage (webview does cascaded `reset-pokemon`).
   - **roll-call** — every companion posts a greeting notification.
   - **configure-keybindings** — opens VS Code's keybinding editor pre-filtered to a chosen command.
   - **change-pokemon-language** — QuickPick of locales; persists choice and resets the translation cache.
   - **export-pokemon-list** — writes the party as pretty-printed JSON into a new untitled document.
   - **import-pokemon-list** — reads such a JSON file, validates colors, spawns everyone, saves roster.
   - **spawn-pokemon** — a two-level dynamic QuickPick: shows generation folders by default; typing filters across *all* Pokémon instantly. After picking: optional custom name → shiny roll → spawn → persist.
   - **spawn-random-pokemon** — instant random spawn.
   - **`select-theme`** (Phase 2, `extension.ts:1126-1157`) — `ALL_THEMES.map(t => { label: t===none ? '$(circle-slash) None' : '$(device-camera) '+l10n.t(t), value:t, description: t===current ? 'Current':undefined })` → `showQuickPick` → `config.update('theme', pick.value, Global)`. Because the config listener already watches `theme`, the panel repaints automatically.
5. A **configuration-change listener** (now watches `pokemonColor/pokemonType/pokemonSize/theme/randomTheme/dayNightCycle/workbench.colorTheme` → `panel.updatePokemonColor/Size/Type + panel.updateTheme + panel.update()`; plus `position` → context, `throwBallWithMouse` → `updatePanelThrowWithMouse()`, `pokemonLanguage` → cache reset).
6. A **webview panel serializer** so even editor-mode panels survive window reloads.

#### 4.5 `IPokemonPanel` interface + `PokemonWebviewContainer` base class
An interface listing everything a panel must do (spawn/delete/reset/list/roll-call/update-theme…), and an abstract implementation that owns the shared logic:
- Wrappers that just `postMessage` a command to the webview (`spawnPokemon`, `deletePokemon`, `setThrowWithMouse`, …).
- `_getHtmlForWebview(webview)` — **builds the panel's HTML page**: links the CSS files, embeds the Silkscreen pixel font, sets a strict Content-Security-Policy with a per-render random nonce, loads `media/main-bundle.js`, then boots the app with an inline script calling `pokemonApp.pokemonPanelApp(...)` passing the resource URI, theme info, and an options object (`debug`, `maxPokemon`, `motion`, **`dayNightCycle`**).
- `updateTheme(newTheme, themeKind)` and `setThrowWithMouse()` now part of the lifecycle.

#### 4.6 Two concrete panels
- **`PokemonPanel`** — a full editor tab (like a file). Singleton (`currentPanel`). On visibility change it sends `pause/resume` messages instead of rebuilding (cheap show/hide).
- **`PokemonWebviewViewProvider`** — the Explorer-sidebar view (the default). Implements `resolveWebviewView()`: builds HTML once, wires pause/resume on visibility, spawns the saved/default party on first reveal.

Both share message handling via `handleWebviewMessage`, which turns webview messages into notifications: `alert` → error toast, `info` → information toast.

#### 4.7 Utilities
`getNonce()` (random CSP token), `createPokemonPlayground()` (fallback that opens the editor panel when a command is used with no panel open), `waitForPokemonList()` (promise that resolves when the webview answers a `list-pokemon` request).

---

## 5. `src/panel/` — The Webview UI

All of this gets bundled into `media/main-bundle.js` and runs inside the webview page.

### 5.1 `src/panel/main.ts` — the application core (~904 lines)

The bootstrap file. Everything below is in this one file:

**Global state**
- `allPokemon` — the live collection of on-screen Pokémon.
- `pokemonCounter` — bookkeeping counter persisted with state (normalized via `normalizePokemonCounter`).
- `debugEnabled`, `motionReduced`, `activeStateApi` — runtime flags.
- **`midgroundCache`** (`Map<string, boolean>`) and **`hasMidgroundAsset()`** (Phase 3, `main.ts:32-61`) — dynamic `Image` onload/onerror probe for `midground-${variant}-${size}.png`, cached by `${theme}/${variant}/${size}`.
- **`midgroundEl`** (`#midground` div, Phase 3) and **`dayNightTimer`** (`setInterval`, Phase 4).

**Debug logging**
`log(...)` prints to the console only when `vscode-pokemon.debug` is true (and production builds strip console output entirely).

**The single animation loop** (performance-critical)
- `ensureAnimationLoop(stateApi)` starts **one** `setInterval` at 100 ms for the whole app:
  - every tick → `nextFrame()` for each Pokémon;
  - every 5th tick → `seekNewFriends()`;
  - every 30 s → `saveState()` safety net;
- `pauseAnimationLoop()` / **`stopAnimationLoop()`** (`main.ts:148-167`) — pause clears `loopTimer` + adds `pokemon-paused`; **stop also clears `dayNightTimer` and nulls it + removes `activeStateApi` + `unload` listener** (fix S-2 timer leak).

**Reduced motion**
`prefersReducedMotion(setting)` honors the OS "reduce motion" preference (when the setting is `system`) or forces behavior with `always`/`reduced`. A listener reacts if the OS preference flips mid-session (pauses/resumes loop, toggles `pokemon-reduced-motion`/`pokemon-force-motion` classes).

**Floor heights**
`FLOOR_HEIGHTS` — lookup table for 6 themes × 4 sizes (`main.ts:180-212`, now includes `volcano`/`snow` at 24/32/40/64 and `castle/large=120`). `calculateFloor()` reads it, 0 fallback.

**Background scene helpers (Phases 1–4)**
- **`resolveSceneVariant(themeKind, dayNightCycle, hour)`** (`226-235`) — exported for tests: `dayNightCycle ? (hour>=19||hour<6 ? dark:light) : (themeKind===dark ? dark:light)`.
- **`applySceneLayers(baseUri, theme, themeKind, size, dayNightCycle)`** (`244-280`) — sets `body.backgroundImage` + `foregroundEl.backgroundImage` + optionally `midgroundEl.backgroundImage` via `hasMidgroundAsset()`, returns `{floor, variant}`. Clears all on `Theme.none`.
- **`startDayNightCycle(...)`** (`288-310`) — 60s interval re-evaluating `applySceneLayers` only when hour changes; cleared/recreated on theme change.

**`addPokemonToPanel(...)` — the spawner**
Creates three DOM nodes inside `#pokemonContainer`:
1. `img.pokemon` — the visible animated sprite,
2. `div.collision` — an invisible hover/click zone stacked above it,
3. `img.bubble` — the speech bubble (heart/happy face), hidden by default.

Then:
- **Unique-name guard** (R4, `main.ts:352-360`): if `incrementCounter` and `allPokemon.locate(name)` exists, suffix `-2`, `-3`… so delete/friend lookups are never ambiguous; recovery passes `false` to keep saved names.
- validates the color against the species' allowed colors (`availableColors`),
- constructs the `Pokemon` object via `createPokemon()`,
- binds a **hover-to-swipe** listener directly to this Pokémon's collision box (no O(n) scan),
- adds a **hover Pokéball button** (R2, `396-404`): `div.pokeball-hover` inside collision, `click` → `removePokemonFromPanel({name})` with `stopPropagation` so it follows the Pokémon and inherits `:hover`,
- plays the **Pokéball-open** sprite-sheet animation; at 70% of its duration the sprite pops in (`spawn-pop`),
- if shiny, overlays a one-shot sparkle GIF (`shiny-anim.gif`, cached reuse).

**`removePokemonFromPanel({name})` — the recaller**
Finds the Pokémon, removes it from the collection immediately (so rapid deletes don't clash), decrements `pokemonCounter` (normalized), plays the **Pokéball-close** animation at the sprite's last position, fades the sprite out (`fade-out`), cleans up DOM nodes, and persists state + posts `info` toast.

**`saveState()` / `recoverState()`**
- Save serializes every companion (type, color, generation, current state enum, position, friend name) into webview state.
- Recovery replays it: re-spawns each saved Pokémon at its saved position (`false` for counter), then restores its exact behavioral state via `recoverState()` and re-links friendships via `recoverFriend()`.

**`pokemonPanelApp(...)` — the entry point called by the inline HTML script**
Signature `(basePokemonUri, theme, themeKind, pokemonColor, pokemonSize, pokemonType, throwBallWithMouse, gen, originalSpriteSize, options {debug,maxPokemon,motion,dayNightCycle})`.
Steps: set `debugEnabled`/`maxPokemon`/`motionReduced` classes, resolve `dayNightCycle`, **apply scene layers** (`applySceneLayers` → `floor` + `variant`) + **start day/night timer**, log session, recover or init state, `initCanvas()`, wire reduced-motion listener, define the **message switch** handling every command the host can send: `spawn-pokemon` (+ party cap `Party is full` toast), `spawn-random-pokemon` (cap-checked), `list-pokemon`, `roll-call`, `delete-pokemon`, `reset-pokemon` (**cascaded stagger 150ms**, respects `motionReduced`, `cascadeDelay+500` final reset — R4), `pause-pokemon`/`resume-pokemon` (fixed to save+pause vs resume). Finally **starts the single loop** (`ensureAnimationLoop`). Also `resize` listener re-clamps sprites.

### 5.2 `src/panel/states.ts` — the behavior state machine

Pure logic, no rendering — which makes it fully unit-testable.

**Core types**
- `States` enum — every possible activity (`sitIdle`, `walkLeft/Right`, `runLeft/Right`, `lie`, `wallHang*`, `climbWall*`, `jumpDown*`, `land`, `swipe`, `idleWithBall`, `chase`, `chaseFriend`, **`standRight`/`standLeft`** — both now correct labels; fix B-2).
- `FrameResult` — `stateContinue` | `stateComplete` | `stateCancel`.
- `IPokemonType` — the interface a Pokémon must implement for states to drive it (position setters, speed, friend hooks…).
- `BallState` — physics for the thrown ball (position + velocity + caught flag).
- `isStateAboveGround()` — true for wall-climbing/jumping states (used to skip ground snapping).
- `resolveState(label, pokemon)` — factory turning a label back into a live state object (defaults to sitting when unknown).
- `rightWalkBoundary()` — per-frame `window.innerWidth*0.95` so resize is respected instantly.

**State classes**
| Class | Behavior |
|---|---|
| `AbstractStaticState` | Base for "stand still" states: counts ticks until `holdTime`, then completes. Subclasses: `SitIdleState` (50 ticks), `LieState` (50), `WallHangLeftState` (50), `LandState` (10), `SwipeState` (15), `IdleWithBallState` (30), `StandRightState` (60, `label=standRight`), `StandLeftState` (60, `label=standLeft`). |
| `WalkRightState` | Moves right by `speed` each tick; finishes at the right edge (95% of width) or randomly stops (1% chance/tick). |
| `WalkLeftState` | Mirror image toward the left edge. |
| `RunRightState` / `RunLeftState` | Same but 1.6× faster, longer hold times (130). |
| `ChaseState` | Runs toward the thrown ball; hides the ball and completes when caught. Cancels if ball already caught. |
| `ChaseFriendState` | Runs toward a friend while they're playing; cancels if friendship ends. |
| `ClimbWallLeftState` | Rises 1px/tick until bottom ≥ 100. |
| `JumpDownLeftState` | Falls 5px/tick, clamps at the floor. |

### 5.3 `src/panel/base-pokemon-type.ts` — `BasePokemonType`

The abstract Pokémon class that owns the sprite element and drives the machine:

- **Positioning:** `left`/`bottom` getters/setters update the sprite *and* reposition the collision box and bubble together (`repositionAccompanyingElements`).
- **Sizing:** `calculateSpriteWidth()` scales the species' native pixel size by nano(×1)/small(×1.5)/medium(×2)/large(×2.5).
- **Speed:** randomized ±30% at birth (`randomizeSpeed`), then scaled by size (nano 0.5× … large 1.25×).
- **Facing:** flips the sprite horizontally via CSS transform (`faceLeft/faceRight`); species with real left-facing art use dedicated files instead.
- **`setAnimation(face, hasLeftFacing)`** — the heart of visuals: swaps the `<img>` src to `${root}_${animation}_8fps.gif`, substituting `walk_left → walk` (flipped) when no left-facing art exists. Skips work if the animation didn't change.
- **`nextFrame()`** — the per-tick driver:
  1. updates facing + animation,
  2. if this Pokémon has a playing friend, switches into `chaseFriend`,
  3. ticks the current state;
     - on `complete`: restore the held (pre-swipe) state if any, otherwise pick a random next state from the sequence tree;
     - on `cancel`: fall back to `idleWithBall` transitions.
- **Social API:** `makeFriendsWith()`, `recoverFriend()`, `hasFriend`, `friend`, `isPlaying` (true while running), `showSpeechBubble()` (heart for friends, happy face otherwise).
- **Interaction:** `swipe()` stores the current state, plays the swipe pose, then resumes afterward (via the held-state mechanism above). `chase(ball, canvas)` enters chase mode.

### 5.4 `src/panel/pokemon.ts` — `Pokemon` + pet names

The concrete class actually instantiated:
- Looks up its `PokemonConfig` from the registry (falls back to Bulbasaur if unknown).
- Defines the default **sequence tree**: idle ⇄ walk-left ⇄ walk-right, swipe → idle.
- Exposes convenience getters (`generation`, `pokedexNumber`).
- Also exports `POKEMON_NAMES` — the ~80 pet names `randomName()` draws from.

### 5.5 `src/panel/pokemon-collection.ts` — managing the crowd

- **`PokemonElement`** — bundles one Pokémon's three DOM nodes + metadata (color, type, generation, native sprite size) with a `remove()` cleanup.
- **`PokemonCollection`** — an array wrapper: `push`, `locate(name)`, `remove/removeFromCollection(name)`, `reset`, and **`seekNewFriends()`** — the O(n²) overlap scan: for every lonely Pokémon, checks who overlaps it and introduces them (both get heart bubbles). Friendship = mutual `_friend` references.
- **`InvalidPokemonException`** — thrown for bad names/species/colors.
- **`createPokemon(...)`** — safe factory wrapping the `Pokemon` constructor.
- **`availableColors(type)`** / **`normalizeColor(color, type)`** — validation helpers used before spawning.

### 5.6 `src/panel/sequences.ts`

Tiny file defining `ISequenceNode` / `ISequenceTree` — the shape of the transition tables described in §5.4. Adding new behaviors = adding states in `states.ts` + entries here.

---

## 6. `tests/` & `scripts/`

### `tests/states.test.ts` — 17 unit tests (vitest + jsdom)

Uses a mock Pokémon object that records positioning calls, then verifies:
- every static state transitions continue→complete exactly at its `holdTime` (including the fixed 60 for `standRight/standLeft`);
- walking moves the sprite and terminates at boundaries (with `Math.random` pinned so the 1% early-stop can't flake);
- running is genuinely faster than walking;
- climbing terminates at height 100; jumping clamps to the floor;
- ball-chase catches/hides correctly and cancels when already caught;
- `resolveState` maps every label and falls back safely on garbage input.

### `tests/backgrounds.test.ts` — 8 unit tests

Covers the Background Beauty additions:
- every scene theme defines a floor >0 for every size, `none` is 0, floors grow monotonically;
- `resolveSceneVariant` follows `themeKind` when `dayNightCycle` off, and picks `dark` 19–5 / `light` 6–18 when on (overrides theme);
- `ALL_THEMES` contains `volcano`/`snow`; `THEMES_WITH_MIDGROUND` excludes `none` and is subset of `ALL_THEMES`.

Run with `npm test` → **25 passed**.

### `scripts/optimize-assets.mjs`

Asset compressor for shipping: walks `media/` recursively, recompresses every GIF larger than 600 B with `gifsicle -O3 --lossy=80`, keeps results only when smaller, prints a summary. Exits with instructions if gifsicle isn't installed. Run once via `npm run optimize-assets` before packaging.

### `scripts/generate-backgrounds.mjs`

Deterministic procedural generator for `volcano`/`snow` PNGs (16 per theme + 8 midgrounds). Swap outputs with hand-drawn art using identical filenames (F-1).

---

## 7. `media/` — Assets & Styling

```
media/
├── main-bundle.js            # ← generated webview bundle (webpack output)
├── pokemon.css               # all panel styling (below)
├── reset.css                 # minimal CSS reset
├── Silkscreen-Regular.ttf    # pixel font used in the panel
├── pokeball_sprite_sheet.png # 6-frame vertical sheet for recall animations
├── shiny-anim.gif            # sparkle overlay for shiny spawns
├── heart.png / happy.png     # speech-bubble icons
├── icon/                     # dark/light toolbar SVGs (add/trash/random/scene)
├── backgrounds/<theme>/      # forest | castle | beach | volcano | snow
│   ├── background-{light,dark}-{nano|small|medium|large}.png  (8 per theme)
│   ├── foreground-{light,dark}-{nano|small|medium|large}.png  (8)
│   └── midground-{light,dark}-{nano|small|medium|large}.png   (8, volcano/snow only)
└── gen1..gen5/<pokemon>/<color>/
    └── {name}_{idle|walk|walk_left|walk_fast|run|...}_8fps.gif
```

### `media/pokemon.css` — what each piece does

| Selector / block | Purpose |
|---|---|
| `body` | Fills with the editor background color, bottom-aligned repeating background image (theme layer), hides overflow/scrollbars |
| `#foreground` | Overlay layer drawn *above* sprites so they appear to walk behind scenery |
| `#midground` | Parallax drift layer (Phase 3) — `repeat-x bottom left`, `animation: drift 90s linear infinite`, paused via `.pokemon-paused` |
| `#pokemonCanvas` | Fixed invisible canvas used for ball-throw physics coordinates |
| `img.pokemon` | Absolute-positioned sprite, `image-rendering: pixelated` (crisp pixels), default flipped left |
| `.collision` | Invisible hover zone, z-index 999 so it always receives mouse events; contains `.pokeball-hover` button (R2) |
| `.pokeball-hover` | Small button visible on `:hover`, click → recall |
| `.bubble` (+ size variants) | Speech bubble with fade-in animation; widths per Pokémon size; extra offset for 64px sprites |
| `.pokeball-sprite` + `pokeball-open/close` | The recall effect: a 64px frame stepping vertically through the 6-frame sheet with CSS `steps()` — opening releases, closing recalls |
| `.pokemon.spawn-pop` / `@keyframes pokemon-pop` | Spawn flourish: scale up from 40% with a desaturate→color flash |
| `.shiny-overlay` + `@keyframes shiny-sparkle` | Screen-blended sparkle burst on shiny spawns |
| `.pokemon.fade-out` / `@keyframes pokemon-fade-out` | Recall fade: shrink-flash then disappear |
| `.pokemon-paused` / `.pokemon-reduced-motion` | Pause drift + freeze animations for hidden/reduced-motion panels |

`reset.css` neutralizes browser defaults so VS Code theme variables control everything.

### Sprite path convention (memorize this!)

```
{webview-uri}/{gen}/{pokemon}/{color}/{name}_{animation}_8fps.gif
example: …/media/gen1/pikachu/shiny/pikachu_walk_8fps.gif
```
`setAnimation()` builds exactly this pattern; adding art means following it exactly.

---

## 8. `l10n/` — Translations

| File/folder | Purpose |
|---|---|
| `bundle.l10n.en-US.json`, `bundle.l10n.en-GB.json` | UI-string translations consumed by `vscode.l10n.t()` (command titles, prompts, notifications) — now includes **`"None": "None"`** (fix F-2) for the theme picker |
| `l10n/tsconfig.json` | Config for the localization tooling |
| `pokemon/{locale}/gen1–5.json` *(optional)* | Per-species name translations loaded by `localize.ts` (English falls back to the registry names) |

---

## 9. Reference Tables

### 9.1 Host → Webview messages (sent via `postMessage`)

| Command | Payload | Effect in webview |
|---|---|---|
| `spawn-pokemon` | type, color, name, generation, originalSpriteSize | Spawns that Pokémon (respects party cap) |
| `spawn-random-pokemon` | — | Random spawn (respects cap) |
| `delete-pokemon` | name | Recall animation + removal |
| `reset-pokemon` | — | Cascaded recall (150ms stagger), clear state |
| `list-pokemon` | — | Replies with `type,name,color` lines |
| `roll-call` | — | Notification per Pokémon |
| `pause-pokemon` / `resume-pokemon` | — | Stop/start the animation loop (visibility) |
| `throw-with-mouse` | enabled | Toggles click-to-recall |
| `set-size` | size | Updates sizing for new spawns |
| `updateTheme` (via `_getHtmlForWebview` rebuild or `applySceneLayers`) | theme, themeKind, dayNightCycle | Repaints background layers |

### 9.2 Webview → Host messages

| Command | Meaning |
|---|---|
| `info` | Show an information toast |
| `alert` / `error` | Show an error toast |
| `list-pokemon` | Reply payload for delete flow |

### 9.3 Settings (`vscode-pokemon.*`)

| Setting | Default | Meaning |
|---|---|---|
| `pokemonSize` | `medium` | Sprite scale for new sessions |
| `position` | `explorer` | Sidebar view vs. editor tab |
| `theme` | `none` | Background scene — `none/forest/castle/beach/volcano/snow` |
| `dayNightCycle` | `false` | Auto dark 19–6 / light 6–19 (overrides `themeKind`) — Phase 4 |
| `randomTheme` | `false` | Random scene per session, cached in `globalState` — Phase 5, fix F-6 |
| `throwBallWithMouse` | `true` | Click Pokémon to recall (fix S-1 now in Settings UI) |
| `defaultPokemon` | `[]` | Party auto-spawned on startup (supports `"type": "random"` + pools) |
| `shinyOdds` | `8192` | 1-in-N shiny chance |
| `pokemonLanguage` | `auto` | Name translation locale |
| `maxPokemon` | `6` (1–15) | Party cap |
| `motion` | `system` | Animation: follow OS / always / reduced |
| `debug` | `false` | Verbose webview logging |

All declared in `package.json` → `contributes.configuration.properties` so they appear in Settings UI.

### 9.4 Key commands

| Command | Keybinding | Action |
|---|---|---|
| `vscode-pokemon.start` | — | Open/focus the playground |
| `vscode-pokemon.spawn-pokemon` | `Alt+Shift+W` | Pick & release a Pokémon |
| `vscode-pokemon.spawn-random-pokemon` | `Alt+Shift+Q` | Instant random spawn |
| `vscode-pokemon.delete-pokemon` | `Alt+Shift+D` | Recall one |
| `vscode-pokemon.remove-all-pokemon` | `Alt+Shift+Backspace` | Recall everyone (cascade) |
| `vscode-pokemon.roll-call` | — | Everyone greets you |
| `vscode-pokemon.select-theme` | title bar (explorer) | Pick scene via QuickPick (Phase 2) |
| `vscode-pokemon.export-pokemon-list` | — | Backup party JSON to untitled doc |
| `vscode-pokemon.import-pokemon-list` | — | Restore from JSON (warns on bad pool) |
| `vscode-pokemon.configure-keybindings` | — | Open keybindings filtered to command |
| `vscode-pokemon.change-pokemon-language` | — | Switch name locale |

---

## 10. Recent Changes (What Was Fixed to Make It Properly Functional)

**Date:** 2026-08-27 · **Source docs:** `BACKGROUND_BEAUTY.md` + `IMPLEMENTATION_PLAN.md` + `BUG_FIXES_PLAN.md` → consolidated in `Docs/Features.md`.

| ID | File(s) | Change | Why |
|---|---|---|---|
| **B-1** | `.gitignore:13`, `dev_session.md` untracked | Added `dev_session.md` to ignore, `git rm --cached` | Prevent 5,479-line log shipping to `main` |
| **B-2** | `src/panel/states.ts:431-443` | Fixed `StandRightState.label = standRight` (was `standLeft`) + `StandLeftState.label = standLeft` (was `standRight`) | State persistence broken for standing Pokémon |
| **S-1** | `package.json:232-236` | Declared `vscode-pokemon.throwBallWithMouse` boolean default true | Setting worked but invisible in Settings UI |
| **S-2** | `src/panel/main.ts:158-167` | `stopAnimationLoop()` now clears `dayNightTimer` + `unload` listener | Timer leak on webview destroy |
| **S-3** | `package.json` | Removed `"browser": "./dist/web/extension-web.js"` | Dead web build target |
| **F-2** | `l10n/bundle.l10n.en-US/Gb.json:35` | Added `"None": "None"` | Missing translation for theme picker |
| **F-3** | `src/panel/main.ts:32-61,244-280`, `src/common/types.ts:96-105` | Added `midgroundCache` + `hasMidgroundAsset()` dynamic `Image` probe; updated comment | Hardcoded `THEMES_WITH_MIDGROUND` → runtime detection |
| **F-5** | `package.json:323-337` | Removed `typescript-eslint@^0.0.1-alpha.0` (kept `@typescript-eslint/*@^5.29.0`) | Bogus devDependency |
| **F-6** | `src/extension/extension.ts:36-39,485` | `extensionState = context.workspaceState → context.globalState` | `randomTheme` cache collision across workspaces |
| **Phase 1–5** | `src/common/types.ts`, `src/panel/main.ts`, `src/extension/extension.ts`, `media/backgrounds/volcano|snow/`, `package.json`, `media/pokemon.css`, `l10n` | Full Background Beauty implementation (new scenes, picker, parallax, day/night, random) | Rich scenes beyond upstream `vscode-pets` |
| **R2/R4** | `src/panel/main.ts:352-404,850-874` | Hover Pokéball button + cascade stagger 150ms + unique-name `-2` suffix + `normalizePokemonCounter` | Proper recall UX and identity safety |
| **Docs** | `Docs/Features.md`, `Docs/TESTING_VIGNETTE.md` | Unified implementation doc + complete testing vignette (25+ checks) | Single source of truth |

**Quality gates after fixes:** `npm run lint` → 0 errors (4 `any` warnings), `npm run compile` → webpack 5.95.0 success, `npm test` → 25 passed.

---

*Generated from the actual source; keep this file next to `Features.md` and `TESTING_VIGNETTE.md` and update it whenever public commands, settings, or the sprite contract change. See `Features.md` for the consolidated feature inventory.*
