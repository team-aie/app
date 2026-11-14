import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type UseStudioHotkeysOptions,
  blurOnPointerClick,
  isInteractiveTarget,
  isTypingTarget,
  resolveHotkeyAction,
  useStudioHotkeys
} from '@renderer/components/studio/use-studio-hotkeys';

function makeOptions(overrides: Partial<UseStudioHotkeysOptions> = {}): UseStudioHotkeysOptions {
  return {
    mode: 'hold',
    enabled: true,
    isRecording: false,
    isTonePlaying: false,
    onRecordStart: vi.fn(),
    onRecordStop: vi.fn(),
    onTogglePlayback: vi.fn(),
    onToneStart: vi.fn(),
    onToneStop: vi.fn(),
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onNextUnrecorded: vi.fn(),
    onTrash: vi.fn(),
    ...overrides
  };
}

function setup(overrides: Partial<UseStudioHotkeysOptions> = {}) {
  const options = makeOptions(overrides);
  const hook = renderHook((props: UseStudioHotkeysOptions) => useStudioHotkeys(props), {
    initialProps: options
  });
  return { options, ...hook };
}

const keyR = { key: 'r', code: 'KeyR' };
const keyS = { key: 's', code: 'KeyS' };

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('resolveHotkeyAction / isTypingTarget / isInteractiveTarget', () => {
  it('maps booth keys (case-insensitive, layout-aware)', () => {
    expect(resolveHotkeyAction({ key: 'R', code: 'KeyR' })).toBe('record');
    expect(resolveHotkeyAction({ key: 'ㄱ', code: 'KeyR' })).toBe('record');
    expect(resolveHotkeyAction({ key: ' ', code: 'Space' })).toBe('play');
    expect(resolveHotkeyAction({ key: 's', code: 'KeyS' })).toBe('tone');
    expect(resolveHotkeyAction({ key: 'ArrowLeft', code: 'ArrowLeft' })).toBe('previous');
    expect(resolveHotkeyAction({ key: 'ArrowUp', code: 'ArrowUp' })).toBe('previous');
    expect(resolveHotkeyAction({ key: 'ArrowRight', code: 'ArrowRight' })).toBe('next');
    expect(resolveHotkeyAction({ key: 'ArrowDown', code: 'ArrowDown' })).toBe('next');
    expect(resolveHotkeyAction({ key: 'n', code: 'KeyN' })).toBe('nextUnrecorded');
    expect(resolveHotkeyAction({ key: 'Delete', code: 'Delete' })).toBe('trash');
    expect(resolveHotkeyAction({ key: 'Backspace', code: 'Backspace' })).toBe('trash');
    expect(resolveHotkeyAction({ key: 'x', code: 'KeyX' })).toBeNull();
  });

  it('detects text-entry focus targets', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(window)).toBe(false);
  });

  it('detects interactive controls (tags, ARIA roles, and nested children)', () => {
    for (const tag of ['button', 'select', 'a', 'summary'] as const) {
      expect(isInteractiveTarget(document.createElement(tag))).toBe(true);
    }
    for (const role of [
      'button',
      'switch',
      'menuitem',
      'menuitemcheckbox',
      'menuitemradio',
      'option',
      'radio',
      'checkbox',
      'combobox',
      'listbox'
    ]) {
      const el = document.createElement('div');
      el.setAttribute('role', role);
      expect(isInteractiveTarget(el)).toBe(true);
    }
    const btn = document.createElement('button');
    const nestedSpan = document.createElement('span');
    btn.appendChild(nestedSpan);
    expect(isInteractiveTarget(nestedSpan)).toBe(true);
    expect(isInteractiveTarget(document.createElement('div'))).toBe(false);
    expect(isInteractiveTarget(window)).toBe(false);
  });

  it('blurOnPointerClick blurs only on pointer clicks (detail > 0), keeping keyboard focus (detail === 0)', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.focus();
    expect(document.activeElement).toBe(btn);

    blurOnPointerClick({ detail: 0, currentTarget: btn });
    expect(document.activeElement).toBe(btn);

    blurOnPointerClick({ detail: 1, currentTarget: btn });
    expect(document.activeElement).not.toBe(btn);
  });
});

