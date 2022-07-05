import {
  share,
  Observable,
  Subscriber,
  concatMap,
  of,
  Big,
  BigSource,
  map,
  filter,
  zip,
  skip,
  tap,
} from '@data-analysis/core';

import { MACD, EMA, ADX } from 'rxjs-trading-signals';

interface KLineBaseInterface {
  id: number; // 时间戳
  open: BigSource; // 开盘价
  close: BigSource; // 收盘价
  low: BigSource; // 最低价
  high: BigSource; // 最高价
  volume: BigSource; // 成交量
}
class BaseCs {
  isOpen: boolean = false;
  prev: Big = new Big(0);
  profit: Big = new Big(0);

  getProfit(info: string, price: Big) {
    if (this.prev.eq(0)) return new Big(0);

    if (info.includes('平空')) {
      return price.minus(this.prev);
    } else if (info.includes('平多')) {
      return this.prev.minus(price);
    } else {
      return new Big(0);
    }
  }
}

export const makeCuObservable = (interval: number = 5) => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<string>((subscriber: Subscriber<string>) => {
      let currKLine: KLineBaseInterface | {} = {}; // 当前推入的最新k线
      const buy = new BaseCs();
      const sell = new BaseCs();

      const main$ = observable.pipe(
        tap((curr) => {
          currKLine = curr;
        }),
        share(),
      );

      const macd$ = main$.pipe(
        map(({ close }) => new Big(close)),
        MACD({
          indicator: EMA,
          shortInterval: 12,
          longInterval: 26,
          signalInterval: 9,
        }),
        skip(1),
      );

      const adx$ = main$.pipe(
        map(({ close, high, low }) => ({ close, high, low })),
        ADX(14),
      );

      // macd$.subscribe((x) =>
      //   console.log(x.histogram.round(8).toString(), 'macd value ->'),
      // );

      // adx$.subscribe((x) =>
      //   console.log(new Big(x).round(8).toString(), 'adx value ->'),
      // );

      const source$ = zip(macd$.pipe(), adx$.pipe()).pipe(
        concatMap(([macd, adx]) => {
          const { histogram } = macd;
          let info = 0;

          if (histogram.gt(0)) {
            info = 1;
          } else if (histogram.eq(0)) {
            info = 2;
          } else {
            info = 3;
          }

          console.log(info, new Big(adx).round(8).toString(), 'adx ->');

          return of(info).pipe(filter((x) => !!x));
        }),
        share(),
      );

      const buy$ = source$.pipe(
        concatMap((info) => {
          let result = '';
          let profit = new Big(0);

          if (!buy.isOpen && info === 1) {
            // result = buy.profit.gt(0) ? '开多' : '开空';
            result = '开多';
            buy.prev = new Big((currKLine as KLineBaseInterface).close);
            buy.isOpen = true;
          } else if (buy.isOpen && info !== 1) {
            // result = buy.profit.gt(0) ? '平空' : '平多';
            result = '平空';
            profit = buy.getProfit(
              result,
              new Big((currKLine as KLineBaseInterface).close),
            );
            buy.profit = profit;
            buy.isOpen = false;
          }

          return of({ result, profit }).pipe(filter((x) => !!x.result));
        }),
      );

      const buySubscriber = buy$.subscribe({
        next({ result }) {
          subscriber.next(result);
        },
        error(err) {
          // We need to make sure we're propagating our errors through.
          subscriber.error(err);
        },
        complete() {
          subscriber.complete();
        },
      });

      const sell$ = source$.pipe(
        concatMap((info) => {
          let result = '';
          let profit = new Big(0);

          if (!sell.isOpen && info === 3) {
            // result = sell.profit.gt(0) ? '开空' : '开多';
            result = '开空';
            sell.prev = new Big((currKLine as KLineBaseInterface).close);
            sell.isOpen = true;
          } else if (sell.isOpen && info !== 1) {
            // result = sell.profit.gt(0) ? '平多' : '平空';
            result = '平多';
            profit = sell.getProfit(
              result,
              new Big((currKLine as KLineBaseInterface).close),
            );
            sell.profit = profit;
            sell.isOpen = false;
          }

          return of({ result, profit }).pipe(filter((x) => !!x.result));
        }),
      );

      const sellSubscriber = sell$.subscribe({
        next({ result }) {
          subscriber.next(result);
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
    });
};
