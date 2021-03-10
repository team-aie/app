import { MutableRefObject, RefObject } from 'react';
import useEffectOnce from 'react-use/lib/useEffectOnce';
import { Observable, SubscriptionLike } from 'rxjs';
import { first } from 'rxjs/operators';

export const unsubscribeFromRef = <T extends SubscriptionLike>(
  subscriptionRef: RefObject<T> | MutableRefObject<T>,
): void => {
  const subscription = subscriptionRef.current;
  if (subscription) {
    subscription.unsubscribe();
  }
};

export const useUnsubscribeOnUnmount = <T extends SubscriptionLike>(
  subscriptionRef: RefObject<T> | MutableRefObject<T>,
): void => {
  useEffectOnce(() => {
    return () => unsubscribeFromRef(subscriptionRef);
  });
};

/**
 * Resolves to the first emitted value from an {@link Observable} and then immediately completes.
 */
export const firstValueFrom = <T>(obs: Observable<T>): Promise<T> => {
  return new Promise((resolve) => {
    obs.pipe(first()).subscribe(resolve);
  });
};