describe('useStudioHotkeys — R record state machine', () => {
  it('hold (PTT): keydown starts once, repeat keydowns are ignored, keyup stops & saves', () => {
    const { options } = setup();
    fireEvent.keyDown(window, keyR);
    fireEvent.keyDown(window, { ...keyR, repeat: true });
    fireEvent.keyDown(window, { ...keyR, repeat: true });
    expect(options.onRecordStart).toHaveBeenCalledTimes(1);
    expect(options.onRecordStop).not.toHaveBeenCalled();
    fireEvent.keyUp(window, keyR);
    expect(options.onRecordStop).toHaveBeenCalledTimes(1);
    // A stray second keyup does nothing.
    fireEvent.keyUp(window, keyR);
    expect(options.onRecordStop).toHaveBeenCalledTimes(1);
  });

  it('toggle: first keydown starts, keyup is ignored, second keydown stops & saves', () => {
    const { options } = setup({ mode: 'toggle' });
    fireEvent.keyDown(window, keyR);
    fireEvent.keyUp(window, keyR);
    expect(options.onRecordStart).toHaveBeenCalledTimes(1);
    expect(options.onRecordStop).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { ...keyR, repeat: true });
    expect(options.onRecordStop).not.toHaveBeenCalled();
    fireEvent.keyDown(window, keyR);
    expect(options.onRecordStop).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, keyR);
    expect(options.onRecordStart).toHaveBeenCalledTimes(2);
  });

  it('window blur while holding R auto-stops exactly once (Alt-Tab safety)', () => {
    const { options } = setup();
    fireEvent.keyDown(window, keyR);
    fireEvent.blur(window);
    expect(options.onRecordStop).toHaveBeenCalledTimes(1);
    // The keyup that arrives after refocus must not double-stop.
    fireEvent.keyUp(window, keyR);
    expect(options.onRecordStop).toHaveBeenCalledTimes(1);
  });

  it('visibilitychange → hidden while holding R and S releases both', () => {
    const { options } = setup();
    fireEvent.keyDown(window, keyR);
    fireEvent.keyDown(window, keyS);
    const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    spy.mockRestore();
    expect(options.onRecordStop).toHaveBeenCalledTimes(1);
    expect(options.onToneStop).toHaveBeenCalledTimes(1);
  });

  it('toggle-mode recording keeps running across blur (no key is held)', () => {
    const { options } = setup({ mode: 'toggle' });
    fireEvent.keyDown(window, keyR);
    fireEvent.blur(window);
    expect(options.onRecordStop).not.toHaveBeenCalled();
  });

  it('reverts the optimistic state when the session rejects a start', () => {
    const { options } = setup({ mode: 'toggle', onRecordStart: vi.fn(() => false) });
    fireEvent.keyDown(window, keyR);
    fireEvent.keyDown(window, keyR);
    expect(options.onRecordStart).toHaveBeenCalledTimes(2);
    expect(options.onRecordStop).not.toHaveBeenCalled();
  });

  it('pressing R in hold mode ends a take that was started with the mouse', () => {
    const { options } = setup({ isRecording: true });
    fireEvent.keyDown(window, keyR);
    expect(options.onRecordStop).toHaveBeenCalledTimes(1);
    expect(options.onRecordStart).not.toHaveBeenCalled();
  });

  it('switching mode or disabling while R is held releases the hold', () => {
    const { options, rerender } = setup();
    fireEvent.keyDown(window, keyR);
    rerender({ ...options, mode: 'toggle' });
    expect(options.onRecordStop).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, keyR); // toggle start
    rerender({ ...options, mode: 'hold', isRecording: false });
    fireEvent.keyDown(window, keyR);
    rerender({ ...options, mode: 'hold', enabled: false });
    expect(options.onRecordStop).toHaveBeenCalledTimes(2);
  });

  it('releases a held R on unmount', () => {
    const { options, unmount } = setup();
    fireEvent.keyDown(window, keyR);
    unmount();
    expect(options.onRecordStop).toHaveBeenCalledTimes(1);
  });
});

describe('useStudioHotkeys — S reference tone', () => {
  it('hold: momentary tone on keydown/keyup, repeat ignored', () => {
    const { options } = setup();
    fireEvent.keyDown(window, keyS);
    fireEvent.keyDown(window, { ...keyS, repeat: true });
    expect(options.onToneStart).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(window, keyS);
    expect(options.onToneStop).toHaveBeenCalledTimes(1);
  });

  it('toggle: press to start, press again to stop', () => {
    const { options } = setup({ mode: 'toggle' });
    fireEvent.keyDown(window, keyS);
    fireEvent.keyUp(window, keyS);
    expect(options.onToneStart).toHaveBeenCalledTimes(1);
    expect(options.onToneStop).not.toHaveBeenCalled();
    fireEvent.keyDown(window, keyS);
    expect(options.onToneStop).toHaveBeenCalledTimes(1);
  });

  it('blur while holding S stops the tone', () => {
    const { options } = setup();
    fireEvent.keyDown(window, keyS);
    fireEvent.blur(window);
    expect(options.onToneStop).toHaveBeenCalledTimes(1);
  });
});

