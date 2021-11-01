import useEffectOnce from 'react-use/lib/useEffectOnce';

import { Closeable, Supplier } from '../types';

import { useInitializerRef } from './use-initializer-ref';

export const useComponentScopeService = <T extends Closeable>(initializer: Supplier<T>): T => {
  const { current: service } = useInitializerRef(initializer);

  useEffectOnce(() => () => {
    service.close();
  });

  return service;
};
