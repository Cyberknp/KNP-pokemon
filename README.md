<div align='center'>

# KNP Pokémon

![icon](icon.png)

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

## What's different from the original

- 🎾 **Hover Pokéball recall** — hover any companion and click its Pokéball to
  recall it instantly, no command palette needed.
- 🎉 **Recall-all cascade** — "Remove All" recalls the party in a rippling
  stagger instead of all at once.
- 👥 **Configurable party cap** (`vscode-pokemon.maxPokemon`) with a friendly
  "party is full" notice.
- ♻️ **Unique-name safeguard** — freshly spawned companions can never share a
  name, so recall/friend lookups stay unambiguous.
- ⚡ **Performance overhaul** — one shared animation loop, debounced state
  saves, pause-on-hide, reduced-motion support (`vscode-pokemon.motion`),
  debug logging toggle, production builds with console stripping.
- 🧪 **Quality tooling** — ESLint strict rules, vitest state-machine test
  suite, GIF asset-compression pipeline.

## Building & running locally

```bash
# 1. Install dependencies
npm install

# 2. Compile (webpack — node + web targets)
npm run compile

# 3. Run: press F5 in VS Code to open the Extension Development Host
```

### Packaging

```bash
npx @vscode/vsce package   # produces a .vsix you can install locally:
code --install-extension knp-pokemon-0.1.0.vsix
```

## Usage

Open the command palette (`Ctrl+Shift+P` on Windows/Linux or `Cmd(⌘)+Shift+P`
on MacOS) and run the "Start Pokemon coding session" command to spawn your
first Pokémon. Release new ones via the picker (`Alt+Shift+W` for a random
spawn), hover a companion and click its Pokéball to recall it individually, or
use "Remove All Pokemon" to watch the cascade clear the panel.

### Settings

| Setting | Default | Description |
|---|---|---|
| `vscode-pokemon.pokemonSize` | `medium` | Sprite scale (nano/small/medium/large) |
| `vscode-pokemon.position` | `explorer` | Sidebar view or editor tab |
| `vscode-pokemon.theme` | `none` | Background scene (none/forest/castle/beach/volcano/snow) |
| `vscode-pokemon.dayNightCycle` | `false` | Switch scenes to dark/light variants by time of day |
| `vscode-pokemon.randomTheme` | `false` | Pick a random scene once per session |
| `vscode-pokemon.throwBallWithMouse` | `true` | Throw a Pokéball to recall a Pokémon on click |
| `vscode-pokemon.defaultPokemon` | `[]` | Party auto-spawned at startup — each entry: `type` ('random' allowed), optional `name`, `shiny`, and `pool` (for random) |
| `vscode-pokemon.shinyOdds` | `8192` | 1-in-N shiny chance |
| `vscode-pokemon.maxPokemon` | `6` | Maximum simultaneous Pokémon |
| `vscode-pokemon.motion` | `system` | Animation preference (system/always/reduced) |
| `vscode-pokemon.debug` | `false` | Verbose webview logging |

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
