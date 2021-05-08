import { renderHook } from '@testing-library/react-hooks';

import { RETAINED_LOCALSTORAGE_KEYS, useResumeCheck } from './localstorage-clear';

describe('project state resume test', () => {
  it('if user clicks confirm', () => {
    jest.spyOn(window, 'confirm').mockImplementation(() => true);
    for (let i = 0; i < RETAINED_LOCALSTORAGE_KEYS.length; i++) {
      localStorage.setItem(RETAINED_LOCALSTORAGE_KEYS[i], 'value');
    }
    const goToRecordingPage = jest.fn();
    renderHook(() => useResumeCheck(goToRecordingPage));

    expect(goToRecordingPage).toHaveBeenCalledTimes(1);

    localStorage.clear();
  });

  it('if user clicks cancel', () => {
    jest.spyOn(window, 'confirm').mockImplementation(() => false);
    for (let i = 0; i < RETAINED_LOCALSTORAGE_KEYS.length; i++) {
      localStorage.setItem(RETAINED_LOCALSTORAGE_KEYS[i], 'value');
    }

    const goToRecordingPage = jest.fn();
    renderHook(() => useResumeCheck(goToRecordingPage));
    for (let i = 0; i < RETAINED_LOCALSTORAGE_KEYS.length; i++) {
      expect(localStorage.getItem(RETAINED_LOCALSTORAGE_KEYS[i])).toBeNull();
    }
    localStorage.clear();
  });
});