describe('useStudioHotkeys — transport, focus safety & navigation', () => {
  it('Space toggles playback (repeat ignored) and prevents page scroll when no control is focused', () => {
    const { options } = setup();
    const notPrevented = fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(notPrevented).toBe(false);
    fireEvent.keyDown(window, { key: ' ', code: 'Space', repeat: true });
    expect(options.onTogglePlayback).toHaveBeenCalledTimes(1);
  });

  it('does NOT hijack Space or Enter when focus is on a button or ARIA interactive control', () => {
    const { options } = setup();
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.focus();

    // Dispatched on focused button
    const downNotPrevented = fireEvent.keyDown(btn, { key: ' ', code: 'Space' });
    const upNotPrevented = fireEvent.keyUp(btn, { key: ' ', code: 'Space' });
    const enterNotPrevented = fireEvent.keyDown(btn, { key: 'Enter', code: 'Enter' });
    expect(downNotPrevented).toBe(true);
    expect(upNotPrevented).toBe(true);
    expect(enterNotPrevented).toBe(true);

    // Dispatched on window while document.activeElement is still the button
    const winDownNotPrevented = fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(winDownNotPrevented).toBe(true);
    expect(options.onTogglePlayback).not.toHaveBeenCalled();

    // Once blurred, Space controls booth playback again
    btn.blur();
    const afterBlur = fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(afterBlur).toBe(false);
    expect(options.onTogglePlayback).toHaveBeenCalledTimes(1);
  });

  it('arrows navigate, N jumps to next unrecorded, Delete/Backspace trash', () => {
    const { options } = setup();
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'n', code: 'KeyN' });
    fireEvent.keyDown(window, { key: 'Delete' });
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(options.onPrevious).toHaveBeenCalledTimes(2);
    expect(options.onNext).toHaveBeenCalledTimes(2);
    expect(options.onNextUnrecorded).toHaveBeenCalledTimes(1);
    expect(options.onTrash).toHaveBeenCalledTimes(2);
  });

  it('suppresses every hotkey while focus is inside input / textarea / select', () => {
    const { options } = setup();
    for (const tag of ['input', 'textarea', 'select'] as const) {
      const el = document.createElement(tag);
      document.body.appendChild(el);
      el.focus();
      fireEvent.keyDown(el, keyR);
      fireEvent.keyDown(el, { key: ' ', code: 'Space' });
      fireEvent.keyDown(el, keyS);
      fireEvent.keyDown(el, { key: 'Backspace' });
      fireEvent.keyDown(el, { key: 'ArrowDown' });
      fireEvent.keyDown(el, { key: 'n', code: 'KeyN' });
    }
    expect(options.onRecordStart).not.toHaveBeenCalled();
    expect(options.onTogglePlayback).not.toHaveBeenCalled();
    expect(options.onToneStart).not.toHaveBeenCalled();
    expect(options.onTrash).not.toHaveBeenCalled();
    expect(options.onNext).not.toHaveBeenCalled();
    expect(options.onNextUnrecorded).not.toHaveBeenCalled();
  });

  it('ignores modifier chords (Cmd/Ctrl+R reload, Alt) and IME composition', () => {
    const { options } = setup();
    fireEvent.keyDown(window, { ...keyR, metaKey: true });
    fireEvent.keyDown(window, { ...keyR, ctrlKey: true });
    fireEvent.keyDown(window, { ...keyR, altKey: true });
    fireEvent.keyDown(window, { ...keyR, isComposing: true });
    expect(options.onRecordStart).not.toHaveBeenCalled();
  });

  it('ignores all hotkeys while disabled (e.g. a dialog is open)', () => {
    const { options } = setup({ enabled: false });
    fireEvent.keyDown(window, keyR);
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(options.onRecordStart).not.toHaveBeenCalled();
    expect(options.onTogglePlayback).not.toHaveBeenCalled();
    expect(options.onTrash).not.toHaveBeenCalled();
  });
});
