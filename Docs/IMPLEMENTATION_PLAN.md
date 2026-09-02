# Implementation Plan — First Release

**Project:** KNPs Pokémon (fork of `jakobhoeg/vscode-pokemon`)
**Repo:** Cyberknp/KNP-pokemon (branch `develop`)
**Version:** 0.1.0 · **Extension ID:** `Cyberknp.knps-pokemon`
**Package output:** `knps-pokemon-0.1.0.vsix`

---

## 1. Goal

Assess first-release readiness, fix any blockers, and set up GitHub Actions publishing so tagging `v0.1.0` builds, tests, packages, and releases the `.vsix`.

## 2. Verified & Done (readiness assessment)

- **Tests pass:** `npm test` → 23/23 (states 15, backgrounds 8); `tests/states.test.ts` cleaned of stale references.
- **Build green:** `tsc` both configs pass; webpack compiles successfully; ESLint 0 errors / 4 pre-existing `any` warnings (extension.ts:830/939/974, pokemon-collection.ts:85).
- **Cross-check clean:** every command / menu / keybinding / activation registered; zero orphans; 11 config props; `setContext` matches `when` clause.
- **Repro dependency fix:** `vitest` missing from devDeps — reinstalled (requires `--legacy-peer-deps` due to pre-existing peer conflict); `package-lock.json` regenerated and must be committed.
- **Working tree:** on `develop`, **no untracked files**, 9 modified files ready to commit; build artifacts fresh (`media/main-bundle.js` 240 KB, `out/extension/extension.js` 51 KB).
- **Packaging inputs verified:** `icon.png`, `LICENSE`, `package.json`, `l10n/bundle.l10n.en-{US,GB}.json` present; `.gitignore` excludes `out`, `dist`, `media/main-bundle.js`, `*.vsix`.

## 3. Blocker — FIXED

- **`.vscodeignore` did not exclude `node_modules/`** — ✅ fixed, `node_modules/**` appended.

## 4. Decisions (resolved)

| # | Question | Decision |
|---|---|---|
| Q1 | `package.json` license vs `LICENSE`/README | ✅ Aligned to `"CC0-1.0"` |
| Q2 | Add `@vscode/vsce` to devDependencies | ✅ Done (v3.9.2) |
| Q3 | Publish to Marketplace | Only from `main`-originated tags, gated by `VSCE_PAT` secret |
| Q4 | Node version in CI | 22 |
| Q5 | Build + release jobs | Single job |

## 5. Implementation Steps

1. ✅ Align `package.json` license → `"CC0-1.0"`.
2. ✅ `npm i -D @vscode/vsce` (records lockfile change).
3. ✅ Append `node_modules/**` to `.vscodeignore`.
4. ✅ Create `.github/workflows/release.yml` (see §6).
5. ☐ Optional: `CHANGELOG.md`.

## 6. GitHub Actions (`release.yml` — created)

- Trigger: `push.tags ['v*']`.
- Single job `ubuntu-latest`: checkout → setup-node 22 + npm cache → `npm ci --legacy-peer-deps` → `npm run lint` → `npm run compile:prod` (**explicit** — `vscode:prepublish` is NOT triggered by `vsce package`) → `npm test` → `npx vsce package` → determine if tagged commit is on `main` → `gh release create` (attach vsix) → marketplace publish **only when** `steps.branch.outputs.on-main == 'true' && env.VSCE_PAT != ''`.
- `permissions: contents: write`; built-in `gh` CLI (no third-party action).
- Prerequisite for marketplace publish: set `VSCE_PAT` secret (publisher `Cyberknp`) in repo settings. Without it, only the GitHub Release is created.

## 7. Release / git flow (commit-by-commit)

1. `git add src/extension/extension.ts src/panel/main.ts tests/states.test.ts && git commit -m "feat: fix panel recall regression and stale tests for release"`

