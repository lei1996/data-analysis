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
  defaultIfEmpty,
} from '@data-analysis/core';
import { getNowTime } from '@data-analysis/utils';
import { divideEquallyRx } from '@data-analysis/core/src/divideEqually';
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

export const makeCuObservable = (
  shortInterval: number = 6,
  longInterval: number = 13,
  signalInterval: number = 9,
) => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<string>((subscriber: Subscriber<string>) => {
      let currKLine: KLineBaseInterface | {} = {}; // 当前推入的最新k线
      const buy = new BaseCs();
      const sell = new BaseCs();

      const main$ = observable.pipe(
        tap((curr) => {
          currKLine = curr;
        }),
        mergeKLine(15),
        share(),
      );

      const macd$ = main$.pipe(
        map(({ close }) => new Big(close)),
        MACD({
          indicator: EMA,
          shortInterval,
          longInterval,
          signalInterval,
        }),
        skip(1),
      );

      const adx$ = main$.pipe(
        mergeKLine(4),
        map(({ close, high, low }) => ({ close, high, low })),
        ADX(14),
      );

      const source$ = combineLatest([macd$, adx$, main$]).pipe(share());

      const maxmin$ = source$.pipe(
        map(([{ histogram }, adx, kline]) => ({
          histogram,
          adx: new Big(adx),
          kline,
        })),
        bufferCount(50, 10),
        filter((x) => x.length === 50),
        concatMap((items) => {
          return zip(
            from(items).pipe(
              max(({ histogram: a }, { histogram: b }) => (a.lt(b) ? -1 : 1)),
            ),
            from(items).pipe(
              min(({ histogram: a }, { histogram: b }) => (a.lt(b) ? -1 : 1)),
            ),
          ).pipe(
            concatMap(([{ histogram: max }, { histogram: min }]) => {
              return zip(
                divideEquallyRx(0, max, 10),
                divideEquallyRx(min, 0, 10),
              ).pipe(
                concatMap(([max, min]) =>
                  zip(from(max), from(min.reverse())).pipe(
                    concatMap(([upper, lower]) => {
                      let prev = 0;
                      const buy = new BaseCs();
                      const sell = new BaseCs();

                      const share$ = from(items).pipe(
                        concatMap(({ histogram: macd, adx, kline }) => {
                          let info = 0;

                          if (macd.gt(upper) && (prev === 3 || prev === 0)) {
                            info = 1;
                            prev = 1;
                          } else if (
                            macd.lt(lower) &&
                            (prev === 1 || prev === 0)
                          ) {
                            info = 3;
                            prev = 3;
                          } else {
                            info = 2;
                          }

                          return of({ info, adx, kline }).pipe(
                            filter((x) => !!x.info),
                          );
                        }),
                        share(),
                      );

                      return zip(
                        share$.pipe(
                          concatMap(({ info, adx, kline }) => {
                            let result = '';
                            let profit = new Big(0);

                            if (!buy.isOpen && info === 3 && adx.lt(25)) {
                              result = '开多';
                              buy.prev = new Big(kline.close);
                              buy.isOpen = true;
                            } else if (buy.isOpen && info === 1) {
                              result = '平空';
                              profit = buy.getProfit(
                                result,
                                new Big(kline.close),
                              );
                              buy.profit = profit;
                              buy.isOpen = false;
                            }

                            return of(profit).pipe(filter((x) => !x.eq(0)));
                          }),
                          scan((curr, next) => curr.plus(next), new Big(0)),
                          defaultIfEmpty(new Big(0)),
                          last(),
                        ),
                        share$.pipe(
                          concatMap(({ info, adx, kline }) => {
                            let result = '';
                            let profit = new Big(0);

                            if (!sell.isOpen && info === 1 && adx.lt(25)) {
                              result = '开空';
                              sell.prev = new Big(kline.close);
                              sell.isOpen = true;
                            } else if (sell.isOpen && info === 3) {
                              result = '平多';
                              profit = sell.getProfit(
                                result,
                                new Big(kline.close),
                              );
                              sell.profit = profit;
                              sell.isOpen = false;
                            }

                            return of(profit).pipe(filter((x) => !x.eq(0)));
                          }),
                          scan((curr, next) => curr.plus(next), new Big(0)),
                          defaultIfEmpty(new Big(0)),
                          last(),
                        ),
                      ).pipe(
                        map(([buy, sell]) => ({
                          sum: buy.plus(sell),
                          upper,
                          lower,
                        })),
                      );
                    }),
                  ),
                ),
              );
            }),
          );
        }),
        share(),
      );

      // macd$.subscribe((x) =>
      //   console.log(x.histogram.round(8).toString(), 'macd value ->'),
      // );

      // adx$.subscribe((x) =>
      //   console.log(new Big(x).round(8).toString(), 'adx value ->'),
      // );

      // maxmin$.subscribe((x) => console.log(x, '最大最小值'));

      const share$ = source$.pipe(
        concatMap(([macd, adx]) => {
          const { histogram } = macd;
          let info = 0;

          if (histogram.gt(0)) {
            info = 1;
          } else if (histogram.lt(0)) {
            info = 3;
          } else {
            info = 2;
          }

          // console.log(info, new Big(adx).round(8).toString(), 'adx ->');

          return of({ info, adx }).pipe(filter((x) => !!x.info));
        }),
        share(),
      );

      const buy$ = share$.pipe(
        concatMap(({ info, adx }) => {
          let result = '';
          let profit = new Big(0);
          // if (buy.isOpen) buy.count++;

          if (!buy.isOpen && info === 1 && buy.prevInfo !== 1) {
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
          console.log(
            `buy: ${result}. price: ${
              (currKLine as KLineBaseInterface).close
            } time: ${getNowTime((currKLine as KLineBaseInterface).id)}`,
          );

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

      const sell$ = share$.pipe(
        concatMap(({ info, adx }) => {
          let result = '';
          let profit = new Big(0);
          // if (sell.isOpen) sell.count++;

          if (!sell.isOpen && info === 3 && sell.prevInfo !== 3) {
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
          console.log(
            `sell: ${result}. price: ${
              (currKLine as KLineBaseInterface).close
            } time: ${getNowTime((currKLine as KLineBaseInterface).id)}`,
          );

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
