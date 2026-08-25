<div align='center'>

# VS Code Pokémon (Custom)

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

- 🎾 **Improved Pokéball recall/release UX** — hover Pokéball button per Pokémon,
  QuickPick release flow, recall-all cascade, and a configurable party cap.
- 🖼️ **Selectable pixel-art backgrounds** for the pet panel (grass, cave, beach,
  town, route, water, snow) with live switching and persistence.
- 🔧 General customization: movement tweaks, speed/idle tuning, and roster
  cleanup across Generations 1–5.

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
code --install-extension vscode-pokemon-custom-0.0.1.vsix
```

## Usage

Open the command palette (`Ctrl+Shift+P` on Windows/Linux or `Cmd(⌘)+Shift+P`
on MacOS) and run the "Start Pokemon coding session" command to spawn your
first Pokémon. Release new ones via the picker, recall them by clicking their
Pokéball, or use "Recall All" to clear the panel.

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
