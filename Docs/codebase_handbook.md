# 📖 KNP Pokémon — Codebase Handbook

**A complete, plain-language guide to every file and piece of code in this repository.**

> This extension adds live Pokémon companions to VS Code. Pokémon appear as animated pixel-art sprites in a webview panel, walk around, interact with each other, and can be released/recalled with Pokéball animations.
>
> **How to read this document:** Section 1 explains the big picture first. Sections 2–6 then go file-by-file. Sections 7–9 are reference tables you can consult anytime.

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
        ├─ createPokemon() (pokemon-collection.ts) → new Pokemon() (pokemon.ts)
        │    └─ BasePokemonType constructor sets position, speed, starting state
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
(`sitIdle`, `walkLeft`, `climbWallLeft`, `chase`, …). Every 100 ms the loop calls
`nextFrame()` on the current state object, which either:
- returns `stateContinue` (keep doing this), or
- returns `stateComplete` (pick a random next state from the sequence tree), or
- returns `stateCancel` (abnormal exit, e.g. ball already caught).

Changing the state changes which GIF file the sprite `<img>` points at
(`{name}_{animation}_8fps.gif`), so the visible animation follows the logic automatically.

---

## 2. Root & Config Files

### `package.json`
The manifest — everything VS Code needs to know about the extension.

Key parts:
- **`main: "./out/extension/extension.js"`** — where the Node host entry point lands after `tsc` compiles it.
- **`browser: "./dist/web/extension-web.js"`** — optional web build target.
- **`activationEvents`** — when the extension wakes up (`onStartupFinished` means "shortly after VS Code starts").
- **`contributes.views`** — registers the **Pokémon view**, a webview inside the Explorer sidebar, shown only when the `vscode-pokemon.position == 'explorer'` context key is set.
- **`contributes.commands`** — all user-facing commands (start, spawn, spawn random, delete, remove-all, roll-call, import/export list, language, keybindings).
- **`contributes.keybindings`** — `Alt+Shift+W` spawn, `Alt+Shift+Q` spawn-random, `Alt+Shift+D` delete, `Alt+Shift+Backspace` remove-all.
- **`contributes.configuration`** — every user setting (see the settings table in §9.3): `pokemonSize`, `position`, `theme`, `defaultPokemon`, `shinyOdds`, `pokemonLanguage`, `maxPokemon`, `motion`, `debug`.
- **Scripts:**

| Script | What it does |
|---|---|
| `compile` | webpack dev bundle + tsc host compile |
| `compile:prod` | same but minified with all `console.*` stripped |
| `watch` | recompiles on save during development |
| `lint` / `lint:fix` | ESLint over `src/` |
| `test` | vitest unit tests (jsdom) |
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
- `.gitignore` excludes `node_modules`, build outputs, the generated `media/main-bundle.js`, etc.

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
| `Theme` | Backgrounds: `none` / `forest` / `castle` / `beach` |
| `ColorThemeKind` | VS Code theme: light / dark / high contrast |
| `WebviewMessage` | The `{ text, command }` envelope for messages |
| `ALL_COLORS`, `ALL_SCALES`, `ALL_THEMES` | Validation lists used when reading settings |

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

### `src/extension/extension.ts` (the largest file, ~1,700 lines)

Everything that runs on the Node side. Major pieces, top to bottom:

