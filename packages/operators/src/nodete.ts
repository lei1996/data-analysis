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

export const makeCuObservable = (interval: number = 5) => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<string>((subscriber: Subscriber<string>) => {
      let currKLine: KLineBaseInterface | {} = {}; // 当前推入的最新k线
      let kLines: KLineBaseInterface[] = [];
      const buy = {
        isOpen: false,
      };
      const sell = {
        isOpen: false,
      };

      const prev = {
        max: new Big(0),
        min: new Big(0),
      };

      const main$ = observable.pipe(
        concatMap((item) => {
          currKLine = item;

          // 如果是最后一个k线，则更新它
          if (!!kLines.length && kLines[kLines.length - 1].id === item.id) {
            kLines[kLines.length - 1] = item;
          } else {
            kLines.push(item);
          }

          // 数组长度 超出 interval 则 弹出第一个值
          if (kLines.length > 300) {
            kLines.shift();
          }

          return of(kLines).pipe(
            filter((x) => x.length === 300),
            concatMap((items) =>
              from(items).pipe(
                bufferCount(15, 15),
                mergeKLine(),
                map(([_, x2]) => x2),
                toArray(),
              ),
            ),
          );
        }),
        share(),
      );

      const share$ = main$.pipe(
        // tap((x) => console.log(x.length, 'kkk')),
        mergeKLine(),
        share(),
      );

      const source$ = share$.pipe(
        concatMap(([x1, x2]) => {
          let info = 0;

          if (!prev.max.eq(0) && !prev.min.eq(0)) {
            if (new Big(x2.high).gt(prev.max)) {
              info = 1;
            } else if (
              new Big(x2.close).lt(prev.max) &&
              new Big(x2.close).gt(prev.min)
            ) {
              info = 2;
            } else if (new Big(x2.low).lt(prev.min)) {
              info = 3;
            }
          }

          prev.max = new Big(x1.max.high);
          prev.min = new Big(x1.min.low);

          return of(info).pipe(filter((x) => !!x));
        }),
        share(),
      );

      const buy$ = source$
        .pipe(filter((info) => info === 1 || info === 2))
        .subscribe({
          next(info) {
            if (!buy.isOpen && info === 1) {
              subscriber.next('开多');
              buy.isOpen = true;
            } else if (buy.isOpen && info === 2) {
              subscriber.next('平空');
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
        .pipe(filter((info) => info === 3 || info === 2))
        .subscribe({
          next(info) {
            if (!sell.isOpen && info === 3) {
              subscriber.next('开空');
              sell.isOpen = true;
            } else if (sell.isOpen && info === 2) {
              subscriber.next('平多');
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

      return () => {
        console.log('makeCuObservable 清空状态');
        buy$.unsubscribe();
        sell$.unsubscribe();

        // Clean up all state.
        currKLine = null!;
      };
    });
};
