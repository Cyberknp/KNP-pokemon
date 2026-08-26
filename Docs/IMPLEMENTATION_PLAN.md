# 🎮 KNP Pokémon — Custom VS Code Extension Plan

**Project:** Personal-use Pokémon pet extension for VS Code (Gen 1–5)
**Repo:** https://github.com/Cyberknp/KNP-pokemon
**Status:** ✅ **Implemented, optimized, and tested** — this plan now tracks *remaining* work only.

> **Companion docs:**
> - `IMPROVEMENT_PLAN.md` — performance & code-quality overhaul (**implemented**)
> - `OPTIMIZATION_CHANGES.md` — detailed description of the optimization changes
> - `PR1_REVIEW.md` — code review of PR #1 (fixes for its findings are in the optimization work)

---

## 0. Licensing & Open-Source Status (READ FIRST)

| Asset | License | Can you use it? |
|---|---|---|
| **All source code** | **CC0 1.0 / MIT-style waiver** (upstream) | ✅ Fully — copy, modify, redistribute |
| **Pokémon sprite GIFs** (`media/genN/…`) | **© The Pokémon Company / Nintendo / Game Freak** | ⚠️ Unlicensed fan use — same risk level as upstream |

- ✅ **Personal/learning use** — completely fine.
- ❌ **Commercial use of sprites** — never, regardless of credits.
- ⚠️ Crediting Nintendo/TPC ≠ license; keep the fan-project disclaimer.
- 📌 The repo's `package.json` still declares `"license": "MIT"` while bundled images are TPC-copyrighted — fix during rebranding (Phase R1).

### Required attribution in README (copy this pattern)

```md
## Credits

### Code
- Based on [vscode-pokemon](https://github.com/jakobhoeg/vscode-pokemon) by [jakobhoeg](https://github.com/jakobhoeg) (CC0)
- Inspired by [vscode-pets](https://github.com/tonybaloney/vscode-pets)

### Sprite Sources
- Pokémon Sprites: © The Pokémon Company / Nintendo / Game Freak
- Used for non-commercial fan-project purposes only
- This repository is a fan project and is not affiliated with Nintendo,
  The Pokémon Company, or Game Freak
```

---

## 1. Current State (what already works)

