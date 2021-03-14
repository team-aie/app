import { KEY_SEPARATOR } from '../../common/env-and-consts';

export * from './fs-utils';
export * from './line-by-line-parser';
export * from './locale-utils';
export * from './media-utils';
export * from './rxjs-utils';
export * from './string-utils';

export const getLSKey = (namespace: string, key: string): string => `${namespace}${KEY_SEPARATOR}${key}`;
export const naiveSerialize = (obj: unknown): string => JSON.stringify(obj);
export const naiveEquals = <T>(a: T, b: T): boolean => naiveSerialize(a) === naiveSerialize(b);
export const naiveDeepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));
