import { tradeRx } from 'rxjs-trading-signals/dist/utils/trade';
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
import { mergeKLine } from './core';

export const makeRSIObservable = (interval: number = 7) => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<string>(
      (subscriber: Subscriber<string>) => {
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

        const buy$ = source$.pipe(tradeRx(70, 50));
        const sell$ = source$.pipe(tradeRx(50, 30));

        const buySubscriber = buy$.subscribe({
          next(x) {
            if (x === 3 && !buyIsOpen) {
              buyIsOpen = true;
              console.log(
                `buy: open. price: ${
                  (currKLine as KLineBaseInterface).close
                } time: ${getNowTime((currKLine as KLineBaseInterface).id)}`,
              );
              subscriber.next('开多');
            } else if (x === 4 && buyIsOpen) {
              buyIsOpen = false;
              console.log(
                `buy: close. price: ${
                  (currKLine as KLineBaseInterface).close
                } time: ${getNowTime((currKLine as KLineBaseInterface).id)}`,
              );
              subscriber.next('平空');
            } else if (x === 2 && buyIsOpen) {
              buyIsOpen = false;
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

        const sellSubscriber = sell$.subscribe({
          next(x) {
            if (x === 3 && !sellIsOpen) {
              sellIsOpen = true;
              console.log(
                `sell: open. price: ${
                  (currKLine as KLineBaseInterface).close
                } time: ${getNowTime((currKLine as KLineBaseInterface).id)}`,
              );
              subscriber.next('开空');
            } else if (x === 4 && sellIsOpen) {
              sellIsOpen = false;
              console.log(
                `sell: close. price: ${
                  (currKLine as KLineBaseInterface).close
                } time: ${getNowTime((currKLine as KLineBaseInterface).id)}`,
              );
              subscriber.next('平多');
            } else if (x === 2 && sellIsOpen) {
              sellIsOpen = false;
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
          console.log('makeCuObservable 清空状态');
          buySubscriber.unsubscribe();
          sellSubscriber.unsubscribe();

          // Clean up all state.
          currKLine = null!;
        };
      },
    );
};