The full extension is implemented on branch `25082026_pokemon_extension_genesis` (PR #1) plus the performance overhaul:

| Feature | Status |
|---|---|
| Gen 1–5 registry + partial Gen 5 sprites | ✅ Done |
| Webview panel in Explorer sidebar (`pokemonView`) | ✅ Done |
| Spawn specific / spawn random (QuickPick with gen browsing + search) | ✅ Done |
| Recall single / recall all, Pokéball open/close animations | ✅ Done |
| Throw-ball-with-mouse + chase behavior | ✅ Done |
| Shiny variants with configurable odds (`vscode-pokemon.shinyOdds`) | ✅ Done |
| Size scaling nano/small/medium/large | ✅ Done |
| Party cap (`vscode-pokemon.maxPokemon`, default 6) | ✅ Done |
| Reduced-motion support (`vscode-pokemon.motion`) | ✅ Done |
| Debug logging toggle (`vscode-pokemon.debug`) | ✅ Done |
| Background themes: `none / forest / castle / beach` (light+dark × sizes) | ✅ Done |
| Persistence across reloads (mementos + webview state) | ✅ Done |
| Import/export party as JSON | ✅ Done |
| Localization (`l10n`, Pokémon-name translations) | ✅ Done |
| Single animation loop, debounced saves, pause/resume on hide | ✅ Done (optimization pass) |
| ESLint strict rules, vitest suite (17 tests), production build w/ console stripping | ✅ Done |

**Actual tech stack:** TypeScript · webpack (panel bundle) + tsc (extension host) · `<img>` GIF rendering (no canvas) · vitest + jsdom · vsce for packaging.

---

## 2. Remaining Work

### Phase R1 — Rebrand & Legal Cleanup *(do first)*

1. **`package.json`:**
   - `name` / `displayName` → your own (e.g. `knp-pokemon`)
   - `publisher` → your ID (currently still `jakobhoeg`)
   - `repository` / `homepage` / `bugs` → `Cyberknp/KNP-pokemon`
   - `version` → start at `0.1.0`
   - Fix `"license"`: keep code license, add the image-copyright disclaimer (see §0)
2. **README.md:** add the Credits block from §0; document your settings.
3. **Verify:** `.vscodeignore` excludes sources/tests/node_modules from the `.vsix`.

**✅ Milestone R1:** Extension installs locally under your own name with correct attribution.

### Phase R2 — Hover Pokéball Click-to-Recall ⭐

The only unimplemented item from the original feature list:

- In `addPokemonToPanel()` (`src/panel/main.ts`), add a small Pokéball button that appears on hover of the collision element (CSS `:hover`).
- Click → trigger the existing recall flow (`pokeball-close` animation + fade-out).
- Respect `maxPokemon`/reduced-motion like other interactions.

**✅ Milestone R2:** Click any companion's Pokéball to recall it without opening the command palette.

### Phase R3 — Custom Pixel Backgrounds ⭐

Extend the **existing `Theme` system** (do not invent a parallel setting):

1. Create/source tileable pixel-art PNGs (Aseprite/Piskel, or CC0 tilesets from itch.io/OpenGameArt). ⚠️ Don't rip ROM backgrounds for anything public.
2. Follow the existing asset contract: `media/backgrounds/<theme>/background-{light,dark}-{nano,small,medium,large}.png` (+ optional foreground layer).
3. Add IDs to the `Theme` enum (`src/common/types.ts`), extend `FLOOR_HEIGHTS` in `src/panel/main.ts`, and add values to `vscode-pokemon.theme` in `package.json`.
4. Live switching already works through the config-change handler (`panel.update()`).

**✅ Milestone R3:** New background selectable from settings, persists, adapts to light/dark.

### Phase R4 — Optional Extras

- [ ] **Remaining Gen 5 sprites** — source from PokeAPI `generation-v/black-white/animated`, convert to `{name}_{anim}_8fps.gif`.
- [ ] **Asset compression** — install gifsicle, run `npm run optimize-assets`, commit shrunken GIFs (~50–70% smaller).
- [ ] **Recall-all cascade** — stagger recalls ~150 ms for a visual cascade (recall-all exists but is instant).
- [ ] **Unique instance IDs** — identity is name-based today; duplicate names make delete ambiguous. Add an instance counter for element identity.
- [ ] **Cries/sounds** on click (off by default; `cry` field exists in the registry).
- [ ] **Drag & drop repositioning.**
- [ ] **CI** — GitHub Action: `npm ci && npm run lint && npm run compile && npm test`.

---

## 3. Development Workflow

```bash
# Install dependencies
npm install

# Dev build (webpack dev bundle + tsc host)
npm run compile          # then press F5 (launch config ships in .vscode/)

# Production build (minified, console.* stripped)
npm run compile:prod     # also wired into vscode:prepublish

# Quality gates
npm run lint             # ESLint (no-var, radix, prefer-const enforced)
npm test                 # vitest — 17 state-machine tests (jsdom)

# Optimize sprite assets (one-time; requires gifsicle on PATH)
npm run optimize-assets

# Package & install locally
npx @vscode/vsce package
code --install-extension knp-pokemon-0.1.0.vsix

# Publish (optional, DMCA risk — prefer .vsix / Open VSX distribution)
npx @vscode/vsce publish
```

## 4. Key Technical Facts (for future changes)

1. **Rendering** — absolutely-positioned `<img>` GIFs animated natively; one shared 100 ms game loop advances all Pokémon (`ensureAnimationLoop()` in `src/panel/main.ts`). Never create per-Pokémon timers.
2. **State machine** — `src/panel/states.ts`, pure logic, covered by `tests/states.test.ts`. Transitions come from `ISequenceTree`s in `src/panel/pokemon.ts` / `base-pokemon-type.ts`.
3. **Host ↔ webview messaging** — `postMessage({ command })`; visibility uses `pause-pokemon`/`resume-pokemon`. Do not rebuild webview HTML for transient changes — post messages instead.
4. **Persistence** — party roster lives in `globalState` mementos (`EXTRA_POKEMON_KEY*`); per-panel layout lives in webview `setState`. Saved on spawn/recall/reset/pause + 30 s safety net.
5. **Registry** — split per generation (`src/common/pokemon-gen1–5.ts`), merged in `src/common/pokemon-data.ts` which preserves the original API. Sprite path convention: `media/{gen}/{pokemon}/{color}/{name}_{animation}_8fps.gif`.
6. **Sprite sizing** — per-Pokémon `originalSpriteSize` × size multiplier handles the Caterpie-vs-Rayquaza scale range.
7. **Webview security** — CSP nonce + `localResourceRoots: media/`; load everything through `asWebviewUri()`.
8. **Panel bounds** — recompute canvas/bounds on resize (`initCanvas()`); keep Pokémon clamped inside.

---

## 5. Learning Resources

- **Webview views API:** https://code.visualstudio.com/api/extension-guides/webview
- **PokeAPI sprites:** https://github.com/PokeAPI/sprites
- **vscode-pets** (pet-logic reference): https://github.com/tonybaloney/vscode-pets
- **vsce packaging:** https://code.visualstudio.com/api/working-with-extensions/publishing-extension
