# `aie` v1 — Product Vision & Anti-Drift Charter

## 1. The North Star

> **`aie` v1 is the modern Desktop Vocal Booth & Voicebank Builder: OREMO's speed and pitch/spectral precision, rebuilt natively in TypeScript for macOS, Windows, and Linux, producing a ready-to-open OpenUtau & vLabeler voicebank out of the box.**

When a voice provider steps up to a microphone on a desktop computer to record 150 to 2,000 lines, they should never have to fight 2013 Windows XP Tcl/Tk quirks, Shift-JIS mojibake, cryptic X-SAMPA filenames, or hours of manual `character.yaml` / `oto.ini` folder plumbing before hearing their voice sing.

---

## 2. Position in the 2026 Vocal Synth Triad

Open-source vocal synthesis in 2026 runs on a specialist triad:
1. **`aie` v1** — **Desktop Vocal Booth & Singer Builder** (guided setup, real-time `f0`/spectral/timing QA, turnkey UTF-8 multi-subbank folder).
2. **`vLabeler`** — **Precision OTO & Phoneme Aligner** (fine-tuning `oto.ini` / `TextGrid` boundaries).
3. **`OpenUtau`** — **Synthesizer & Piano Roll** (concatenative UTAU phonemizers & DiffSinger).

### Key Differentiators
- **vs. Classic `OREMO`**: Preserves keyboard-first PTT speed, live `f0`/spectrogram inspection, `OREMO-comment.txt` hints, and direct-to-folder recording—while running natively on macOS/Windows/Linux with UTF-8 safety, built-in WebAudio pitched guide synthesis, and automatic OpenUtau `character.yaml` scaffolding.
- **vs. `RecStar`**: `RecStar` optimizes for mobile phones/tablets with a minimal waveform and a manual export step. `aie` v1 is an uncompromised **Desktop Vocal Booth Studio** writing directly into a live voicebank folder so `aie`, `vLabeler`, and `OpenUtau` can stay open on the same folder simultaneously.

---

## 3. The Three Product Pillars

1. **Pillar 1 — "Booth Coach" Real-Time Studio**:
   - Simultaneous 60 fps oscilloscope waveform + 64-band vocal spectrogram + live `f0` pitch curve (`Hz`, note, cents vs. chromatic target `C2`–`B5`) + read-only `oto.ini` syllable timing grid.
   - Sample-clock-locked guide audio: built-in WebAudio pitched BPM count-in/guide synth and custom BGM playback synced to the exact `AudioContext` capture clock.
   - Zero-mouse ergonomics: **Hold-to-Record (`PTT`)** and **Toggle** modes (`R` record, `Space` play, `S` reference tone, arrows/`N` navigate), window-`blur` safety, **Auto-Listen-Back**, **1-Step Undo Retake**, DC-offset removal, and non-blocking clipping (`0 dBFS`) / early-cutoff warnings.
2. **Pillar 2 — Zero-Friction "Turnkey Singer" Folder**:
   - Writes plain `.wav` files and UTF-8 metadata directly into `<projectRoot>`.
   - Automatically maintains root `character.txt` + UTF-8 `character.yaml` (`text_file_encoding: utf-8`, `default_phonemizer`, `subbanks`) + `prefix.map`.
   - Supports subfolder sets (`G4/` with optional `_G4` alias suffixing in copied `oto.ini`) and root-folder sets (for monopitch or ARPAsing base banks).
   - Supports `OREMO-comment.txt` (`<id>\t<hint>`) plus inline pronunciation guides for built-in reclists (`delta_eng_ver5` X-SAMPA hints).
3. **Pillar 3 — Whole-Voicebank Multi-Pitch Management & AI Runway**:
   - Manages all pitch/expression subbanks in one `aie.project.json`, auto-migrates legacy `v0.x` `aie.config.json`, adopts raw OREMO folders, and keeps prompt abstractions clean for `v1.1` continuous auto-record (`連続録音`) and DiffSinger (`wavs/` + `transcriptions.csv`) datasets.

---

## 4. Explicit Non-Goals (Scope Guardrails)

1. **No Mobile (iOS / Android) Compromises**: Desktop-only (`macOS arm64`, `Windows x64`, `Linux x64`).
2. **No Interactive `oto.ini` Parameter Editor**: Render `oto.ini` timing markers read-only; delegate editing via 1-click *Open in vLabeler*.
3. **No Built-In Synthesizer, Piano Roll, or Audio Effects**: Record dry, uncolored PCM WAVs; delegate synthesis via 1-click *Open in OpenUtau*.
4. **No Proprietary Sandboxed Storage**: Deleting `aie.project.json` must leave behind a 100% standard, usable voicebank directory.
5. **No Native C++ / Rust Node Addons**: Keep 100% TypeScript + WebAudio `AudioWorklet`.
6. **No Modal Popups in the Booth**: Zero `window.alert()` or `window.confirm()`.
