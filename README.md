<div align='center'>

# KNPs Pokémon

![KNPs Pokémon logo](icon.png)

</div>

<p align="center">
    A personal fork of <a href="https://github.com/jakobhoeg/vscode-pokemon">vscode-pokemon</a> —
    cute Pokémon in your code editor, extended with new interactions and backgrounds ✨
</p>

---

> **About this fork:** This project is a customized version of
> [jakobhoeg/vscode-pokemon](https://github.com/jakobhoeg/vscode-pokemon) (CC0).
> The original code has been modified and extended with the features listed
> below. This repository is a non-commercial fan project and is not affiliated
> with Nintendo, The Pokémon Company, or Game Freak.

## What's different

On top of the classic wandering companions, this fork adds:

- 🎾 **Hover-to-interact + Pokéball recall** — hover any companion to make it
  swipe, then click its Pokéball to recall it instantly — no command palette
  needed. "Remove All" recalls the whole party with a rippling 150 ms cascade
  (instant under reduced motion).
- 👥 **Party management** — a configurable cap (`knps-pokemon.maxPokemon`,
  1–15) with a friendly "party is full" notice, plus a unique-name safeguard
  so freshly spawned companions never share a name.
- 👯 **Friendship** — overlapping Pokémon introduce themselves with a heart
  bubble and chase-play together.
- 🌍 **Background Beauty scenes** — six switchable scenes
  (forest/castle/beach/volcano/snow) built from layered background, optional
  parallax midground, and foreground art — with automatic dark/light
  day-night variants (`knps-pokemon.dayNightCycle`) and per-session random
  scene rotation (`knps-pokemon.randomTheme`).
- ⚡ **Performance overhaul** — one shared 100 ms animation loop (no
  per-Pokémon timers), a friend scan every 5 ticks, a 30 s position-save
  safety net, pause-on-hide, reduced-motion support (`knps-pokemon.motion`),
  a debug logging toggle, and production builds that strip console output.
- ♻️ **Rebrand with built-in migration** — the extension is now
  `knps-pokemon` (`vscode-pokemon` remains as the legacy identity); settings
  and your saved party are read from both and migrated automatically.
- 🧪 **Quality tooling** — ESLint strict rules, a vitest state-machine +
  background test suite (23 tests), a GIF asset-compression pipeline, and
  clean `compile` / `compile:prod` / `watch` scripts.

### How this compares to the inspirations

- **jakobhoeg/vscode-pokemon** — the foundation: animated pixel-art
  companions, spawn/recall commands, the Pokéball release animation, and the
  Gen 1–5 sprite registry are carried over from this (CC0) project.
- **tonybaloney/vscode-pets** — the stylistic reference for approachable,
  always-available companions and the scene/theme ideas this fork explores.
- **KNPs Pokémon adds** — hover-to-swipe + Pokéball click-to-recall, the
  recall-all cascade, friendship pairs, the six-scene day/night/random
  background system, party caps + unique names, performance and QA hardening,
  and the `knps-pokemon` rebrand with automatic legacy migration.

## Building & running locally

```bash
# 1. Install dependencies
npm install

# 2. Compile (webpack panel bundle + tsc host)
npm run compile

# 3. Run: press F5 in VS Code to open the Extension Development Host
```

### Install from a release

Every tagged release publishes a ready-to-install `.vsix` to the GitHub
Releases page (see [Releases](https://github.com/Cyberknp/KNP-pokemon/releases)):

```bash
# Download knps-pokemon-<version>.vsix from the release, then:
code --install-extension knps-pokemon-0.1.0.vsix
```

### Build & package locally

```bash
npx @vscode/vsce package   # produces a .vsix you can install locally:
code --install-extension knps-pokemon-0.1.0.vsix
```

## Usage

Open the command palette (`Ctrl+Shift+P` on Windows/Linux or `Cmd(⌘)+Shift+P`
on MacOS) and run the "Start Pokemon coding session" command to spawn your
first Pokémon. Spawn more from the picker (`Alt+Shift+W`) or instantly at
random (`Alt+Shift+Q`), hover a companion and click its Pokéball to recall it
individually, or use "Remove All Pokemon" to watch the cascade clear the panel.

### Settings

| Setting | Default | Description |
|---|---|---|
| `knps-pokemon.pokemonSize` | `medium` | Sprite scale (nano/small/medium/large) |
| `knps-pokemon.position` | `explorer` | Sidebar view or editor tab |
| `knps-pokemon.theme` | `none` | Background scene (none/forest/castle/beach/volcano/snow) |
| `knps-pokemon.dayNightCycle` | `false` | Switch scenes to dark/light variants by time of day |
| `knps-pokemon.randomTheme` | `false` | Pick a random scene once per session |
| `knps-pokemon.throwBallWithMouse` | `true` | Throw a Pokéball to recall a Pokémon on click |
| `knps-pokemon.defaultPokemon` | `[]` | Party auto-spawned at startup — each entry: `type` ('random' allowed), optional `name`, `shiny`, and `pool` (for random) |
| `knps-pokemon.shinyOdds` | `8192` | 1-in-N shiny chance |
| `knps-pokemon.maxPokemon` | `6` | Maximum simultaneous Pokémon |
| `knps-pokemon.motion` | `system` | Animation preference (system/always/reduced) |
| `knps-pokemon.debug` | `false` | Verbose webview logging |

## Credits

### Code

- Based on [vscode-pokemon](https://github.com/jakobhoeg/vscode-pokemon) by
  [jakobhoeg](https://github.com/jakobhoeg) (CC0)
- Inspired by [vscode-pets](https://github.com/tonybaloney/vscode-pets) by
  [tonybaloney](https://github.com/tonybaloney)
- Maintained by [Cyberknp](https://github.com/Cyberknp)

### Sprite Sources

- Pokemon Sprites: © The Pokémon Company / Nintendo / Game Freak
- The sprites are used for non-commercial, fan project purposes only
- Original sprite artwork belongs to the respective copyright holders
- This repository is a fan project and is not affiliated with Nintendo,
  The Pokémon Company, or Game Freak

## License

Code is released under CC0 1.0 Universal (public domain) — see [LICENSE](LICENSE).
All image contents remain © The Pokémon Company / Nintendo / Game Freak.
