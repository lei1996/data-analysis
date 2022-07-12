import {
  share,
  Observable,
  Subscriber,
  Big,
  map,
  tap,
} from '@data-analysis/core';
import { getNowTime } from '@data-analysis/utils';
import { RSI } from 'rxjs-trading-signals';
import { KLineBaseInterface } from './types/kline';
import { Buy, mergeKLine } from './core';
import { OperatorsResult } from './types/core';

export const makeRSIObservable = (interval: number = 14) => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<OperatorsResult>(
      (subscriber: Subscriber<OperatorsResult>) => {
        let currKLine: KLineBaseInterface | {} = {}; // 当前推入的最新k线

        const main$ = observable.pipe(
          tap((curr) => {
            currKLine = curr;
          }),
          mergeKLine(15),
          share(),
        );

        const source$ = main$.pipe(
          map(({ close }) => new Big(close)),
          RSI(interval),
          share(),
        );

        const buy$ = source$.pipe(Buy(80, 50), share());
        const sell$ = source$.pipe(Buy(50, 30), share());

        const buySubscriber = buy$.subscribe({
          next(x) {
            console.log(
              `buy: ${x}. price: ${
                (currKLine as KLineBaseInterface).close
              } time: ${getNowTime((currKLine as KLineBaseInterface).id)}`,
            );

            subscriber.next({
              offset: x,
              direction: x === 'open' ? 'buy' : 'sell',
            });
          },
          error(err) {
            // We need to make sure we're propagating our errors through.
            subscriber.error(err);
          },
          complete() {
            subscriber.complete();
          },
        });

        const sellSubscriber = sell$.subscribe({
          next(x) {
            console.log(
              `sell: ${x}. price: ${
                (currKLine as KLineBaseInterface).close
              } time: ${getNowTime((currKLine as KLineBaseInterface).id)}`,
            );

            subscriber.next({
              offset: x,
              direction: x === 'open' ? 'sell' : 'buy',
            });
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
          console.log('makeCuObservable 清空状态');
          buySubscriber.unsubscribe();
          sellSubscriber.unsubscribe();

          // Clean up all state.
          currKLine = null!;
        };
      },
    );
};
