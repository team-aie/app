import type { TransportRecordMode } from '@shared/types';
import { useEffect, useRef } from 'react';

export interface StudioHotkeyHandlers {
  /** Start capturing a take (R down). Return `false` if the request was rejected. */
  onRecordStart: () => boolean | void;
  /** Stop capturing and save the take (R up in hold mode, second R in toggle mode, or blur safety). */
  onRecordStop: () => void;
  /** Space: play / stop the current take. */
  onTogglePlayback: () => void;
  /** S down: start the reference pitch tone. Return `false` if the request was rejected. */
  onToneStart: () => boolean | void;
  /** S up (hold) / second S (toggle) / blur safety: stop the reference tone. */
  onToneStop: () => void;
  /** ArrowUp / ArrowLeft. */
  onPrevious: () => void;
  /** ArrowDown / ArrowRight. */
  onNext: () => void;
  /** N: jump to next unrecorded prompt. */
  onNextUnrecorded: () => void;
  /** Delete / Backspace: request a (confirmed, non-blocking) trash of the current take. */
  onTrash: () => void;
}

export interface UseStudioHotkeysOptions extends StudioHotkeyHandlers {
  mode: TransportRecordMode;
  /** When false (e.g. a dialog is open) all hotkeys are ignored and held states are released. */
  enabled: boolean;
  /** Whether a take is currently being captured (from the session). */
  isRecording: boolean;
  /** Whether the reference tone is currently sounding (from the session). */
  isTonePlaying: boolean;
  /** Event target to bind to; defaults to `window`. */
  target?: Window;
}

type HotkeyAction =
  | 'record'
  | 'play'
  | 'tone'
  | 'previous'
  | 'next'
  | 'nextUnrecorded'
  | 'trash';

export function resolveHotkeyAction(event: Pick<KeyboardEvent, 'key' | 'code'>): HotkeyAction | null {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === 'r' || event.code === 'KeyR') return 'record';
  if (key === 's' || event.code === 'KeyS') return 'tone';
  if (key === 'n' || event.code === 'KeyN') return 'nextUnrecorded';
  if (key === ' ' || key === 'Spacebar' || event.code === 'Space') return 'play';
  if (key === 'ArrowUp' || key === 'ArrowLeft') return 'previous';
  if (key === 'ArrowDown' || key === 'ArrowRight') return 'next';
  if (key === 'Delete' || key === 'Backspace') return 'trash';
  return null;
}

/** True when keyboard focus is inside a text-entry control where hotkeys must be suppressed. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).tagName !== 'string') return false;
  const el = target as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el.isContentEditable === true || el.getAttribute?.('contenteditable') === 'true') return true;
  return typeof el.closest === 'function' && el.closest('[contenteditable="true"]') !== null;
}

const INTERACTIVE_CONTROL_SELECTOR = [
  'button',
  'select',
  'a',
  'summary',
  '[role="button"]',
  '[role="switch"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="radio"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="listbox"]'
].join(', ');

/**
 * True when focus is on or inside an interactive control that natively activates on `Space`/`Enter`.
 */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  return (target as Element).closest(INTERACTIVE_CONTROL_SELECTOR) !== null;
}

/**
 * Blurs a button when clicked with a pointer (`event.detail > 0`) so subsequent `Space`
 * presses control booth playback instead of re-clicking the last-clicked button, while
 * preserving focus on keyboard activation (`event.detail === 0`).
 */
export function blurOnPointerClick(event: { detail: number; currentTarget: HTMLElement }): void {
  if (event.detail > 0) {
    event.currentTarget.blur();
  }
}

/**
 * Booth keyboard state machine (zero-mouse operation from across the room).
 *
 * - `R` hold mode (PTT): first non-repeat `keydown` starts, `keyup` stops & saves.
 * - `R` toggle mode: each non-repeat `keydown` flips recording on/off.
 * - `S`: same hold/toggle semantics for the reference tone.
 * - `Space` play/stop, arrows prev/next, `N` next unrecorded, `Delete`/`Backspace` trash.
 * - Window `blur` / `visibilitychange` (hidden) release any held `R`/`S` so the
 *   booth never gets stuck recording after an Alt-Tab.
 */
