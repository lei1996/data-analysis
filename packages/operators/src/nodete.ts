import { getNowTime } from '@data-analysis/utils/time';
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
  pipe,
  zip,
  from,
  max,
  min,
  scan,
  last,
  pairwise,
  SMA,
  ADX,
  bufferCount,
  toArray,
  tap,
  MACD,
  EMA,
  ATR,
} from '@data-analysis/core';

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
export const mergeKLine = () => {
  return pipe(
    concatMap((items: KLineBaseInterface[]) => {
      const source$ = zip(
        from(items).pipe(max((a, b) => (new Big(a.high).lt(b.high) ? -1 : 1))),
        from(items).pipe(min((a, b) => (new Big(a.low).lt(b.low) ? -1 : 1))),
        from(items).pipe(
          scan((a, b) => a.plus(b.volume), new Big(0)),
          last(),
        ),
      ).pipe(share());

      return zip(
        source$.pipe(
          concatMap(([max, min]) =>
            of({
              dir: max.id > min.id ? 'up' : 'down',
              diff: new Big(max.high).minus(min.low),
              max,
              min,
            }),
          ),
        ),
        source$.pipe(
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
        ),
      );
    }),
  );
};

/**
 * 合并收益
 * @param
 * @returns
 */
export const mergeProfit = (interval: number) => {
  return pipe(
    filter(({ profit }: { profit: Big }) => !profit.eq(0)),
    map(({ profit }) => profit),
    bufferCount(interval, 1),
    concatMap((items) =>
      from(items).pipe(
        scan((curr, next) => curr.plus(next), new Big(0)),
        last(),
      ),
    ),
  );
};

