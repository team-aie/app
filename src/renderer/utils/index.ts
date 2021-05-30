export * from './fs-utils';
export * from './line-by-line-parser';
export * from './locale-utils';
export * from './media-utils';
export * from './rxjs-utils';
export * from './string-utils';
export * from './local-storage-utils';

export const naiveSerialize = (obj: unknown): string => JSON.stringify(obj);
export const naivePrettyPrint = (obj: unknown): string => JSON.stringify(obj, null, 2);
export const naiveEquals = <T>(a: T, b: T): boolean => naiveSerialize(a) === naiveSerialize(b);
export const naiveDeepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));
