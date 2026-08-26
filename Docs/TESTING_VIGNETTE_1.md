# 🧪 Testing Vignette 1 — Background Themes

**A dead-simple, step-by-step guide to test the background scenes feature.**
No prior knowledge needed. Follow the steps in order, tick the checkboxes as
you go. If every box is ticked, the feature works.

> **What you are testing:** that Pokémon appear *in front of* a scenery image,
> with scenery props (trees/walls) *in front of* them, and that you can switch
> scenes from Settings.
>
> **Before starting:** run `npm run compile`, then press **F5** in VS Code to
> open the **Extension Development Host** window. All testing happens in that
> new window.

---

## Test 1 — Default: no background (baseline)

**What:** confirm nothing shows when the theme is off.

1. In the Dev Host window press `Ctrl+Shift+P` → type **Start pokemon coding session** → Enter.
2. Spawn one Pokémon: `Alt+Shift+W` → pick any.
3. Look at the panel.

- [ ] Panel background is plain (matches your editor colors) — **no scenery**.
- [ ] The Pokémon walks around normally on the bottom edge.

✅ If yes → baseline OK. Continue.

---

## Test 2 — Turn ON a theme (forest)

**What:** confirm the main feature — scenery appears behind and in front of Pokémon.

1. Open Settings (`Ctrl+,`) → search for **pokemon theme**.
2. Set **Vscode Pokemon › Theme** to `forest`.
3. Watch the panel (it should repaint by itself within ~1 second).

- [ ] A forest scene appears **behind** the Pokémon (sky/hills at the back).
- [ ] Foreground props (trees/grass band) appear **in front of** the Pokémon's feet — they look like they're walking *behind* the trees.
- [ ] The Pokémon walks on the raised ground line, not floating in mid-air.

✅ If yes → core feature works. Continue.

---

## Test 3 — Try the other two themes

**What:** confirm every shipped theme renders.

Repeat the same steps as Test 2, once with each value:

| Set theme to | Expected scene |
|---|---|
| `castle` | Castle walls / stone scene |
| `beach` | Sea / sand scene |

- [ ] `castle` renders its own unique scene.
- [ ] `beach` renders its own unique scene.
- [ ] Each looks different from the others (not the same picture reused).

✅ If yes → all themes render. Continue.

---

## Test 4 — Switching themes live (no restart)

**What:** confirm changing the setting updates the panel instantly.

1. With Pokémon on screen, change theme from `forest` → `beach`.

- [ ] Scene swaps immediately — you did NOT reload or restart anything.
- [ ] Your Pokémon stayed exactly where they were (same positions).

2. Change theme back to `none`.

- [ ] Scenery disappears completely, plain panel returns.

✅ If yes → live switching works. Continue.

---

## Test 5 — Dark vs light editor theme

**What:** confirm the correct variant of each scene loads.

1. Keep a theme active (e.g. `forest`).
2. `Ctrl+Shift+P` → **Preferences: Color Theme** → pick a **Dark** theme (e.g. Dark+).
3. Then switch to a **Light** theme (e.g. Light+).

- [ ] With dark VS Code theme → darker version of the scene.
- [ ] With light VS Code theme → brighter/day version of the scene.

✅ If yes → variants work. Continue.

---

## Test 6 — Every Pokémon size

**What:** confirm the art scales correctly for each size setting.

1. Settings → **Vscode Pokemon › Pokemon Size**, try each: `nano`, `small`, `medium`, `large`.

For each size:

- [ ] Background/foreground images change resolution (sharper when bigger).
- [ ] Pokémon still walk on the ground line — not sunk into the foreground props, not floating above them.

✅ If yes → sizes work. Continue.

---

## Test 7 — Persistence after restart

**What:** confirm your theme choice survives closing VS Code.

1. Set theme to `castle`. Note which Pokémon are out.
2. Close the whole Dev Host window. Press F5 again to relaunch.
3. Start the session again if the panel doesn't auto-show.

- [ ] Theme is still `castle` in Settings.
- [ ] The castle scene renders again.

