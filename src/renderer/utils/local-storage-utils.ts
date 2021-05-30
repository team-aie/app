import { KEY_SEPARATOR } from '../../common/env-and-consts';
import { Serializable } from '../types';

export const getLSKey = (namespace: string, key: string): string => `${namespace}${KEY_SEPARATOR}${key}`;

export const getLSCached = <T extends Serializable>(key: string, initialValueOrInitializer: T | (() => T)): T => {
  const storedItem = localStorage.getItem(key);
  if (storedItem) {
    return JSON.parse(storedItem) as T;
  } else {
    const initialValue =
      typeof initialValueOrInitializer === 'function' ? initialValueOrInitializer() : initialValueOrInitializer;
    localStorage.setItem(key, JSON.stringify(initialValue));
    return initialValue;
  }
};