export function useStudioHotkeys(options: UseStudioHotkeysOptions): void {
  const latest = useRef(options);
  latest.current = options;

  /** R is physically held and started the take (hold mode). */
  const recordHeld = useRef(false);
  /** S is physically held and started the tone (hold mode). */
  const toneHeld = useRef(false);
  /** Optimistic mirrors so rapid presses don't race React re-renders. */
  const recordingRef = useRef(options.isRecording);
  const toneRef = useRef(options.isTonePlaying);

  useEffect(() => {
    recordingRef.current = options.isRecording;
    if (!options.isRecording) recordHeld.current = false;
  }, [options.isRecording]);

  useEffect(() => {
    toneRef.current = options.isTonePlaying;
    if (!options.isTonePlaying) toneHeld.current = false;
  }, [options.isTonePlaying]);

  const releaseHeld = useRef(() => {
    if (recordHeld.current) {
      recordHeld.current = false;
      recordingRef.current = false;
      latest.current.onRecordStop();
    }
    if (toneHeld.current) {
      toneHeld.current = false;
      toneRef.current = false;
      latest.current.onToneStop();
    }
  });

  // Mode switches and disabling (dialogs) must never leave a held key stuck.
  useEffect(() => {
    releaseHeld.current();
  }, [options.mode, options.enabled]);

  useEffect(() => {
    const target = options.target ?? window;
    const doc = target.document;

    const onKeyDown = (event: KeyboardEvent) => {
      const opts = latest.current;
      if (!opts.enabled) return;
      if (event.defaultPrevented) return;
      if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target) || isTypingTarget(doc.activeElement)) return;

      const focusedInteractive =
        isInteractiveTarget(event.target) || isInteractiveTarget(doc.activeElement);
      if (
        focusedInteractive &&
        (event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter')
      ) {
        return;
      }

      const action = resolveHotkeyAction(event);
      if (!action) return;

      // Never hijack Space when focus is on or inside an interactive button/menu control.
      if (action === 'play' && focusedInteractive) {
        return;
      }

      // Prevent page scrolling for booth transport & navigation keys.
      if (action === 'play' || action === 'previous' || action === 'next' || action === 'trash') {
        event.preventDefault();
      }

      switch (action) {
        case 'record': {
          event.preventDefault();
          if (event.repeat) return;
          if (opts.mode === 'hold') {
            if (recordHeld.current) return;
            if (recordingRef.current) {
              // A take started from the mouse: pressing R ends it.
              recordingRef.current = false;
              opts.onRecordStop();
              return;
            }
            recordHeld.current = true;
            recordingRef.current = true;
            if (opts.onRecordStart() === false) {
              recordHeld.current = false;
              recordingRef.current = false;
            }
          } else if (recordingRef.current) {
            recordingRef.current = false;
            opts.onRecordStop();
          } else {
            recordingRef.current = true;
            if (opts.onRecordStart() === false) recordingRef.current = false;
          }
          return;
        }
        case 'tone': {
          event.preventDefault();
          if (event.repeat) return;
          if (opts.mode === 'hold') {
            if (toneHeld.current) return;
            if (toneRef.current) {
              toneRef.current = false;
              opts.onToneStop();
              return;
            }
            toneHeld.current = true;
            toneRef.current = true;
            if (opts.onToneStart() === false) {
              toneHeld.current = false;
              toneRef.current = false;
            }
          } else if (toneRef.current) {
            toneRef.current = false;
            opts.onToneStop();
          } else {
            toneRef.current = true;
            if (opts.onToneStart() === false) toneRef.current = false;
          }
          return;
        }
        case 'play':
          if (!event.repeat) opts.onTogglePlayback();
          return;
        case 'previous':
          opts.onPrevious();
          return;
        case 'next':
          opts.onNext();
          return;
        case 'nextUnrecorded':
          opts.onNextUnrecorded();
          return;
        case 'trash':
          if (!event.repeat) opts.onTrash();
          return;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const action = resolveHotkeyAction(event);
      // Releases are honored regardless of focus target so a hold can never get stuck.
      if (action === 'record' && recordHeld.current) {
        recordHeld.current = false;
        recordingRef.current = false;
        latest.current.onRecordStop();
      } else if (action === 'tone' && toneHeld.current) {
        toneHeld.current = false;
        toneRef.current = false;
        latest.current.onToneStop();
      }
    };

    const onBlur = () => releaseHeld.current();
    const onVisibility = () => {
      if (doc.visibilityState === 'hidden') releaseHeld.current();
    };

    target.addEventListener('keydown', onKeyDown);
    target.addEventListener('keyup', onKeyUp);
    target.addEventListener('blur', onBlur);
    doc.addEventListener('visibilitychange', onVisibility);
    return () => {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
      doc.removeEventListener('visibilitychange', onVisibility);
    };
  }, [options.target]);

  // Unmount safety: release anything still held.
  useEffect(() => () => releaseHeld.current(), []);
}
