import { renderHook } from '@testing-library/react-hooks';

import { RETAINED_LOCALSTORAGE_KEYS, useResumeCheck } from './localstorage-clear';

it('should call goToRecordingPage if confirm is true', () => {
  window.confirm = jest.fn().mockImplementation(() => true);
  for (let i = 0; i < RETAINED_LOCALSTORAGE_KEYS.length; i++) {
    localStorage.setItem(RETAINED_LOCALSTORAGE_KEYS[i], 'value');
  }
  const goToRecordingPage = jest.fn();
  renderHook(() => useResumeCheck(goToRecordingPage));
  localStorage.clear();

  expect(goToRecordingPage).toHaveBeenCalledTimes(1);
});

it('should delete stored values in localstorage if confirm is false', () => {
  window.confirm = jest.fn().mockImplementation(() => false);
  for (let i = 0; i < RETAINED_LOCALSTORAGE_KEYS.length; i++) {
    localStorage.setItem(RETAINED_LOCALSTORAGE_KEYS[i], 'value');
  }

  const goToRecordingPage = jest.fn();
  renderHook(() => useResumeCheck(goToRecordingPage));
  for (let i = 0; i < RETAINED_LOCALSTORAGE_KEYS.length; i++) {
    expect(localStorage.getItem(RETAINED_LOCALSTORAGE_KEYS[i])).toBeNull();
  }
});
