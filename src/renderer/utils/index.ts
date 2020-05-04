import { KEY_SEPARATOR } from '../env-and-consts';

export * from './fs-utils';
export * from './line-by-line-parser';

export const getLSKey = (namespace: string, key: string): string => `${namespace}${KEY_SEPARATOR}${key}`;
export const naiveSerialize = (obj: unknown): string => JSON.stringify(obj);
