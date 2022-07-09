import { makeCuObservable } from '@data-analysis/operators/src/macd';
import {
  defer,
  concatMap,
  of,
  BigSource,
  Observable,
  Big,
  from,
  reduce,
  map,
  delay,
  tap,
  groupBy,
  mergeMap,
  take,
  filter,
  share,
  scan,
  last,
  max,
  zip,
} from '@data-analysis/core';
import axios from '@data-analysis/utils/axios';
import { correctionTime } from '@data-analysis/utils';
import { spliceURL } from '@data-analysis/utils/spliceURL';
import { timeHuobi } from '@data-analysis/utils/time';
// import { makeCuObservable } from '@data-analysis/operators';

interface KLineParamsInterface {
  symbol: string; // 交易对
  interval: string; // 时间间隔
  limit?: string; // k线长度
  startTime?: string; // 开始时间
  endTime?: string; // 结束时间
}

interface KLineInterface {
  id: number; // 时间戳
  open: BigSource; // 开盘价
  close: BigSource; // 收盘价
  low: BigSource; // 最低价
  high: BigSource; // 最高价
  volume: BigSource; // 成交量
}

class MainStore {
  // 当前交易对的配置信息
  currTard: KLineParamsInterface = {
    symbol: 'LINK-USDT',
    interval: '1min',
    limit: '300',
  };

  constructor() {
    this.onLoad();
  }

