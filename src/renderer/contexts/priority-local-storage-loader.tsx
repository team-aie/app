/**
 * This is for critical info that must be retrieved on app start-up. Other data should use {@code useLocalStorage}
 *
 * @param key {string}
 * @param initialValue
 */
export default function priorityLoadFromLocalStorage<T>(key: string, initialValue: T): string {
  const serializedInitialValue = String(initialValue);
  if (localStorage) {
    const stored = localStorage.getItem(key);
    if (stored) {
      return stored;
    } else {
      localStorage.setItem(key, serializedInitialValue);
      return serializedInitialValue;
    }
  } else {
    return serializedInitialValue;
  }
}