#### 4.1 Settings readers (top of file)
Small functions that each read one `vscode-pokemon.*` setting and sanitize it:
`getConfiguredSize()`, `getConfiguredTheme()`, `getConfiguredThemeKind()`, `getConfigurationPosition()`, `getThrowWithMouseConfiguration()`, `getConfiguredShinyOdds()`, `getConfiguredDebug()`, `getConfiguredMaxPokemon()`, `getConfiguredMotion()`.
Also `maybeMakeShiny(colors)` — rolls the shiny dice (1-in-N odds) when a color isn't forced.

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
1. `vscode-pokemon.start` — focuses the sidebar view (explorer mode) or creates the editor panel.
2. Status-bar 🐿️ button + listeners that keep it visible.
3. The webview view provider (`registerWebviewViewProvider`).
4. All other commands:
   - **delete-pokemon** — asks the webview for its current list, shows a QuickPick of companions, deletes the chosen one, updates stored roster.
   - **remove-all-pokemon** — resets everything and clears storage.
   - **roll-call** — every companion posts a greeting notification.
   - **configure-keybindings** — opens VS Code's keybinding editor pre-filtered to a chosen command.
   - **change-pokemon-language** — QuickPick of locales; persists choice and resets the translation cache.
   - **export-pokemon-list** — writes the party as pretty-printed JSON into a new untitled document.
   - **import-pokemon-list** — reads such a JSON file, validates colors, spawns everyone, saves roster.
   - **spawn-pokemon** — a two-level dynamic QuickPick: shows generation folders by default; typing filters across *all* Pokémon instantly. After picking: optional custom name → shiny roll → spawn → persist.
   - **spawn-random-pokemon** — instant random spawn.
5. A **configuration-change listener**: changing size/theme/color/type rebuilds the panel; changing throw-ball toggles a flag; changing language refreshes translations.
6. A **webview panel serializer** so even editor-mode panels survive window reloads.

#### 4.5 `IPokemonPanel` interface + `PokemonWebviewContainer` base class
An interface listing everything a panel must do (spawn/delete/reset/list/roll-call/update-theme…), and an abstract implementation that owns the shared logic:
- Wrappers that just `postMessage` a command to the webview (`spawnPokemon`, `deletePokemon`, …).
- `_getHtmlForWebview(webview)` — **builds the panel's HTML page**: links the CSS files, embeds the Silkscreen pixel font, sets a strict Content-Security-Policy with a per-render random nonce, loads `media/main-bundle.js`, then boots the app with an inline script calling `pokemonApp.pokemonPanelApp(...)` passing the resource URI, theme info, and an options object (`debug`, `maxPokemon`, `motion`).

#### 4.6 Two concrete panels
- **`PokemonPanel`** — a full editor tab (like a file). Singleton (`currentPanel`). On visibility change it sends `pause/resume` messages instead of rebuilding (cheap show/hide).
- **`PokemonWebviewViewProvider`** — the Explorer-sidebar view (the default). Implements `resolveWebviewView()`: builds HTML once, wires pause/resume on visibility, spawns the saved/default party on first reveal.

Both share message handling via `handleWebviewMessage`, which turns webview messages into notifications: `alert` → error toast, `info` → information toast.

#### 4.7 Utilities
`getNonce()` (random CSP token), `createPokemonPlayground()` (fallback that opens the editor panel when a command is used with no panel open), `waitForPokemonList()` (promise that resolves when the webview answers a `list-pokemon` request).

---

## 5. `src/panel/` — The Webview UI

All of this gets bundled into `media/main-bundle.js` and runs inside the webview page.

### 5.1 `src/panel/main.ts` — the application core

The bootstrap file. Everything below is in this one file:

**Global state**
- `allPokemon` — the live collection of on-screen Pokémon.
- `pokemonCounter` — bookkeeping counter persisted with state.
- `debugEnabled`, `motionReduced`, `activeStateApi` — runtime flags.

**Debug logging**
`log(...)` prints to the console only when `vscode-pokemon.debug` is true (and production builds strip console output entirely).

**The single animation loop** (performance-critical)
- `ensureAnimationLoop(stateApi)` starts **one** `setInterval` at 100 ms for the whole app:
  - every tick → `nextFrame()` for each Pokémon;
  - every 5th tick → `seekNewFriends()`;
  - every 30 s → `saveState()` safety net;
- `pauseAnimationLoop()` / `stopAnimationLoop()` clear it (used when the panel hides, reduced motion is on, or the page unloads).

**Reduced motion**
`prefersReducedMotion(setting)` honors the OS "reduce motion" preference (when the setting is `system`) or forces behavior with `always`/`reduced`. A listener reacts if the OS preference flips mid-session.

