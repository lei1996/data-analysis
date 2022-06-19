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
  from,
  zip,
  defaultIfEmpty,
  last,
  max,
  BigSource,
  bufferCount,
  map,
  tap,
  filter,
  delay,
} from '@data-analysis/core';
import { divideEquallyRx } from '@data-analysis/core/src/divideEqually';
import { Business, Prev } from './base';
import { equalizerRxOperator, orderHubRxOperator } from './core';
import { EqualizerRxInterface } from './types/equalizer.Rx';
import { OperatorInterface } from './types/macd';

type OperatorType = typeof buyOperator | typeof sellOperator;

interface KLineBaseInterface {
  id: number; // 时间戳
  open: BigSource; // 开盘价
  close: BigSource; // 收盘价
  low: BigSource; // 最低价
  high: BigSource; // 最高价
  volume: BigSource; // 成交量
}

// 查找最优解 入参
interface AutoBestInterface {
  bests: number[][]; // 上界 和 下界  -> [10, -5]
  maxminArrs: BigSource[]; // macd 指标缓存
  klines: KLineBaseInterface[]; // kLine 缓存
}

export const makeSuObservable = (interval: number, maxLength: number = 300) => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<string>((subscriber: Subscriber<string>) => {
      let currKLine: KLineBaseInterface | {} = {}; // 当前推入的最新k线
      let buy = new Business();
      let sell = new Business();
      let macdIndicator = new MACD({
        indicator: EMA,
        shortInterval: 6,
        longInterval: 13,
        signalInterval: 4,
      });
      let volumeIndicator = new RSI(interval); // 量的 RSI 值
      let adxIndicator = new ADX(interval); // 当前趋势 值
      let count: number = 0; // 推入的 k线数量

      // 判断是否超过了初始化的参数
      const isComplete = (): boolean => {
        return count > maxLength;
      };

      const main$ = observable.pipe(share());

      const Subscription1 = main$.subscribe({
        next(item) {
          const { high, low, close, volume } = item;

          volumeIndicator.update(volume);
          adxIndicator.update({ high, low, close });
        },
        error(err) {
          // We need to make sure we're propagating our errors through.
          subscriber.error(err);
        },
        complete() {
          subscriber.complete();
        },
      });

      const share$ = main$.pipe(
        concatMap((item) => {
          const { close } = item;
          currKLine = item;

          macdIndicator.update(close);

          if (macdIndicator.isStable) {
            count++;
            const { histogram } = macdIndicator.getResult();
            return of(histogram);
          }
          return of();
        }),
        share(),
      );

      const buyShare$ = share$.pipe(
        concatMap((x) => of({ result: x, best: buy.best })),
        buyOperator(),
        filter(() => isComplete() && adxIndicator.getResult().lt(99)),
      );

      const sellShare$ = share$.pipe(
        concatMap((x) => of({ result: x, best: sell.best })),
        sellOperator(),
        filter(() => isComplete() && adxIndicator.getResult().lt(99)),
      );

      const buyIsLockSubscription = buyShare$
        .pipe(
          concatMap((info) =>
            of({
              info,
              _price: (currKLine as KLineBaseInterface).close,
            }),
          ),
          orderHubRxOperator(3),
          equalizerRxOperator(3),
        )
        .subscribe((x) => {
          console.log(
            `beforeSum: ${x.beforeSum.toString()}, aftersum: ${x.aftersum.toString()}, isLock: ${
              x.isLock
            }`,
          );
          buy.isLock = x.isLock;
        });
      const sellIsLockSubscription = sellShare$
        .pipe(
          concatMap((info) =>
            of({
              info,
              _price: (currKLine as KLineBaseInterface).close,
            }),
          ),
          orderHubRxOperator(3),
          equalizerRxOperator(3),
        )
        .subscribe((x) => {
          console.log(
            `beforeSum: ${x.beforeSum.toString()}, aftersum: ${x.aftersum.toString()}, isLock: ${
              x.isLock
            }`,
          );
          sell.isLock = x.isLock;
        });

      const buySubscription = buyShare$.subscribe({
        next(item) {
          if (!buy.isOpen && !buy.isLock && item.includes('开')) {
            buy.isOpen = true;
            console.log('多头', item);
            subscriber.next(item);
          } else if (buy.isOpen && item.includes('平')) {
            buy.isOpen = false;
            console.log('多头', item);
            subscriber.next(item);
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
      const sellSubscription = sellShare$.subscribe({
        next(item) {
          if (!sell.isOpen && !sell.isLock && item.includes('开')) {
            sell.isOpen = true;
            console.log('空头', item);
            subscriber.next(item);
          } else if (sell.isOpen && item.includes('平')) {
            sell.isOpen = false;
            console.log('空头', item);
            subscriber.next(item);
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

      const autoBestShare$ = share$.pipe(
        concatMap((x) =>
          of({ result: x, item: currKLine as KLineBaseInterface }),
        ),
        bufferCount(maxLength, 8), // 每间隔 1/3 k线发射一次值 第一次发射必须要填满 maxLength 根k线
        map((x) =>
          x.reduce(
            (curr, { result, item }) => ({
              klines: [...curr.klines, item],
              maxminArrs: [...curr.maxminArrs, result],
              maxVal: new Big(curr.maxVal).gt(result) ? curr.maxVal : result,
              minVal: new Big(curr.minVal).lt(result) ? curr.minVal : result,
            }),
            {
              klines: [] as KLineBaseInterface[],
              maxminArrs: [] as BigSource[],
              maxVal: new Big(-9999999) as BigSource,
              minVal: new Big(9999999) as BigSource,
            },
          ),
        ),
        concatMap(({ klines, maxminArrs, maxVal, minVal }) => {
          return divideEquallyRx(minVal, maxVal, 10).pipe(
            concatMap((nums) => {
              const result: any = {
                bests: [] as number[][],
                maxminArrs,
                klines,
              };

              for (let i = 1; i < nums.length - 1; i++) {
                // for (let j = i + 1; j < nums.length - 1; j++) {
                result.bests.push([nums[i], nums[i]]);
                // }
              }

              return of(result);
            }),
          );
        }),
        share(),
      );

      const buyAutoBestSubscription = autoBestShare$
        .pipe(autoBestOperator(buyOperator, 3))
        .subscribe(([equalizerResult, best]) => {
          console.log('buyAutoBestSubscription ->', best);
          buy.best = best;
          buy.isLock = equalizerResult.isLock;
        });

      const sellAutoBestSubscription = autoBestShare$
        .pipe(autoBestOperator(sellOperator, 3))
        .subscribe(([equalizerResult, best]) => {
          console.log('sellAutoBestSubscription ->', best);
          sell.best = best;
          sell.isLock = equalizerResult.isLock;
        });

      return () => {
        console.log('makeSuObservable 清空状态');
        Subscription1.unsubscribe();
        buySubscription.unsubscribe();
        buyIsLockSubscription.unsubscribe();
        buyAutoBestSubscription.unsubscribe();
        sellSubscription.unsubscribe();
        sellIsLockSubscription.unsubscribe();
        sellAutoBestSubscription.unsubscribe();
        // Clean up all state.
        macdIndicator = null!;
        volumeIndicator = null!;
        adxIndicator = null!;
        currKLine = null!;
      };
    });
};

// 查找最优解
const autoBestOperator = (operator: OperatorType, interval: number) => {
  return (observable: Observable<AutoBestInterface>) =>
    new Observable<[EqualizerRxInterface, number[]]>(
      (subscriber: Subscriber<[EqualizerRxInterface, number[]]>) => {
        const subscription = observable
          .pipe(
            concatMap(({ bests, maxminArrs, klines }) => {
              return from(bests).pipe(
                concatMap((best) => {
                  let kline: any = {};
                  const last$ = zip(from(klines), from(maxminArrs)).pipe(
                    concatMap(([item, result]) => {
                      kline = item;
                      return of({ result, best });
                    }),
                    operator(),
                    concatMap((info) =>
                      of({
                        info,
                        _price: kline.close,
                      }),
                    ),
                    orderHubRxOperator(interval),
                    equalizerRxOperator(interval),
                    defaultIfEmpty({
                      beforeSum: new Big(0),
                      aftersum: new Big(0),
                      isLock: true,
                    } as EqualizerRxInterface),
                    last(),
                  );

                  return zip(last$, of(best));
                }),
                // 最好的策略
                max<[EqualizerRxInterface, number[]]>((a, b) =>
                  new Big(a[0].aftersum).lt(b[0].aftersum) ? -1 : 1,
                ),
              );
            }),
          )
          .subscribe({
            next(item) {
              // console.log(item, 'auto 处理好的数据 - ');
              subscriber.next(item);
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
          subscription.unsubscribe();
          console.log('autoRsiExOperator 清空状态');
        };
      },
    );
};

// 做多 - 操作符
export const buyOperator = () => {
  return (observable: Observable<OperatorInterface>) =>
    new Observable<string>((subscriber: Subscriber<string>) => {
      let prev: Prev = '';
      let isOpen: boolean = false;

      const subscription = observable
        // .pipe(
        //   tap(() => console.log(prev, isOpen)),
        //   delay(20),
        // )
        .subscribe({
          next({ result, best }) {
            let info: string = '';

            const [upper, lower] = best;
            const hist = new Big(result);

            if (hist.gt(upper) && isOpen && (prev === 'DOWN' || prev === '')) {
              info = '平空';
              prev = 'UP';
              isOpen = false;
            } else if (
              hist.lt(lower) &&
              !isOpen &&
              (prev === 'UP' || prev === '')
            ) {
              info = '开多';
              prev = 'DOWN';
              isOpen = true;
            }

            if (!!info) {
              subscriber.next(info);
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
        subscription.unsubscribe();
        // Clean up all state.
        // console.log('做多清空状态');
      };
    });
};

// 做空 - 操作符
export const sellOperator = () => {
  return (observable: Observable<OperatorInterface>) =>
    new Observable<string>((subscriber: Subscriber<string>) => {
      let prev: Prev = '';
      let isOpen: boolean = false;

      const subscription = observable.subscribe({
        next({ result, best }) {
          let info: string = '';

          const [upper, lower] = best;
          const hist = new Big(result);

          if (hist.gt(upper) && !isOpen && (prev === 'DOWN' || prev === '')) {
            info = '开空';
            prev = 'UP';
            isOpen = true;
          } else if (
            hist.lt(lower) &&
            isOpen &&
            (prev === 'UP' || prev === '')
          ) {
            info = '平多';
            prev = 'DOWN';
            isOpen = false;
          }

          if (!!info) {
            subscriber.next(info);
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
        subscription.unsubscribe();
        // Clean up all state.
        // console.log('做空清空状态');
      };
    });
};
