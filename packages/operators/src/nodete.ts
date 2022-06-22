import {
  ADX,
  EMA,
  RSI,
  MACD,
  share,
  Observable,
  Subscriber,
  concatMap,
  of,
  Big,
  BigSource,
  bufferCount,
  map,
  filter,
  pipe,
  zip,
  from,
  max,
  min,
  scan,
  last,
} from '@data-analysis/core';
import { divideEquallyRx } from '@data-analysis/core/src/divideEqually';
import { Business } from './base';
import { equalizerRxOperator, orderHubRxOperator } from './core';

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
 * @param interval 长度
 * @returns
 */
export const mergeKLine = (interval: number) => {
  return pipe(
    bufferCount<KLineBaseInterface>(interval, 1),
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
            }),
          ),
        ),
        source$.pipe(
          map(([max, min, volume]) => ({
            id: items[0].id,
            open: items[0].open,
            close: items[items.length - 1].close,
            high: max.high,
            low: min.low,
            volume,
          })),
        ),
      );
    }),
  );
};

export const makeCuObservable = (interval: number = 5) => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<string>((subscriber: Subscriber<string>) => {
      let currKLine: KLineBaseInterface | {} = {}; // 当前推入的最新k线
      let count: number = 0; // 推入的 k线数量
      let prev = '';
      const buy = {
        isOpen: false,
      };
      const sell = {
        isOpen: false,
      };
      const result = {
        prevOpen: new Big(0),
        sum: new Big(0),
      };

      // 判断是否超过了初始化的参数
      const isComplete = (): boolean => {
        return count > interval;
      };

      const main$ = observable.pipe(share());

      const Subscription1 = main$.subscribe({
        next(item) {
          const { high, low, close, volume } = item;
          count++;
          currKLine = item;
        },
        error(err) {
          // We need to make sure we're propagating our errors through.
          subscriber.error(err);
        },
        complete() {
          subscriber.complete();
        },
      });

      // main$
      //   .pipe(
      //     mergeKLine(interval),
      //     concatMap(([x1, x2]) => {
      //       if (prev === '') {
      //         prev = x1.dir;
      //       } else if (prev !== x1.dir) {
      //         if (x1.dir === 'up') {
      //           if (!result.prevOpen.eq(0)) {
      //             result.sum = result.sum.plus(
      //               new Big(x2.close).minus(result.prevOpen),
      //             );
      //           }
      //           result.prevOpen = new Big(x2.close);
      //         } else {
      //           if (!result.prevOpen.eq(0)) {
      //             result.sum = result.sum.plus(result.prevOpen.minus(x2.close));
      //           }
      //           result.prevOpen = new Big(x2.close);
      //         }
      //       }

      //       return of(result.sum.toString());
      //     }),
      //   )
      //   .subscribe((x) => console.log(x, '5 result ->'));

      const mainSubscription = main$
        .pipe(
          mergeKLine(interval),
          concatMap(([x1, x2]) => {
            let info = [];

            if (prev === '') {
              prev = x1.dir;
            } else if (prev !== x1.dir) {
              if (x1.dir === 'up') {
                if (!result.prevOpen.eq(0)) {
                  if (sell.isOpen) {
                    info.push('平多');
                    sell.isOpen = false;
                  }
                  if (!buy.isOpen) {
                    info.push('开多');
                    buy.isOpen = true;
                  }
                }
                result.prevOpen = new Big(x2.close);
              } else {
                if (!result.prevOpen.eq(0)) {
                  if (buy.isOpen) {
                    info.push('平空');
                    buy.isOpen = false;
                  }
                  if (!sell.isOpen) {
                    info.push('开空');
                    sell.isOpen = true;
                  }
                }
                result.prevOpen = new Big(x2.close);
              }
              prev = x1.dir;
            }

            return from(info);
          }),
        )
        .subscribe({
          next(info) {
            // console.log(info, 'info');

            subscriber.next(info);
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
        Subscription1.unsubscribe();
        mainSubscription.unsubscribe();

        // Clean up all state.
        currKLine = null!;
      };
    });
};