**Floor heights**
`FLOOR_HEIGHTS` — a lookup table giving the ground offset per theme × size (e.g., castle floor sits higher than forest). `calculateFloor()` reads it.

**`addPokemonToPanel(...)` — the spawner**
Creates three DOM nodes inside `#pokemonContainer`:
1. `img.pokemon` — the visible animated sprite,
2. `div.collision` — an invisible hover/click zone stacked above it,
3. `img.bubble` — the speech bubble (heart/happy face), hidden by default.

Then:
- validates the color against the species' allowed colors (`availableColors`),
- constructs the `Pokemon` object via `createPokemon()`,
- binds a hover-to-swipe listener directly to this Pokémon's collision box,
- plays the **Pokéball-open** sprite-sheet animation; at 70% of its duration the sprite pops in (`spawn-pop`),
- if shiny, overlays a one-shot sparkle GIF.

**`removePokemonFromPanel({name})` — the recaller**
Finds the Pokémon, removes it from the collection immediately (so rapid deletes don't clash), plays the **Pokéball-close** animation at the sprite's last position, fades the sprite out, cleans up DOM nodes, and persists state.

**`saveState()` / `recoverState()`**
- Save serializes every companion (type, color, generation, current state enum, position, friend name) into webview state.
- Recovery replays it: re-spawns each saved Pokémon at its saved position, then restores its exact behavioral state and re-links friendships.

**`pokemonPanelApp(...)` — the entry point called by the inline HTML script**
Applies theme backgrounds (body + foreground layer images), computes the floor, restores state or starts fresh, initializes the off-screen canvas (used for ball physics), registers the reduced-motion listener, and defines the **message switch** handling every command the host can send: `spawn-pokemon`, `spawn-random-pokemon`, `list-pokemon`, `roll-call`, `delete-pokemon`, `reset-pokemon`, `pause-pokemon`, `resume-pokemon`. Finally starts the loop.

### 5.2 `src/panel/states.ts` — the behavior state machine

Pure logic, no rendering — which makes it fully unit-testable.

**Core types**
- `States` enum — every possible activity (`sitIdle`, `walkLeft/Right`, `runLeft/Right`, `lie`, `wallHang*`, `climbWall*`, `jumpDown*`, `land`, `swipe`, `idleWithBall`, `chase`, `chaseFriend`, `standRight/Left`).
- `FrameResult` — `stateContinue` | `stateComplete` | `stateCancel`.
- `IPokemonType` — the interface a Pokémon must implement for states to drive it (position setters, speed, friend hooks…).
- `BallState` — physics for the thrown ball (position + velocity + caught flag).
- `isStateAboveGround()` — true for wall-climbing/jumping states (used to skip ground snapping).
- `resolveState(label, pokemon)` — factory turning a label back into a live state object (defaults to sitting when unknown).

**State classes**
| Class | Behavior |
|---|---|
| `AbstractStaticState` | Base for "stand still" states: counts ticks until `holdTime`, then completes. Subclasses: `SitIdleState` (50 ticks), `LieState` (50), `WallHangLeftState` (50), `LandState` (10), `SwipeState` (15), `IdleWithBallState` (30), `StandRight/LeftState` (60). |
| `WalkRightState` | Moves right by `speed` each tick; finishes at the right edge (95% of width) or randomly stops (1% chance/tick). |
| `WalkLeftState` | Mirror image toward the left edge. |
| `RunRightState` / `RunLeftState` | Same but 1.6× faster, longer hold times. |
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
- every static state transitions continue→complete exactly at its `holdTime`;
- walking moves the sprite and terminates at boundaries (with `Math.random` pinned so the 1% early-stop can't flake);
- running is genuinely faster than walking;
- climbing terminates at height 100; jumping clamps to the floor;
- ball-chase catches/hides correctly and cancels when already caught;
- `resolveState` maps every label and falls back safely on garbage input.

Run with `npm test`.

### `scripts/optimize-assets.mjs`

Asset compressor for shipping: walks `media/` recursively, recompresses every GIF larger than 600 B with `gifsicle -O3 --lossy=80`, keeps results only when smaller, prints a summary. Exits with instructions if gifsicle isn't installed. Run once via `npm run optimize-assets` before packaging.

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
├── icon/                     # dark/light toolbar SVGs (add/trash/random)
├── backgrounds/<theme>/      # forest | castle | beach
│   └── background-{light,dark}-{size}.png (+ foreground variants)
└── gen1..gen5/<pokemon>/<color>/
    └── {name}_{idle|walk|walk_left|walk_fast|run|...}_8fps.gif
```

### `media/pokemon.css` — what each piece does

| Selector / block | Purpose |
|---|---|
| `body` | Fills with the editor background color, bottom-aligned repeating background image (theme layer), hides overflow/scrollbars |
| `#foreground` | Overlay layer drawn *above* sprites so they appear to walk behind scenery |
| `#pokemonCanvas` | Fixed invisible canvas used for ball-throw physics coordinates |
| `img.pokemon` | Absolute-positioned sprite, `image-rendering: pixelated` (crisp pixels), default flipped left |
| `.collision` | Invisible hover zone, z-index 999 so it always receives mouse events |
| `.bubble` (+ size variants) | Speech bubble with fade-in animation; widths per Pokémon size; extra offset for 64px sprites |
| `.pokeball-sprite` + `pokeball-open/close` | The recall effect: a 64px frame stepping vertically through the 6-frame sheet with CSS `steps()` — opening releases, closing recalls |
| `.pokemon.spawn-pop` / `@keyframes pokemon-pop` | Spawn flourish: scale up from 40% with a desaturate→color flash |
| `.shiny-overlay` + `@keyframes shiny-sparkle` | Screen-blended sparkle burst on shiny spawns |
| `.pokemon.fade-out` / `@keyframes pokemon-fade-out` | Recall fade: shrink-flash then disappear |

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
| `bundle.l10n.en-US.json`, `bundle.l10n.en-GB.json` | UI-string translations consumed by `vscode.l10n.t()` (command titles, prompts, notifications) |
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
| `reset-pokemon` | — | Recall everyone, clear state |
| `list-pokemon` | — | Replies with `type,name,color` lines |
| `roll-call` | — | Notification per Pokémon |
| `pause-pokemon` / `resume-pokemon` | — | Stop/start the animation loop (visibility) |
| `throw-ball`, `throw-with-mouse`, `set-size` | varies | Ball interaction & scaling |

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
| `theme` | `none` | Background scene |
| `defaultPokemon` | `[]` | Party auto-spawned on startup (supports `"type": "random"` + pools) |
| `shinyOdds` | `8192` | 1-in-N shiny chance |
| `pokemonLanguage` | `auto` | Name translation locale |
| `maxPokemon` | `6` (1–15) | Party cap |
| `motion` | `system` | Animation: follow OS / always / reduced |
| `debug` | `false` | Verbose webview logging |

### 9.4 Key commands

| Command | Keybinding | Action |
|---|---|---|
| `vscode-pokemon.start` | — | Open/focus the playground |
| `vscode-pokemon.spawn-pokemon` | `Alt+Shift+W` | Pick & release a Pokémon |
| `vscode-pokemon.spawn-random-pokemon` | `Alt+Shift+Q` | Instant random spawn |
| `vscode-pokemon.delete-pokemon` | `Alt+Shift+D` | Recall one |
| `vscode-pokemon.remove-all-pokemon` | `Alt+Shift+Backspace` | Recall everyone |
| `vscode-pokemon.roll-call` | — | Everyone greets you |
| export/import-pokemon-list | — | Backup/restore party JSON |
| change-pokemon-language | — | Switch name language |

---

*Generated from the actual source; keep this file next to `IMPROVEMENT_PLAN.md` and update it whenever public commands, settings, or the sprite contract change.*