  onLoad() {
    console.log('hello');
    let kline: any = {};
    const { symbol, interval, limit = '' } = this.currTard;
    this.fetchExchangeInfo()
      .pipe(
        concatMap((items) =>
          from(items).pipe(map((x: any) => x.contract_code)),
        ),
        take(1),
        concatMap((symbol) => {
          return this.fetchKLine({
            symbol,
            interval,
            // startTime: '1636449600',
            // endTime: '1636467600',
            limit,
          }).pipe(
            concatMap((item) => {
              const result = [];
              let rightTimestamp = new Big(item[0].id)
                .times(1000)
                .minus(new Big(1).times(timeHuobi[interval]).times(1000))
                .toString();

              for (let i = 0; i < 80; i++) {
                const startTime = new Big(rightTimestamp)
                  .minus(new Big(limit).times(timeHuobi[interval]).times(1000))
                  .toString();

                result.push({
                  startTime: startTime,
                  endTime: rightTimestamp,
                });

                rightTimestamp = new Big(startTime)
                  .minus(new Big(1).times(timeHuobi[interval]).times(1000))
                  .toString();
              }

              console.log(result, '请求时间戳数组 ->');

              return from(result).pipe(
                concatMap(({ startTime, endTime }) =>
                  this.fetchKLine({
                    symbol: symbol,
                    interval: interval,
                    startTime: (+startTime / 1000).toString(),
                    endTime: (+endTime / 1000).toString(),
                  }),
                ),
                reduce(
                  (curr, next) => [...next, ...curr],
                  [] as KLineInterface[],
                ),
                map((curr) => [...curr, ...item]),
              );
            }),
            concatMap((items) => {
              const start = correctionTime(items[0].id * 1000) + 7 * 60;

              const result = [];

              for (let i = 6; i < 34; i++) {
                for (let j = i + 1; j < 35; j++) {
                  result.push({
                    short: i,
                    long: j,
                    si: 9,
                  });
                }
              }

              console.log(result, '6666');

              const source$ = from(items).pipe(
                delay(5),
                filter(({ id }) => id >= start),
                map(({ id, open, close, high, low, vol }: any) => ({
                  id: id * 1000,
                  open,
                  close,
                  high,
                  low,
                  volume: vol,
                })),
                share(),
              );

              return from(result).pipe(
                concatMap(({ short, long, si }) => {
                  return zip(
                    of([short, long, si]),
                    source$.pipe(
                      tap((x) => (kline = x)),
                      makeCuObservable(short, long, si),
                      concatMap((info: string) =>
                        of({
                          id: kline.id,
                          info,
                          close: kline.close,
                          high: kline.high,
                          low: kline.low,
                        }),
                      ),
                      groupBy(({ info }) => info === '开多' || info === '平空'),
                      mergeMap((group$) =>
                        group$.pipe(
                          reduce(
                            (acc, cur) => [...acc, cur],
                            [] as {
                              id: any;
                              info: string;
                              close: any;
                              high: any;
                              low: any;
                            }[],
                          ),
                        ),
                      ),
                      // tap(x => console.log(x, '分组数据')),
                      concatMap((items) => {
                        const obj = {
                          sum: new Big(0),
                          sumLists: [] as string[],
                          prev: new Big(0),
                          isOpen: false,
                        };

                        let dir = '';

                        for (const item of items) {
                          const { info, close } = item;

                          if (!obj.isOpen && info.includes('开')) {
                            obj.prev = new Big(close);
                            obj.isOpen = true;
                          } else if (obj.isOpen && info.includes('平')) {
                            dir = info.includes('空') ? 'buy' : 'sell';

                            obj.sum = obj.sum.plus(
                              info.includes('空')
                                ? new Big(close).minus(obj.prev)
                                : new Big(obj.prev).minus(close),
                            );
                            obj.sumLists.push(obj.sum.toString());

                            obj.isOpen = false;
                          }
                        }

                        return of({
                          sum: obj.sum,
                          sumLists: obj.sumLists,
                          info: dir,
                          macd: [short, long, si],
                        });
                      }),
                      tap(({ info, macd, sum, sumLists }) =>
                        console.log(
                          info,
                          macd,
                          sum.toString(),
                          JSON.stringify(sumLists),
                          'x -> 分组数据',
                        ),
                      ),
                      scan((curr, next) => curr.plus(next.sum), new Big(0)),
                      last(),
                    ),
                  );
                }),
                max(([, a], [, b]) => (a.lt(b) ? -1 : 1)),
              );
            }),
          );
        }),
      )
      .subscribe(([x]) => console.log(x, 'x -> 最终数据'));
    // this.fetchKLine({
    //   symbol,
    //   interval,
    //   // startTime: '1636449600',
    //   // endTime: '1636467600',
    //   limit,
    // })
    //   .pipe(
    //     concatMap((item) => {
    //       const result = [];
    //       let rightTimestamp = new Big(item[0].id)
    //         .times(1000)
    //         .minus(new Big(1).times(timeHuobi[interval]).times(1000))
    //         .toString();

    //       for (let i = 0; i < 100; i++) {
    //         const startTime = new Big(rightTimestamp)
    //           .minus(new Big(limit).times(timeHuobi[interval]).times(1000))
    //           .toString();

    //         result.push({
    //           startTime: startTime,
    //           endTime: rightTimestamp,
    //         });

    //         rightTimestamp = new Big(startTime)
    //           .minus(new Big(1).times(timeHuobi[interval]).times(1000))
    //           .toString();
    //       }

    //       console.log(result, '请求时间戳数组 ->');

    //       return from(result).pipe(
    //         concatMap(({ startTime, endTime }) =>
    //           this.fetchKLine({
    //             symbol: symbol,
    //             interval: interval,
    //             startTime: (+startTime / 1000).toString(),
    //             endTime: (+endTime / 1000).toString(),
    //           }),
    //         ),
    //         reduce((curr, next) => [...next, ...curr], [] as KLineInterface[]),
    //         map((curr) => [...curr, ...item]),
    //       );
    //     }),
    //     concatMap((item) =>
    //       from(item).pipe(
    //         delay(5),
    //         map(({ id, open, close, high, low, vol }: any) => ({
    //           id: id * 1000,
    //           open,
    //           close,
    //           high,
    //           low,
    //           volume: vol,
    //         })),
    //         tap((x) => (kline = x)),
    //         makeCuObservable(5),
    //         concatMap((info: string) =>
    //           of({
    //             id: kline.id,
    //             info,
    //             close: kline.close,
    //             high: kline.high,
    //             low: kline.low,
    //           }),
    //         ),
    //       ),
    //     ),
    //     groupBy(({ info }) => info === '开多' || info === '平空'),
    //     mergeMap((group$) =>
    //       group$.pipe(
    //         reduce(
    //           (acc, cur) => [...acc, cur],
    //           [] as {
    //             id: any;
    //             info: string;
    //             close: any;
    //             high: any;
    //             low: any;
    //           }[],
    //         ),
    //       ),
    //     ),
    //     // tap(x => console.log(x, '分组数据')),
    //     concatMap((items) => {
    //       const obj = {
    //         sum: new Big(0),
    //         sumLists: [] as string[],
    //         prev: new Big(0),
    //         isOpen: false,
    //       };

    //       let dir = '';

    //       for (const item of items) {
    //         const { info, close } = item;

    //         if (!obj.isOpen && info.includes('开')) {
    //           obj.prev = new Big(close);
    //           obj.isOpen = true;
    //         } else if (obj.isOpen && info.includes('平')) {
    //           dir = info.includes('空') ? 'buy' : 'sell';

    //           obj.sum = obj.sum.plus(
    //             info.includes('空')
    //               ? new Big(close).minus(obj.prev)
    //               : new Big(obj.prev).minus(close),
    //           );
    //           obj.sumLists.push(obj.sum.toString());

    //           obj.isOpen = false;
    //         }
    //       }

    //       return of({ sum: obj.sum, sumLists: obj.sumLists, info: dir });
    //     }),
    //   )
    //   .subscribe(({ info, sum, sumLists }) =>
    //     console.log(
    //       info,
    //       sum.toString(),
    //       JSON.stringify(sumLists),
    //       'x -> 分组数据',
    //     ),
    //   );
  }

  fetchKLine(kline: KLineParamsInterface): Observable<KLineInterface[]> {
    return defer(() =>
      axios
        .get(`https://vsweb.linairx.top/api/kline/huobi${spliceURL(kline)}`)
        .then((x) => x.data),
    );
  }

  fetchExchangeInfo(): Observable<any[]> {
    return defer(() =>
      axios
        .get(`https://vsweb.linairx.top/api/exchangeInfo/huobi`)
        .then((x) => x.data),
    );
  }

  sayHello() {
    return 'hello';
  }
}

export default new MainStore();