export const computeChange = () => {
  return pipe(
    concatMap((items: KLineBaseInterface[]) => {
      const first = new Big(items[0].close);
      const last = new Big(items[items.length - 1].close);

      const absFirst = first.abs();

      return of(last.minus(first).div(absFirst).times(100).round(2));
    }),
  );
};

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
      let kLines: KLineBaseInterface[] = [];
      let macd = new MACD({
        indicator: EMA,
        shortInterval: 13,
        longInterval: 34,
        signalInterval: 9,
      });
      let atr = new ATR(13);
      let adx = new ADX(45);
      let status = 0;
      const buy1 = {
        isOpen: false,
        ex: new BaseCs(),
      };
      const sell1 = {
        isOpen: false,
        ex: new BaseCs(),
      };
      const buy2 = {
        isOpen: false,
        ex: new BaseCs(),
      };
      const sell2 = {
        isOpen: false,
        ex: new BaseCs(),
      };

      const main$ = observable.pipe(
        concatMap((item) => {
          const { high, low, close } = item;
          currKLine = item;

          // 如果是最后一个k线，则更新它
          if (!!kLines.length && kLines[kLines.length - 1].id === item.id) {
            kLines[kLines.length - 1] = item;
          } else {
            kLines.push(item);
          }

          // 数组长度 超出 interval 则 弹出第一个值
          if (kLines.length > 60) {
            kLines.shift();
          }

          adx.update({
            high,
            low,
            close,
          });

          return of(kLines).pipe(
            filter((x) => x.length === 60),
            concatMap((items) =>
              from(items).pipe(bufferCount(20, 20), computeChange(), toArray()),
            ),
          );
        }),
        share(),
      );

      const source$ = main$.pipe(
        concatMap((x) => {
          let info = 0;

          console.log(
            getNowTime((currKLine as KLineBaseInterface).id),
            x[0].toNumber(),
            x[1].toNumber(),
            x[2].toNumber(),
            'x -> number',
          );

          if (adx.isStable) {
            console.log(adx.getResult().toNumber(), 'adx value ->');
          }

          if (x[0].gt(0) && x[1].gt(0) && x[2].gt(0)) {
            info = 1;
          } else if (x[0].lt(0) && x[1].lt(0) && x[2].lt(0)) {
            info = 3;
          } else {
            info = 2;
          }

          return of(info).pipe(filter((x) => !!x));
        }),
        share(),
      );

      // const buySource1$ = source$.pipe(
      //   concatMap((info) => {
      //     let result = '';
      //     let profit = new Big(0);

      //     if (!buy1.ex.isOpen && info === 1) {
      //       result = '开多';
      //       buy1.ex.prev = new Big((currKLine as KLineBaseInterface).close);
      //       buy1.ex.isOpen = true;
      //     } else if (buy1.ex.isOpen && info !== 1) {
      //       result = '平空';
      //       profit = buy1.ex.getProfit(
      //         result,
      //         new Big((currKLine as KLineBaseInterface).close),
      //       );
      //       buy1.ex.isOpen = false;
      //     }

      //     return of({ result, profit }).pipe(filter((x) => !!x.result));
      //   }),
      //   share(),
      // );

      // const buy1$ = buySource1$
      //   .pipe(filter(() => !buy1.ex.profit.eq(0)))
      //   .subscribe({
      //     next({ result }) {
      //       const profit = buy1.ex.profit;
      //       // console.log(profit.toNumber(), 'buy1 ->');

      //       if (!buy1.isOpen && profit.gt(0) && result.includes('开')) {
      //         subscriber.next(result);
      //         buy1.isOpen = true;
      //       } else if (buy1.isOpen && result.includes('平')) {
      //         subscriber.next(result);
      //         buy1.isOpen = false;
      //       }
      //     },
      //     error(err) {
      //       // We need to make sure we're propagating our errors through.
      //       subscriber.error(err);
      //     },
      //     complete() {
      //       subscriber.complete();
      //     },
      //   });

      // const buyIsLock1$ = buySource1$.pipe(mergeProfit(3)).subscribe({
      //   next(sum) {
      //     buy1.ex.profit = sum;
      //   },
      //   error(err) {
      //     // We need to make sure we're propagating our errors through.
      //     subscriber.error(err);
      //   },
      //   complete() {
      //     subscriber.complete();
      //   },
      // });

      // const sellSource1$ = source$.pipe(
      //   concatMap((info) => {
      //     let result = '';
      //     let profit = new Big(0);

      //     if (!sell1.ex.isOpen && info === 3) {
      //       result = '开空';
      //       sell1.ex.prev = new Big((currKLine as KLineBaseInterface).close);
      //       sell1.ex.isOpen = true;
      //     } else if (sell1.ex.isOpen && info !== 3) {
      //       result = '平多';
      //       profit = sell1.ex.getProfit(
      //         result,
      //         new Big((currKLine as KLineBaseInterface).close),
      //       );
      //       sell1.ex.isOpen = false;
      //     }

      //     return of({ result, profit }).pipe(filter((x) => !!x.result));
      //   }),
      //   share(),
      // );

      // const sell1$ = sellSource1$
      //   .pipe(filter(() => !sell1.ex.profit.eq(0)))
      //   .subscribe({
      //     next({ result }) {
      //       const profit = sell1.ex.profit;
      //       // console.log(profit.toNumber(), 'sell1 ->');

      //       if (!sell1.isOpen && profit.gt(0) && result.includes('开')) {
      //         subscriber.next(result);
      //         sell1.isOpen = true;
      //       } else if (sell1.isOpen && result.includes('平')) {
      //         subscriber.next(result);
      //         sell1.isOpen = false;
      //       }
      //     },
      //     error(err) {
      //       // We need to make sure we're propagating our errors through.
      //       subscriber.error(err);
      //     },
      //     complete() {
      //       subscriber.complete();
      //     },
      //   });

      // const sellIsLock1$ = sellSource1$.pipe(mergeProfit(3)).subscribe({
      //   next(sum) {
      //     sell1.ex.profit = sum;
      //   },
      //   error(err) {
      //     // We need to make sure we're propagating our errors through.
      //     subscriber.error(err);
      //   },
      //   complete() {
      //     subscriber.complete();
      //   },
      // });

      const buySource2$ = source$.pipe(
        concatMap((info) => {
          let result = '';
          let profit = new Big(0);

          if (!buy1.ex.isOpen && info === 1) {
            result = '开多';
            buy1.ex.prev = new Big((currKLine as KLineBaseInterface).close);
            buy1.ex.isOpen = true;
          } else if (buy1.ex.isOpen && info !== 1) {
            result = '平空';
            profit = buy1.ex.getProfit(
              result,
              new Big((currKLine as KLineBaseInterface).close),
            );
            buy1.ex.isOpen = false;
          }

          return of({ result, profit }).pipe(filter((x) => !!x.result));
        }),
        share(),
      );

      const buy2$ = buySource2$
        .pipe(filter(() => !buy2.ex.profit.eq(0) && adx.isStable))
        .subscribe({
          next({ result }) {
            const profit = buy2.ex.profit;
            // console.log(profit.toNumber(), 'buy2 ->');

            if (
              !buy2.isOpen &&
              profit.gt(0) &&
              adx.getResult().gt(15) &&
              result.includes('开')
            ) {
              subscriber.next(result);
              buy2.isOpen = true;
            } else if (buy2.isOpen && result.includes('平')) {
              subscriber.next(result);
              buy2.isOpen = false;
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

      const buyIsLock2$ = buySource2$.pipe(mergeProfit(4)).subscribe({
        next(sum) {
          buy2.ex.profit = sum;
        },
        error(err) {
          // We need to make sure we're propagating our errors through.
          subscriber.error(err);
        },
        complete() {
          subscriber.complete();
        },
      });

      const sellSource2$ = source$.pipe(
        concatMap((info) => {
          let result = '';
          let profit = new Big(0);

          if (!sell2.ex.isOpen && info === 3) {
            result = '开空';
            sell2.ex.prev = new Big((currKLine as KLineBaseInterface).close);
            sell2.ex.isOpen = true;
          } else if (sell2.ex.isOpen && info !== 3) {
            result = '平多';
            profit = sell2.ex.getProfit(
              result,
              new Big((currKLine as KLineBaseInterface).close),
            );
            sell2.ex.isOpen = false;
          }

          return of({ result, profit }).pipe(filter((x) => !!x.result));
        }),
        share(),
      );

      const sell2$ = sellSource2$
        .pipe(filter(() => !sell2.ex.profit.eq(0) && adx.isStable))
        .subscribe({
          next({ result }) {
            const profit = sell2.ex.profit;
            // console.log(profit.toNumber(), 'sell2 ->');

            if (
              !sell2.isOpen &&
              profit.gt(0) &&
              adx.getResult().gt(15) &&
              result.includes('开')
            ) {
              subscriber.next(result);
              sell2.isOpen = true;
            } else if (sell2.isOpen && result.includes('平')) {
              subscriber.next(result);
              sell2.isOpen = false;
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

      const sellIsLock2$ = sellSource2$.pipe(mergeProfit(4)).subscribe({
        next(sum) {
          sell2.ex.profit = sum;
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
        // buy1$.unsubscribe();
        // buyIsLock1$.unsubscribe();
        // sell1$.unsubscribe();
        // sellIsLock1$.unsubscribe();
        buy2$.unsubscribe();
        buyIsLock2$.unsubscribe();
        sell2$.unsubscribe();
        sellIsLock2$.unsubscribe();

        // Clean up all state.
        currKLine = null!;
      };
    });
};
