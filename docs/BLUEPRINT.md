# `aie` v1 — Product, Architecture & DevOps Blueprint

## Locked Decisions Summary
- **Stack**: Electron 35+ · `electron-vite` · React 19 · TypeScript (Strict) · Tailwind CSS v4 + Radix UI · WebAudio `AudioWorklet` + `wavefile` + `pitchy` · Zustand · `i18next` · Vitest + Playwright (`_electron`).
- **Screen 1 UX**: Unified **Welcome & Project Hub** (merging `WelcomePage` + `OpenProjectPage`, pairing a clean *"Vocal Booth"* studio badge with 1-click *Resume Session*, *Create/Open Project*, and *Recent Projects*).
- **Diagnostics & DevOps**: **100% Offline Diagnostics** (`electron-log` v5 rotated logs + Audio Telemetry Ring Buffer + 1-click *Export Diagnostic Zip* via `fflate` + 5-click Version badge DevTools toggle). Side-by-side `aie` Stable (`com.team-aie.app`) and `aie Beta` (`com.team-aie.app.beta`) support.
- **License Attribution**: Separated into **Tab 1 ("Built-in Reclists")** driven by `resources/reclists/<id>/manifest.json` (real creator credits, zero fake GPL labels), **Tab 2 ("Open-Source Libraries")** driven by `out/oss-licenses.json` (`rollup-plugin-license`), and **Chromium Notices** (`LICENSES.chromium.html`).
- **i18n**: Static bundled namespaces (`common`, `hub`, `project`, `studio`, `settings`) across `en-US`, `zh-CN`, and `ja-JP` (100% parity enforced by unit tests) + CSS `:lang(ja)` / `:lang(zh-CN)` CJK font selection.
- **CI/CD Targets**: `macos-15` (`arm64` Apple Silicon `.dmg` + `.zip`), `windows-latest` (`x64` NSIS `.exe`), and `ubuntu-24.04` (`x64` `.AppImage` + `.deb`). `electron-updater` self-updates on Windows/Linux with automatic GitHub Release notification fallback on unsigned macOS.

---

## Screen Architecture

### Screen 1: Welcome & Project Hub
- **Vocal Booth** studio header + **Continue Last Session** (*Resume Session*) hero card (jumps straight into Screen 3 at exact last item cursor).
- **Create New Project** (folder picker + singer name + individual checkboxes for `character.txt`, `character.yaml`, and `prefix.map` -> saves `aie.project.json` plus only the selected singer metadata files).
- **Open Existing Folder** (loads `aie.project.json`, auto-migrates `v0.x` `aie.config.json`, or adopts an existing OREMO folder).
- **Recent Projects** list with search, progress badge, *Reveal in Finder/Explorer*, and missing-folder handling.
- Global top-right controls: Language (`EN` / `简` / `日`), Theme (`System` / `Light` / `Dark`), Audio/App Settings modal, About/Licenses modal, and non-blocking Update pill.

### Screen 2: Project Workspace & Recording Sets
- **Recording Set Cards**: Target folder (`<Project Root>` or subfolder), chromatic target scale (`C2`–`B5` including sharps), reclist name, completion bar (`120 / 365`), and *Start / Resume*.
- **Create & Edit Set Panel**:
  - Root vs. Subfolder toggle + sanitized folder name & collision guard.
  - Chromatic scale selector (`C2`–`B5`) + inline **Audition Pitch** button.
  - Reclist selector: 4 built-in reclists or custom `.txt` + optional `OREMO-comment.txt` + charset selector (`auto`, `utf-8`, `utf-16le`, `utf-16be`, `shift_jis`, `gb18030`).
  - Guide audio mode: None, **Built-in Pitched Metronome** (`BPM`, `leadInBeats`, `moraCount`), or custom audio file (`.wav`/`.mp3`).
  - Turnkey companion generation toggle: copies/converts `oto.ini` (with optional `_Pitch` alias suffixing), `presamp.ini`, `mkototemp.ini`, and syncs whichever root metadata files (`character.txt`, UTF-8 `character.yaml` `subbanks`, `prefix.map`) are enabled in the project's `singerFiles` selection.
- **Ecosystem Handoff Bar**: *Reveal in Finder/Explorer*, *Open in vLabeler*, *Open in OpenUtau*.
- **Slide-Over Metadata & Pronunciation Drawer**: Tabs for `Reclist`, `oto.ini`, `character.yaml`, and `Creator README / Phoneme Guide`.
- **Safe Set Removal**: Radix dialog with unchecked-by-default option to move `.wav` files to OS Trash (`shell.trashItem`).

### Screen 3: The Recording Studio
- **Prompt Carousel**: Previous / **Current** / Next prompt, target `.wav` filename chip, `OREMO-comment.txt` / X-SAMPA pronunciation hint, `@comment` note, and syllable chips from `oto.ini`.
- **Unified 60 fps `<canvas>`**:
  - Live mode: Single-stream `AudioWorklet` waveform, 64-band vocal spectrogram, live `pitchy` `f0` pitch curve vs. target note line, and peak dB meter with non-blocking clipping & early-cutoff badges.
  - Review/Playback mode: Instant 0 ms render from in-memory `Float32Array`, read-only `oto.ini` timing grid overlay, auto-gain visual zoom toggle, and smooth playback cursor.
- **Transport & Keyboard State Machine**:
  - `R`: Record (**Hold PTT** default or **Toggle** mode; safe cleanup on window `blur`).
  - `Space`: Play / Stop current take.
  - `S`: Hold / Toggle reference pitch synth routed to `outputDeviceId` (`setSinkId`).
  - `ArrowUp`/`ArrowLeft` & `ArrowDown`/`ArrowRight`: Prev / Next item; `N`: Next unrecorded item; `Backspace`/`Delete`: Move take to OS Trash.
- **Workflow Toggles & Sidebar**: Search/filter (`All` / `Unrecorded` / `Recorded`), **Auto-Listen-Back**, **Auto-Advance**, **Guide BGM Toggle**, and **1-Step Undo Retake**.
