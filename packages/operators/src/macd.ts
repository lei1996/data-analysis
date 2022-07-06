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
  pipe,
  bufferCount,
  from,
  max,
  min,
  scan,
  last,
  combineLatest,
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

/**
 * 合并k线
 * @param
 * @returns
 */
export const mergeKLine = (interval: number = 15) => {
  return pipe(
    bufferCount<KLineBaseInterface>(interval),
    concatMap((items: KLineBaseInterface[]) => {
      const source$ = zip(
        from(items).pipe(max((a, b) => (new Big(a.high).lt(b.high) ? -1 : 1))),
        from(items).pipe(min((a, b) => (new Big(a.low).lt(b.low) ? -1 : 1))),
        from(items).pipe(
          scan((a, b) => a.plus(b.volume), new Big(0)),
          last(),
        ),
      );

      return source$.pipe(
        map(
          ([max, min, volume]) =>
            ({
              id: items[0].id,
              open: items[0].open,
              close: items[items.length - 1].close,
              high: max.high,
              low: min.low,
              volume: volume.toNumber(),
            } as KLineBaseInterface),
        ),
      );
    }),
  );
};

class BaseCs {
  isOpen: boolean = false;
  prev: Big = new Big(0);
  profit: Big = new Big(0);
  count: number = 0;
  prevInfo: number = 0;

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
        mergeKLine(15),
        map(({ close }) => new Big(close)),
        MACD({
          indicator: EMA,
          shortInterval: 6,
          longInterval: 13,
          signalInterval: 9,
        }),
        skip(1),
      );

      const adx$ = main$.pipe(
        mergeKLine(15 * 4),
        map(({ close, high, low }) => ({ close, high, low })),
        ADX(14),
      );

      // macd$.subscribe((x) =>
      //   console.log(x.histogram.round(8).toString(), 'macd value ->'),
      // );

      // adx$.subscribe((x) =>
      //   console.log(new Big(x).round(8).toString(), 'adx value ->'),
      // );

      const source$ = combineLatest(macd$.pipe(), adx$.pipe()).pipe(
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

          return of({ info, adx }).pipe(filter((x) => !!x.info));
        }),
        share(),
      );

      const buy$ = source$.pipe(
        concatMap(({ info, adx }) => {
          let result = '';
          let profit = new Big(0);
          // if (buy.isOpen) buy.count++;

          if (
            !buy.isOpen &&
            info === 1 &&
            buy.prevInfo !== 1 &&
            new Big(adx).gt(25)
          ) {
            result = '开多';
            buy.prev = new Big((currKLine as KLineBaseInterface).close);
            buy.isOpen = true;
          } else if (buy.isOpen && info !== 1) {
            result = '平空';
            profit = buy.getProfit(
              result,
              new Big((currKLine as KLineBaseInterface).close),
            );
            buy.profit = profit;
            // buy.count = 0;
            buy.isOpen = false;
          }

          buy.prevInfo = info;

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
        concatMap(({ info, adx }) => {
          let result = '';
          let profit = new Big(0);
          // if (sell.isOpen) sell.count++;

          if (
            !sell.isOpen &&
            info === 3 &&
            sell.prevInfo !== 3 &&
            new Big(adx).gt(25)
          ) {
            result = '开空';
            sell.prev = new Big((currKLine as KLineBaseInterface).close);
            sell.isOpen = true;
          } else if (sell.isOpen && info !== 3) {
            result = '平多';
            profit = sell.getProfit(
              result,
              new Big((currKLine as KLineBaseInterface).close),
            );
            sell.profit = profit;
            // sell.count = 0;
            sell.isOpen = false;
          }

          sell.prevInfo = info;

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
