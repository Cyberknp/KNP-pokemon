# Bugfixes Implementation Plan

**Target:** Fix all blockers and should-fix issues before merging `develop` → `main` (PR #4)

---

## 🔴 Blockers (Must Fix)

### B-1: Remove `dev_session.md` from `develop`
- **Impact:** 5,479-line session log will ship to `main`
- **Files:** `dev_session.md`, `.gitignore`
- **Fix:**
  ```bash
  git checkout develop
  git rm --cached dev_session.md
  echo "dev_session.md" >> .gitignore
  git commit -m "chore: remove dev session log, ignore going forward"
  ```

### B-2: Fix `StandLeftState` label typo
- **Impact:** State persistence/recovery broken for left-facing standing Pokémon
- **File:** `src/panel/states.ts:439`
- **Current:** `label = States.standRight;`
- **Fix:** `label = States.standLeft;`
  ```bash
  sed -i 's/label = States.standRight;/label = States.standLeft;/' src/panel/states.ts
  git commit -am "fix: StandLeftState label typo"
  ```

---

## 🟡 Follow-up (Post-Merge, Optional)

### S-1: Declare `throwBallWithMouse` setting in `package.json`
- **Impact:** Setting works but invisible in Settings UI
- **File:** `package.json` → `contributes.configuration.properties`
- **Add:**
  ```json
  "vscode-pokemon.throwBallWithMouse": {
    "type": "boolean",
    "default": true,
    "description": "Click on Pokémon to throw a Pokéball and recall it."
  }
  ```

### S-2: Clear `dayNightTimer` on webview unload
- **Impact:** Timer leak when webview destroyed
- **File:** `src/panel/main.ts` → `stopAnimationLoop()`
- **Fix:**
  ```typescript
  function stopAnimationLoop(): void {
    pauseAnimationLoop();
    activeStateApi = undefined;
    if (dayNightTimer !== null) {
      clearInterval(dayNightTimer);
      dayNightTimer = null;
    }
  }
  ```

### S-3: Remove dead `browser` field from `package.json`
- **Impact:** Points to non-existent `./dist/web/extension-web.js`
- **File:** `package.json:49`
- **Fix:** Delete the line `"browser": "./dist/web/extension-web.js",` or implement the web build.

---

## 🟡 Follow-up (Post-Merge, Optional)

### F-1: Hand-drawn scene art
- **Files:** `media/backgrounds/{volcano,snow}/*.png`
- **Note:** Current art is procedural placeholder from `scripts/generate-backgrounds.mjs`. Replace with hand-drawn art using identical filenames.

### F-2: Localize "None" theme label
- **File:** `src/extension/extension.ts:1138`
- **Issue:** `vscode.l10n.t('None')` key missing from l10n bundle
- **Fix:** Add `"None": "None"` to `l10n/bundle.l10n.en-US.json` (and en-GB)

### F-3: Detect midground assets instead of hardcoding
- **File:** `src/common/types.ts:97-101` → `THEMES_WITH_MIDGROUND`
- **Current:** Hardcoded `[Theme.volcano, Theme.snow]`
- **Proposed:** Check filesystem for `midground-*.png` at runtime or build time

### F-4: Verify `forest`/`castle` floor heights
- **File:** `src/panel/main.ts:146-159`
- **Concern:** `castle/large = 120px` may place Pokémon too high visually
- **Action:** Manual visual test in Dev Host

### F-5: Remove bad devDependency `typescript-eslint@^0.0.1-alpha.0`
- **File:** `package.json:303`
- **Fix:** `npm uninstall typescript-eslint`

### F-6: `randomTheme` workspace collision
- **File:** `src/extension/extension.ts:36` → `RANDOM_THEME_CACHE_KEY`
- **Issue:** Uses `workspaceState` — multiple workspaces share cache
- **Fix:** Use `globalState` or prefix key with workspace folder hash

---

## Execution Order

```bash
# 1. Blockers
git checkout develop
git rm --cached dev_session.md && echo "dev_session.md" >> .gitignore
sed -i 's/label = States.standRight;/label = States.standLeft;/' src/panel/states.ts
git commit -am "fix: remove dev_session.md + StandLeftState label"

# 2. Should-fix (manual edits)
# - Edit package.json: add throwBallWithMouse setting + remove browser field
# - Edit src/panel/main.ts: clear dayNightTimer in stopAnimationLoop()

# 3. Verify
npm run lint && npm run compile && npm test

# 4. Push → PR #4 auto-updates
git push origin develop
```

---

## Verification Checklist

- [ ] `dev_session.md` untracked + in `.gitignore`
- [ ] `StandLeftState.label === States.standLeft`
- [ ] `throwBallWithMouse` appears in VS Code Settings UI
- [ ] No timer leak: open/close panel multiple times, check DevTools console
- [ ] `browser` field removed from `package.json`
- [ ] All tests pass (`npm test` → 25 passed)
- [ ] Lint clean (`npm run lint` → 0 errors)
- [ ] Compile passes (`npm run compile`)