> Also fixes a **PR #13 review finding** (`extension.ts` `spawn-pokemon`): the generation-browse path called `disposables.forEach(dispose)` + `qp.dispose()`, disposing the `onDidHide` listener that resolves the picker loop, so `await closed` (extension.ts:994) hung forever and the "+" button could never spawn a Pokémon via the two-level QuickPick. `closed` is now forwarded a `resolveClosed` you can trigger from the generation path, and the search/cancel paths still resolve via `onDidHide`.
>
> Also fixes the second **PR #13 review finding** (sprites floating above the ground in snow/forest): sprite GIFs ship 1–4px of transparent bottom padding, so feet rendered above the floor line (scaled ~2–8px on screen). `BasePokemonType` now measures the first loaded sprite frame's transparent bottom padding (canvas, alpha>30) and sinks the sprite (and its collision box / speech bubble) by that pad × render scale, so feet sit exactly on the floor. Falls back to no shift if measurement is unavailable; `positionBottom`/jump arcs apply the same shift for consistency.

2. `git add package.json package-lock.json && git commit -m "chore: license CC0; add @vscode/vsce devDependency"`
3. `git add .vscodeignore && git commit -m "chore: exclude node_modules from packaged vsix"`
4. `git add .github/workflows/release.yml && git commit -m "ci: add tag-triggered release workflow with marketplace publish"`
5. `git add Docs/IMPLEMENTATION_PLAN.md && git commit -m "docs: record first-release plan and decisions"`
6. Tag `v0.1.0` on `main` (or a commit that is an ancestor of `main`), push tag; the workflow builds, tests, packages, and (from `main`) publishes. `gh release create` is handled by the workflow itself.

## 8. Dry-run & Verification

1. Tag `v0.1.0-dryrun` → push → confirm the Actions run completes (Release + GitHub Release created).
2. Download the asset; `unzip -l *.vsix` → verify only `out/extension/`, `media/`, `l10n/`, `LICENSE`, `icon.png`, `package.json`, no `node_modules/`.
3. `code --install-extension *.vsix` → smoke-test launch.
4. Delete the dry-run tag/release.

## 9. Known Constraints

- **vsce packaging blocked locally:** `npx @vscode/vsce package` fails on unauthenticated `code.visualstudio.com/api` fetch — CI runner will package; local block is fine.
- `node v24.15.0`, `npm 12.0.2`; npm installs need `--legacy-peer-deps` (workflow uses `npm ci --legacy-peer-deps`).
- Marketplace publish requires the `VSCE_PAT` secret (publisher `Cyberknp`); the workflow skips it if unset or the tag is not on `main`.
- Build pipeline: `compile:panel` → webpack (`src/panel/main.ts` → `media/main-bundle.js`); `compile:extension` → `tsc -p ./tsconfig.extension.json` → `out/extension/extension.js`.
- `l10n/tsconfig.json` not wired into any npm script (static l10n ships as-is).
- `scripts/optimize-assets.mjs` needs optional `gifsicle`; `scripts/generate-backgrounds.mjs` not needed for release.
- `Docs/PR_DEVELOP_TO_MAIN.md` does not exist — optional PR-narrative doc.

## 10. Relevant Files

- `.vscodeignore` — ✅ `node_modules/**` appended; ships `out/extension/`, `media/`, `l10n/`, `LICENSE`, `icon.png`, `package.json`.
- `.github/workflows/release.yml` — ✅ created (tag-triggered, single job, node 22, marketplace publish gated to `main` + `VSCE_PAT`).
- `package.json` — brand, `knps-pokemon.*` config, ✅ `license: "CC0-1.0"`, ✅ `@vscode/vsce` devDependency, version 0.1.0.
- `package-lock.json` — regenerated by devDeps fix; must be committed.
- `src/extension/extension.ts`, `src/panel/main.ts`, `tests/states.test.ts` — pending commits staged for release.
- `README.md`, `Docs/codebase_handbook.md`, `Docs/Features.md`, `Docs/TESTING_VIGNETTE.md` — already aligned to current code + KNPs branding.