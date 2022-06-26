import {
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
  pairwise,
  SMA,
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
      let indicator: SMA = new SMA(interval);
      const buy = {
        isOpen: false,
      };
      const sell = {
        isOpen: false,
      };
      const result = {
        prev: '',
        prevOpen: new Big(0),
        sum: new Big(0),
      };
      const equalizerResult = {
        prev: '',
        prevOpen: new Big(0),
        sum: new Big(0),
      };

      const main$ = observable.pipe(share());

      const share$ = main$.pipe(mergeKLine(interval), share());

      const source$ = share$.pipe(
        concatMap(([x1, x2]) => {
          let info = [];

          if (result.prev === '') {
            result.prev = x1.dir;
          } else if (result.prev !== x1.dir) {
            if (x1.dir === 'up') {
              if (!result.prevOpen.eq(0) && indicator.isStable) {
                const num = indicator.getResult();

                if (num.gt(0)) {
                  info.push('平多', '开多');
                } else {
                  info.push('平空', '开空');
                }
              }
              result.prevOpen = new Big(x2.close);
            } else {
              if (!result.prevOpen.eq(0) && indicator.isStable) {
                const num = indicator.getResult();

                if (num.gt(0)) {
                  info.push('平空', '开空');
                } else {
                  info.push('平多', '开多');
                }
              }
              result.prevOpen = new Big(x2.close);
            }
            result.prev = x1.dir;
          }

          return from(info);
        }),
        share(),
      );

      const buy$ = source$
        .pipe(filter((info) => info === '开多' || info === '平空'))
        .subscribe({
          next(info) {
            if (!buy.isOpen && info.includes('开')) {
              subscriber.next(info);
              buy.isOpen = true;
            } else if (buy.isOpen && info.includes('平')) {
              subscriber.next(info);
              buy.isOpen = false;
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

      const sell$ = source$
        .pipe(filter((info) => info === '开空' || info === '平多'))
        .subscribe({
          next(info) {
            if (!sell.isOpen && info.includes('开')) {
              subscriber.next(info);
              sell.isOpen = true;
            } else if (sell.isOpen && info.includes('平')) {
              subscriber.next(info);
              sell.isOpen = false;
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

      const equalizerSubscription = share$
        .pipe(
          concatMap(([x1, x2]) => {
            if (equalizerResult.prev === '') {
              equalizerResult.prev = x1.dir;
            } else if (equalizerResult.prev !== x1.dir) {
              if (x1.dir === 'up') {
                if (!equalizerResult.prevOpen.eq(0)) {
                  equalizerResult.sum = equalizerResult.sum.plus(
                    equalizerResult.prevOpen.minus(x2.close),
                  );
                }
                equalizerResult.prevOpen = new Big(x2.close);
              } else {
                if (!equalizerResult.prevOpen.eq(0)) {
                  equalizerResult.sum = equalizerResult.sum.plus(
                    new Big(x2.close).minus(equalizerResult.prevOpen),
                  );
                }
                equalizerResult.prevOpen = new Big(x2.close);
              }
              equalizerResult.prev = x1.dir;
            }

            return of(equalizerResult.sum.toString());
          }),
          pairwise(),
          filter(([x1, x2]) => x1 !== x2),
          map(([_, x2]) => x2),
        )
        .subscribe((x) => {
          console.log(x, '5 result ->');
          indicator.update(x);
        });

      return () => {
        console.log('makeCuObservable 清空状态');
        equalizerSubscription.unsubscribe();
        buy$.unsubscribe();
        sell$.unsubscribe();

        // Clean up all state.
        currKLine = null!;
      };
    });
};
