# `aie` v1 — Parallel Swarm Execution Plan

Phase 0 has already locked `src/shared/types/*`, `src/shared/music/chromatic.ts`, `resources/reclists/*`, `tests/fixtures/encodings/*`, and pre-installed `node_modules` so parallel workers can build simultaneously in isolated worktrees (`workspace: "share"`) with **zero file collisions**.

## Workstream Roster (5 Authors + 1 Verifier)

### 1. `domain-core` (Voicebank Parsers, Charset Engine & Singer Scaffolding)
- **Owns**: `src/shared/parsers/**`, `src/main/services/voicebank/**`, `src/main/services/project/**`, `resources/reclists/**`, `tests/unit/domain/**`
- **Deliverables**:
  - Charset detection & decoding (`chardet` + `iconv-lite`) passing all 13 fixtures in `tests/fixtures/encodings/`.
  - OREMO reclist parser (`start`, `@comment`, `end`, case-insensitive duplicate filename counter `_1`, `_2`).
  - `OREMO-comment.txt` parser + built-in X-SAMPA phonetic hint generator for `delta_eng_ver5`.
  - `oto.ini` parser + subbank alias suffixer (`alias` -> `alias_G4`).
  - Turnkey OpenUtau / vLabeler scaffolding (`character.txt`, UTF-8 `character.yaml` with `subbanks` & `text_file_encoding: utf-8`, `prefix.map`, companion file copier).
  - Project persistence (`aie.project.json`), legacy `v0.x` `aie.config.json` auto-migrator, and raw OREMO folder importer.

### 2. `audio-dsp` (WebAudio Worklet, Pitched Guide Synth, F0/FFT & WAV Hygiene)
- **Owns**: `src/renderer/src/audio/**`, `tests/unit/audio/**`
- **Deliverables**:
  - Pure-TS lossless WAV encoder/decoder (`wavefile`) supporting `44.1/48 kHz` & `16/24/32-bit`, automatic **DC-offset removal** (`x[n] - mean(x)`), peak dBFS / clipping detection, and early-cutoff warning check.
  - Real-time `AudioWorklet` capture processor + `pitchy` `f0` pitch tracker + 64-band vocal spectrogram analyzer.
  - Sample-clock-locked **Pitched BPM Metronome / Guide Synth** + custom BGM buffer player + harmonic Reference Scale Synth (`S` key) with `setSinkId` output device routing and live Mic Check loopback monitor.

### 3. `main-devops` (Electron Main, Preload IPC, Offline Diagnostics & 2026 CI/CD)
- **Owns**: `src/main/**` *(integrating `domain-core` services)*, `src/preload/**`, `.github/workflows/**`, `electron-builder.yml`, `tests/unit/main/**`
- **Deliverables**:
  - Full `AieBridgeApi` IPC implementation in `src/main/` and `src/preload/index.ts`.
  - App settings & recent-projects store (`userData/app-state.json`), 1-step retake backup buffer (`.aie-undo/`), OS Trash deletion (`shell.trashItem`), `chokidar` directory watcher, and external launcher (*Open in vLabeler / OpenUtau*).
  - **Offline Diagnostics**: `electron-log` v5 rotated logs (`~` path scrubbing) + 1-click **Export Diagnostic Zip** (`fflate`) + 5-click DevTools toggle.
  - Auto-updater (`electron-updater`) with `aie Beta` channel support and unsigned macOS GitHub Release fallback.
  - `.github/workflows/ci.yml` and `.github/workflows/release.yml` (`macos-15` `arm64`, `windows-latest` `x64`, `ubuntu-24.04` `x64`).

### 4. `i18n-hub-project` (3-Locale Typed i18n, App Store, Modals, Screen 1 & Screen 2)
- **Owns**: `src/shared/i18n/**`, `src/renderer/src/store/**`, `src/renderer/src/components/{shell,hub,project,modals}/**`, `src/renderer/src/App.tsx`, `tests/unit/ui-hub/**`
- **Deliverables**:
  - Strict-typed `i18next` setup + **100% translated** `en-US`, `zh-CN`, and `ja-JP` JSON files + `locale-parity.test.ts`.
  - Zustand store connecting `window.aie` across Hub, Project Workspace, Studio, and Settings.
  - **Screen 1 (Welcome & Project Hub)**: *"Link Start"* hero, 1-click *Continue Last Session*, Create/Open Project, searchable Recent Projects.
  - **Screen 2 (Project & Recording Sets)**: Set cards with progress bars, Create/Edit Set form (root/subfolder, chromatic scale + Audition Pitch, reclist + encoding + guide audio), Ecosystem Handoff bar (*vLabeler* / *OpenUtau*), Slide-Over Metadata/README Drawer, and Safe Set Removal dialog.
  - **Global Modals**: Audio & App Settings (I/O dropdowns, WAV format, Mic Check meter) + About & Licenses (Built-in Reclists tab, OSS Libraries search tab, Chromium notices, Export Diagnostic Zip, 5-click Version DevTools unlock).

### 5. `studio-ui` (Screen 3: The Recording Studio, 60 fps Canvas & PTT Ergonomics)
- **Owns**: `src/renderer/src/components/studio/**`, `tests/unit/studio/**`
- **Deliverables**:
  - Unified 60 fps `<canvas>` renderer (oscilloscope waveform + scrolling 64-band vocal spectrogram + `f0` pitch curve vs. target note + read-only `oto.ini` beat grid + playback cursor + quiet-take visual zoom).
  - Keyboard state machine (`R` Hold-to-Record PTT & Toggle modes with `window` `blur` safety, `Space` play/stop, `S` reference pitch hold/toggle, Arrow/`N` navigation, `Delete` trash take) + unit tests.
  - Prompt carousel (Prev/Current/Next, `OREMO-comment` & X-SAMPA pronunciation hint, `@comment`, syllable chips), searchable/filterable item sidebar, and workflow bar (Auto-Listen-Back, Auto-Advance, Guide BGM toggle, 1-Step Undo Retake, non-blocking clipping/cutoff badges).

### 6. `verifier` (Independent QA, Integration Check & Playwright Fake-Mic E2E)
- **Owns**: `tests/e2e/**`
- **Deliverables**:
  - Reviews each author's diff against `docs/VISION.md` and `AGENTS.md` (verifies zero `alert()`/`confirm()`, 3-locale parity, strict types).
  - Runs `tsc --noEmit`, `vitest run`, and `electron-vite build`.
  - Authors and runs `tests/e2e/studio-recording.spec.ts` using Playwright `_electron.launch()` with Chromium fake-media-stream flags (`--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`, `--use-file-for-fake-audio-capture`) to create a project, record a take, verify the `.wav` + `character.yaml` on disk, and play it back.
