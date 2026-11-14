# `aie` v1 — Agent Engineering & Swarm Rules (`AGENTS.md`)

Every agent working in this repository MUST read and follow these rules, along with `docs/VISION.md` and `docs/BLUEPRINT.md`.

## 1. Environment & Toolchain Commands (Read First!)

Non-interactive shells in macOS sandboxes do **not** source `~/.zshrc`. Always invoke `node` via its explicit nvm path or put `/Users/iluminar/.nvm/versions/node/v26.13.1/bin` on `PATH`:

- **Node binary**: `/Users/iluminar/.nvm/versions/node/v26.13.1/bin/node`
- **Bootstrap an isolated git worktree (`workspace: "share"`)**:
  ```sh
  /Users/iluminar/.nvm/versions/node/v26.13.1/bin/node scripts/bootstrap-worktree.mjs
  ```
  Run this FIRST if `node_modules` does not exist in your worktree—it symlinks the pre-installed `node_modules` inside the sandbox in < 0.1s with **zero network calls**.
- **Typecheck**:
  ```sh
  /Users/iluminar/.nvm/versions/node/v26.13.1/bin/node ./node_modules/typescript/bin/tsc --noEmit
  ```
- **Unit & Component Tests (Vitest)**:
  ```sh
  /Users/iluminar/.nvm/versions/node/v26.13.1/bin/node ./node_modules/vitest/vitest.mjs run
  ```
- **Build Main + Preload + Renderer (`electron-vite`)**:
  ```sh
  PATH="/Users/iluminar/.nvm/versions/node/v26.13.1/bin:/usr/bin:/bin:/usr/sbin:/sbin" ./node_modules/.bin/electron-vite build
  ```
- **Git Commits in Worktrees**:
  - `.git/` writes require `BypassSandbox: true` in Antigravity's terminal sandbox.
  - Global `~/.gitconfig` enables GPG signing (`commit.gpgsign=true`) via `/opt/homebrew/bin/gpg`. Keep GPG signing enabled on all commits by including `/opt/homebrew/bin:/usr/local/bin` on `PATH` during `git commit` (e.g., `PATH="/opt/homebrew/bin:/usr/local/bin:/Users/iluminar/.nvm/versions/node/v26.13.1/bin:/usr/bin:/bin:/usr/sbin:/sbin" git commit -S -m "..."`); do **not** pass `--no-gpg-sign`. Never push to `origin` unless explicitly instructed by the user.

## 2. Locked Product & Architectural Guardrails

1. **North Star (`docs/VISION.md`)**: `aie` v1 is a **Desktop Vocal Booth & Turnkey OpenUtau / vLabeler Voicebank Builder**.
   - **Never** add interactive `oto.ini` parameter-dragging editors (delegate to `vLabeler`; render `oto.ini` markers read-only on `<canvas>`).
   - **Never** add vocal synthesis / resamplers / reverb / EQ (record clean, dry PCM `.wav` with optional DC-offset removal).
   - **Never** use `window.alert()` or `window.confirm()` anywhere in the UI (use Radix dialogs or non-blocking status badges/toasts).
   - **Never** add native C++ or Rust Node addons (`node-gyp`). Keep 100% pure TypeScript + WebAudio `AudioWorklet`.
2. **Locked Decisions (`docs/BLUEPRINT.md`)**:
   - **Screen 1**: Merged **Welcome & Project Hub** (clean *Vocal Booth* studio header + 1-click *Resume Session* hero card, *Create/Open Project* with individual checkboxes for `character.txt`, `character.yaml`, and `prefix.map`, and *Recent Projects*).
   - **Diagnostics**: **100% offline / zero external cloud accounts** (`electron-log` v5 rotated logs + 1-click *Export Diagnostic Zip* via `fflate` + 5-click version badge DevTools unlock). Do **not** add `@sentry/electron`.
   - **macOS Target**: **Apple Silicon (`arm64`) only** (plus Windows `x64` NSIS and Linux `x64` AppImage/deb).
   - **i18n**: Static bundled `i18next` JSON namespaces across `en-US`, `zh-CN`, and `ja-JP` (**all 3 locales must have 100% complete translations**—never leave English placeholders in `ja-JP` or `zh-CN`).
   - **Strict `kebab-case` Filenames**: Every file across `src/**`, `tests/**`, and `scripts/**` MUST use strict lowercase `kebab-case` (`^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+)+$`, e.g., `app.tsx`, `studio-canvas.tsx`, `use-studio-hotkeys.ts`), and every directory segment must be `kebab-case` (`^[a-z0-9]+(-[a-z0-9]+)*$`) except BCP-47 locale directories (`en-US`, `zh-CN`, `ja-JP`) under `src/shared/i18n/locales/`. Enforced by `tests/unit/filename-conventions.test.ts`.

## 3. Parallel Swarm Ownership Boundaries (Zero File Collisions)

Shared contracts live in `src/shared/types/*` and `src/shared/music/chromatic.ts`. Treat `src/shared/types/*` as **frozen public contracts** during parallel workstreams; if an addition is needed, coordinate with `@coordinator` first.

| Workstream Slice | Owned Paths | Must NOT Touch |
| :--- | :--- | :--- |
| **`domain-core`** | `src/shared/parsers/**`, `src/main/services/voicebank/**`, `src/main/services/project/**`, `resources/reclists/**`, `tests/unit/domain/**` | `src/renderer/**`, `electron.vite.config.ts` |
| **`audio-dsp`** | `src/renderer/src/audio/**`, `tests/unit/audio/**` | `src/main/**`, `src/renderer/src/components/**` |
| **`main-devops`** | `src/main/**` *(except `services/{voicebank,project}`)*, `src/preload/**`, `.github/workflows/**`, `electron-builder.yml`, `tests/unit/main/**` | `src/renderer/**`, `src/shared/parsers/**` |
| **`i18n-hub-project`** | `src/shared/i18n/**`, `src/renderer/src/store/**`, `src/renderer/src/components/{shell,hub,project,modals}/**`, `src/renderer/src/app.tsx`, `tests/unit/ui-hub/**` | `src/renderer/src/components/studio/**`, `src/main/**` |
| **`studio-ui`** | `src/renderer/src/components/studio/**`, `tests/unit/studio/**` | `src/renderer/src/components/{hub,project}/**`, `src/main/**` |
| **`verifier`** | `tests/e2e/**` *(plus read-only inspection & running `tsc`, `vitest`, `electron-vite build`, `playwright` across merged work)* | Production source files (report bugs to the owning author!) |
