import { renderHook } from '@testing-library/react-hooks';

import { RESUME_SESSION_KEYS, useAbnormalShutdownResumeSessionCheck } from './localstorage-clear';

describe('project state resume test', () => {
  it('if user clicks confirm', () => {
    jest.spyOn(window, 'confirm').mockImplementation(() => true);
    for (let i = 0; i < RESUME_SESSION_KEYS.length; i++) {
      localStorage.setItem(RESUME_SESSION_KEYS[i], 'value');
    }
    const goToRecordingPage = jest.fn();
    renderHook(() => useAbnormalShutdownResumeSessionCheck(goToRecordingPage));

    expect(goToRecordingPage).toHaveBeenCalledTimes(1);

    localStorage.clear();
  });

  it('if user clicks cancel', () => {
    jest.spyOn(window, 'confirm').mockImplementation(() => false);
    for (let i = 0; i < RESUME_SESSION_KEYS.length; i++) {
      localStorage.setItem(RESUME_SESSION_KEYS[i], 'value');
    }

    const goToRecordingPage = jest.fn();
    renderHook(() => useAbnormalShutdownResumeSessionCheck(goToRecordingPage));
    for (let i = 0; i < RESUME_SESSION_KEYS.length; i++) {
      expect(localStorage.getItem(RESUME_SESSION_KEYS[i])).toBeNull();
    }
    localStorage.clear();
  });
});
