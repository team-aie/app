import { renderHook } from '@testing-library/react-hooks';

import { RETAINED_LOCALSTORAGE_KEYS, useResumeCheck } from './localstorage-clear';

describe('project state resume test', () => {
  it('if user clicks confirm', () => {
    window.confirm = jest.fn().mockImplementation(() => true);
    for (let i = 0; i < RETAINED_LOCALSTORAGE_KEYS.length; i++) {
      localStorage.setItem(RETAINED_LOCALSTORAGE_KEYS[i], 'value');
    }
    const goToRecordingPage = jest.fn();
    renderHook(() => useResumeCheck(goToRecordingPage));
    localStorage.clear();

    expect(goToRecordingPage).toHaveBeenCalledTimes(1);
  });

  it('if user clicks cancel', () => {
    window.confirm = jest.fn().mockImplementation(() => false);
    for (let i = 0; i < RETAINED_LOCALSTORAGE_KEYS.length; i++) {
      localStorage.setItem(RETAINED_LOCALSTORAGE_KEYS[i], 'value');
    }

    const goToRecordingPage = jest.fn();
    renderHook(() => useResumeCheck(goToRecordingPage));
    localStorage.clear();
    for (let i = 0; i < RETAINED_LOCALSTORAGE_KEYS.length; i++) {
      expect(localStorage.getItem(RETAINED_LOCALSTORAGE_KEYS[i])).toBeNull();
    }
  });
});