✅ If yes → persistence works. Continue.

---

## Test 8 — Both panel positions

**What:** confirm backgrounds work in both locations the panel can live.

1. Settings → **Vscode Pokemon › Position** → set to `panel`.
   - Reopen via command palette → **Start pokemon coding session**.
   - [ ] Scene renders in the editor-tab panel too.
2. Set position back to `explorer`.
   - [ ] Scene renders in the sidebar view again.

✅ If yes → positions work.

---

## Test 9 — Bad input doesn't break it

**What:** confirm a nonsense value falls back safely.

1. Open settings.json (`Ctrl+Shift+P` → **Preferences: Open User Settings (JSON)**).
2. Add manually: `"vscode-pokemon.theme": "underwater-the-movie"`
3. Save, watch the panel.

- [ ] No crash, no error popup.
- [ ] Falls back to plain panel (theme = none).
4. Remove the line afterwards.

✅ If yes → validation works.

---

## Test 10 — Small-window behaviour

**What:** confirm the scene tiles sideways instead of breaking.

1. Keep a theme active. Drag the sidebar divider to make the panel narrow, then very wide.

- [ ] Scene stretches/tiles horizontally without gaps or ugly cut seams at the edges.
- [ ] Pokémon stay inside the visible area.

✅ If yes → layout robust.

---

## 🏁 Result

| Tests passed | Verdict |
|---|---|
| All 10 | Feature fully working ✅ |
| 1–6 only | Core works; polish issues — note which test failed |
| Test 2 fails | Main feature broken — check `vscode-pokemon.theme` is saved, recompile, retry |

### If something fails, grab this info first:

1. Which test number failed and what you saw (screenshot helps).
2. Help → **Toggle Developer Tools** → Console tab → copy any red errors.
3. Confirm compile ran: `npm run compile` output ended without errors.

---

## Addendum — new Background Beauty features

These cover the features added when the plan in `BACKGROUND_BEAUTY.md` was
implemented. Run them after Tests 1–10.

### Test 11 — New scenes (volcano, snow)

1. Settings → **Vscode Pokemon › Theme** → try `volcano`, then `snow`.

- [ ] `volcano` shows a banded ember sky, a volcano cone, and a dark basalt
      ground with glowing lava cracks.
- [ ] `snow` shows a pale sky, hills, and pine trees on a snow field.
- [ ] Pokémon walk on the raised ground line in both.

### Test 12 — Theme picker button (no Settings needed)

1. Look at the **VS Code Pokémon** panel title bar (Explorer sidebar) — there
   should be a small landscape icon (also in the palette:
   *"Pokemon Coding: Select background theme"*).
2. Click it → pick `beach`.

- [ ] QuickPick lists all 6 options, current one marked "Current".
- [ ] Panel repaints to the beach scene instantly, no restart.
- [ ] Pressing Esc cancels without changing anything.

### Test 13 — Parallax drift (volcano/snow only)

1. Set theme to `snow` (or `volcano`) and spawn a Pokémon.
2. Watch the sky for ~30 seconds.

- [ ] A faint cloud/ember band drifts slowly sideways behind the Pokémon.
- [ ] Set `motion: reduced` → drift stops completely.
- [ ] Set theme to `forest` → no drift layer, no broken-image artifacts.

### Test 14 — Day/night cycle

1. Set theme to `snow`, then enable **Vscode Pokemon › Day Night Cycle**.

- [ ] Between 7 PM–6 AM the **dark** variant loads; between 6 AM–7 PM the
      **light** variant loads — regardless of your VS Code color theme.
- [ ] Turning the setting off returns control to your VS Code color theme
      (Test 5 behaviour).

### Test 15 — Random theme

1. Enable **Vscode Pokemon › Random Theme** and reload the Dev Host (F5).

- [ ] A random scene (never `none`) appears on session start.
- [ ] Reload again within the same window — the scene **stays the same**
      (cached per session, no flicker).
- [ ] Disable the setting → your fixed `theme` choice returns.
