import { useRef, useState } from 'react';

interface ImmutableRefObject<T> {
  readonly current: T;
}

export function useInitializerRef<T>(initializer: () => T): ImmutableRefObject<T> {
  const [value] = useState(initializer);
  return useRef<T>(value);
}
