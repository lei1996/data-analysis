import {
  share,
  Observable,
  Subscriber,
  Big,
  map,
  tap,
  concatMap,
  of,
} from '@data-analysis/core';
import { getNowTime } from '@data-analysis/utils';
import { RSI } from 'rxjs-trading-signals';
import { KLineBaseInterface } from './types/kline';
import { BuySell, mergeKLine } from './core';
import { OperatorsResult } from './types/core';

export const makeRSIObservable = (interval: number = 14) => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<OperatorsResult>(
      (subscriber: Subscriber<OperatorsResult>) => {
        let currKLine: KLineBaseInterface | {} = {}; // 当前推入的最新k线
        let buyIsOpen: boolean = false;
        let sellIsOpen: boolean = false;

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

        const buy$ = source$.pipe(
          concatMap((x) =>
            of({
              r: x,
              upper: 80,
              lower: 50,
            }),
          ),
          BuySell(),
        );
        const sell$ = source$.pipe(
          concatMap((x) =>
            of({
              r: x,
              upper: 50,
              lower: 30,
            }),
          ),
          BuySell(),
        );

        const buySubscriber = buy$.subscribe({
          next(x) {
            if (x === 3 && !buyIsOpen) {
              subscriber.next({
                offset: 'open',
                direction: 'buy',
              });
              buyIsOpen = true;
              console.log(
                `buy: open. price: ${
                  (currKLine as KLineBaseInterface).close
                } time: ${getNowTime((currKLine as KLineBaseInterface).id)}`,
              );
            } else if (x === 2 && buyIsOpen) {
              subscriber.next({
                offset: 'close',
                direction: 'sell',
              });
              buyIsOpen = false;
              console.log(
                `buy: close. price: ${
                  (currKLine as KLineBaseInterface).close
                } time: ${getNowTime((currKLine as KLineBaseInterface).id)}`,
              );
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

        const sellSubscriber = sell$.subscribe({
          next(x) {
            if (x === 1 && !sellIsOpen) {
              subscriber.next({
                offset: 'open',
                direction: 'sell',
              });
              sellIsOpen = true;
              console.log(
                `sell: open. price: ${
                  (currKLine as KLineBaseInterface).close
                } time: ${getNowTime((currKLine as KLineBaseInterface).id)}`,
              );
            } else if (x === 4 && sellIsOpen) {
              subscriber.next({
                offset: 'close',
                direction: 'buy',
              });
              sellIsOpen = false;
              console.log(
                `sell: close. price: ${
                  (currKLine as KLineBaseInterface).close
                } time: ${getNowTime((currKLine as KLineBaseInterface).id)}`,
              );
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
          console.log('makeCuObservable 清空状态');
          buySubscriber.unsubscribe();
          sellSubscriber.unsubscribe();

          // Clean up all state.
          currKLine = null!;
        };
      },
    );
};
