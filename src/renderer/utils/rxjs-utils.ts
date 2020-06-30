import { MutableRefObject, RefObject } from 'react';
import useEffectOnce from 'react-use/lib/useEffectOnce';
import { SubscriptionLike } from 'rxjs';

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
