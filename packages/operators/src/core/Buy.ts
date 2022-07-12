import { Big, BigSource } from '@data-analysis/core';
import { map, Observable, Subscriber } from 'rxjs';
import { Offset } from '../types/core';

export const Buy = (upper: number, lower: number) => {
  return (observable: Observable<BigSource>) =>
    new Observable<Offset>((subscriber: Subscriber<Offset>) => {
      let prev = 0;
      let isOpen = false;

      const subscription = observable.pipe(map((x) => new Big(x))).subscribe({
        next(r) {
          if (r.gt(upper)) {
            if (prev === 2 && isOpen) {
              isOpen = false;
              subscriber.next('close');
            }
            prev = 1;
          } else if (r.gt(lower)) {
            if (prev === 3 && !isOpen) {
              isOpen = true;
              subscriber.next('open');
            }
            prev = 2;
          } else {
            if ((prev === 2 || prev === 1) && isOpen) {
              isOpen = false;
              subscriber.next('close');
            }
            prev = 3;
          }
        },
        error(err) {
          // We need to make sure we're propagating our errors through.
          subscriber.error(err);
        },
        complete() {
          subscriber.complete();
        },
      });

      return () => {
        subscription.unsubscribe();
        // Clean up all state.
      };
    });
};
