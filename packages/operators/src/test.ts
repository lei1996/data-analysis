import {
  share,
  Observable,
  Subscriber,
  Big,
  map,
  tap,
  pairwise,
  filter,
} from '@data-analysis/core';
import { getNowTime } from '@data-analysis/utils';
import { KLineBaseInterface } from './types/kline';
import { mergeKLine } from './core';

export const makeTestObservable = () => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<string>((subscriber: Subscriber<string>) => {
      let currKLine: KLineBaseInterface | {} = {}; // 当前推入的最新k线
      let buyIsOpen: boolean = false;
      let sellIsOpen: boolean = false;

      const main$ = observable.pipe(
        tap((curr) => {
          currKLine = curr;
        }),
        // mergeKLine(15),
        share(),
      );

      const source$ = main$.pipe(
        map(({ close }) => {
          const num = new Big(close)
            .times(10000000)
            .round(0)
            .toString()
            .slice(0, 2);

          return new Big(num).round(0);
        }),
        tap((x) => console.log(x.toString(), 'debug price -> ')),
        pairwise(),
        filter(([x1, x2]) => !x1.eq(x2)),
        map(([x1, x2]) => x2.gt(x1)),
        share(),
      );

      const buySubscriber = source$.subscribe({
        next(x) {
          // if (x) {
          if (!x) {
            console.log(
              `buy: open. price: ${
                (currKLine as KLineBaseInterface).close
              } time: ${getNowTime((currKLine as KLineBaseInterface).id)}`,
            );
            subscriber.next('开多');
            // } else if (!x) {
          } else if (x) {
            console.log(
              `buy: close. price: ${
                (currKLine as KLineBaseInterface).close
              } time: ${getNowTime((currKLine as KLineBaseInterface).id)}`,
            );
            subscriber.next('平空');
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

      const sellSubscriber = source$.subscribe({
        next(x) {
          // if (!x) {
          if (x) {
            console.log(
              `sell: open. price: ${
                (currKLine as KLineBaseInterface).close
              } time: ${getNowTime((currKLine as KLineBaseInterface).id)}`,
            );
            subscriber.next('开空');
            // } else if (x) {
          } else if (!x) {
            console.log(
              `sell: close. price: ${
                (currKLine as KLineBaseInterface).close
              } time: ${getNowTime((currKLine as KLineBaseInterface).id)}`,
            );
            subscriber.next('平多');
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
        console.log('makeTestObservable 清空状态');
        buySubscriber.unsubscribe();
        sellSubscriber.unsubscribe();

        // Clean up all state.
        currKLine = null!;
      };
    });
};
