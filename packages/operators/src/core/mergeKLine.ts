import {
  Big,
  bufferCount,
  concatMap,
  from,
  last,
  map,
  max,
  min,
  pipe,
  scan,
  zip,
} from '@data-analysis/core';
import { KLineBaseInterface } from '../types/kline';

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
