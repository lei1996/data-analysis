import {
  share,
  Observable,
  Subscriber,
  Big,
  map,
  tap,
} from '@data-analysis/core';
import { getNowTime } from '@data-analysis/utils';
import { EMA, MACD } from 'rxjs-trading-signals';
import { tradeRx } from 'rxjs-trading-signals/dist/utils/trade';
import { KLineBaseInterface } from './types/kline';

export const makeMACDObservable = () => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<string>((subscriber: Subscriber<string>) => {
      let currKLine: KLineBaseInterface | {} = {}; // 当前推入的最新k线

      const main$ = observable.pipe(
        tap((curr) => {
          currKLine = curr;
        }),
        share(),
      );

      const source$ = main$.pipe(
        map(({ close }) => new Big(close)),
        MACD({
          indicator: EMA,
          shortInterval: 12,
          longInterval: 26,
          signalInterval: 9,
        }),
        map(({ histogram }) => histogram),
        tradeRx(0, 0),
        share(),
      );

      const buySubscriber = source$.subscribe({
        next(x) {
          if (x === 4) {
            console.log(
              `buy: open. price: ${
                (currKLine as KLineBaseInterface).close
              } time: ${getNowTime((currKLine as KLineBaseInterface).id)}`,
            );
            subscriber.next('开多');
          } else if (x === 1) {
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
          if (x === 1) {
            console.log(
              `sell: open. price: ${
                (currKLine as KLineBaseInterface).close
              } time: ${getNowTime((currKLine as KLineBaseInterface).id)}`,
            );
            subscriber.next('开空');
          } else if (x === 4) {
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
        console.log('makeMACDObservable 清空状态');
        buySubscriber.unsubscribe();
        sellSubscriber.unsubscribe();

        // Clean up all state.
        currKLine = null!;
      };
    });
};
