import {
  Big,
  BigSource,
  bufferCount,
  concatMap,
  defaultIfEmpty,
  defer,
  from,
  last,
  map,
  max,
  min,
  Observable,
  of,
  pipe,
  share,
  SMA,
  Subscriber,
  switchMap,
  tap,
  zip,
} from '@data-analysis/core';
import { divideEquallyRx } from '@data-analysis/core/src/divideEqually';
import { KLineBaseInterface } from '@data-analysis/types/kline.type';
import { getNowTime } from '@data-analysis/utils';
import { Business, HelperWrapper, Prev, ResultInterface, TPrev } from './base';
import { equalizerRxOperator, wareHouseRxOperator } from './core';
import { EqualizerRxInterface } from './types/equalizer.Rx';
import { OperatorInterface, OperatorResultInterface } from './types/rsi';

export const autoRsiExTestOperator = (
  maxLength: number,
  key: string,
  isDebug: boolean = false,
) => {
  return (observable: Observable<[KLineBaseInterface, BigSource, BigSource]>) =>
    new Observable<ResultInterface>(
      (subscriber: Subscriber<ResultInterface>) => {
        let buy = new Business();
        let sell = new Business();
        let count: number = 0;

        // 判断是否超过了初始化的参数
        const isComplete = (): boolean => {
          return isDebug || count > maxLength;
        };

        // 下单 fn 回调
        const orderFn = (item: ResultInterface) => {
          subscriber.next(item);
        };

        const main$ = observable.pipe(
          tap(([item, rsiResult, adxResult]) => {
            count++;
            if (isComplete()) {
              console.log(
                item,
                count,
                rsiResult.toString(),
                'k线 count 计数器',
              );
            }
          }),
          share(),
        );

        const share$ = main$.pipe(
          bufferCount(maxLength, 8), // 每间隔 1/3 k线发射一次值 第一次发射必须要填满 maxLength 根k线
          map((x) =>
            x.reduce(
              (curr, [item, rsiResult, adxResult]) => ({
                klines: [...curr.klines, item],
                maxminArrs: [...curr.maxminArrs, rsiResult],
                adxArrs: [...curr.maxminArrs, adxResult],
                maxVal: new Big(curr.maxVal).gt(rsiResult)
                  ? curr.maxVal
                  : rsiResult,
                minVal: new Big(curr.minVal).lt(rsiResult)
                  ? curr.minVal
                  : rsiResult,
              }),
              {
                klines: [] as KLineBaseInterface[],
                maxminArrs: [] as BigSource[],
                adxArrs: [] as BigSource[],
                maxVal: new Big(-9999999) as BigSource,
                minVal: new Big(9999999) as BigSource,
              },
            ),
          ),
          concatMap(({ klines, maxminArrs, adxArrs, maxVal, minVal }) => {
            return divideEquallyRx(minVal, maxVal, 10).pipe(
              concatMap((nums) => {
                const result = {
                  bests: [] as number[][],
                  maxminArrs,
                  adxArrs,
                  klines,
                };

                for (let i = 0; i < nums.length - 1; i++) {
                  for (let j = i + 1; j < nums.length; j++) {
                    result.bests.push([nums[i], nums[j]]);
                  }
                }

                return of(result);
              }),
            );
          }),
          share(),
        );

        const sourcePipe = (
          key: string,
          operator: businessType,
          best: Observable<number[]>,
        ) => {
          return pipe(
            switchMap(([item, rsiResult, adxResult]) =>
              best.pipe(
                switchMap((x) => of({ rsiResult, item, best: x, adxResult })),
              ),
            ),
            operator(), // 会有问题，这样传递fn
            concatMap(({ item, info, stop }) =>
              of({
                id: item.id.toString().length === 10 ? item.id * 1000 : item.id,
                date: getNowTime(
                  item.id.toString().length === 10 ? item.id * 1000 : item.id,
                ),
                info,
                key,
                _price: item.close,
                symbol: item.symbol,
                stop,
              } as ResultInterface),
            ),
          );
        };

        const helperWrapperPipe = (interval: number) => {
          return pipe(
            wareHouseRxOperator(interval),
            equalizerRxOperator(interval),
          );
        };

        const buySource$ = main$.pipe(
          // delayWhen((_) => interval(isComplete() ? 0 : isDebug ? 0 : 6 * 1000)),
          sourcePipe(
            `auto${key}Buy`,
            buyOperator,
            defer(() => of(buy.best)),
          ),
          share(),
        );
        const sellSource$ = main$.pipe(
          // delayWhen((_) => interval(isComplete() ? 0 : isDebug ? 0 : 6 * 1000)),
          sourcePipe(
            `auto${key}Sell`,
            sellOperator,
            defer(() => of(sell.best)),
          ),
          share(),
        );

        const buyIsLockSubscription = buySource$
          .pipe(helperWrapperPipe(2))
          .subscribe((x) => {
            console.log(
              `beforeSum: ${x.beforeSum.toString()}, aftersum: ${x.aftersum.toString()}, isLock: ${
                x.isLock
              }`,
            );
            buy.isLock = x.isLock;
          });

        const sellIsLockSubscription = sellSource$
          .pipe(helperWrapperPipe(2))
          .subscribe((x) => {
            console.log(
              `beforeSum: ${x.beforeSum.toString()}, aftersum: ${x.aftersum.toString()}, isLock: ${
                x.isLock
              }`,
            );
            sell.isLock = x.isLock;
          });

        const buySubscription = buySource$.subscribe({
          next(item) {
            if ((isComplete() && !buy.isLock) || item.info.includes('平')) {
              if (!buy.isOpen && item.info.includes('开')) {
                buy.isOpen = true;
                orderFn(item);
              } else if (buy.isOpen && item.info.includes('平')) {
                buy.isOpen = false;
                orderFn({
                  ...item,
                  // info: '平空',
                });
              }
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

        const sellSubscription = sellSource$.subscribe({
          next(item) {
            if ((isComplete() && !sell.isLock) || item.info.includes('平')) {
              if (!sell.isOpen && item.info.includes('开')) {
                sell.isOpen = true;
                orderFn(item);
              } else if (sell.isOpen && item.info.includes('平')) {
                sell.isOpen = false;
                orderFn({
                  ...item,
                  // info: '平多',
                });
              }
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

        const buyAutoBestSubscription = share$
          .pipe(autoRsiOperator(buyOperator, 2))
          .subscribe(([equalizerResult, best]) => {
            console.log(
              new Big(equalizerResult.beforeSum).round(8).toString(),
              new Big(equalizerResult.aftersum).round(8).toString(),
              buy.best,
              best,
              getNowTime(new Date().getTime()),
              `开多 auto ${key} Best`,
            );
            buy.best = best;
            buy.isLock = equalizerResult.isLock;
          });
        const sellAutoBestSubscription = share$
          .pipe(autoRsiOperator(sellOperator, 2))
          .subscribe(([equalizerResult, best]) => {
            console.log(
              new Big(equalizerResult.beforeSum).round(8).toString(),
              new Big(equalizerResult.aftersum).round(8).toString(),
              sell.best,
              best,
              getNowTime(new Date().getTime()),
              `开空 auto ${key} Best`,
            );
            sell.best = best;
            sell.isLock = equalizerResult.isLock;
          });

        return () => {
          console.log(`auto${key}Operator 清空状态`);

          // Clean up all state.
          buyIsLockSubscription.unsubscribe();
          buySubscription.unsubscribe();
          sellIsLockSubscription.unsubscribe();
          sellSubscription.unsubscribe();
          buyAutoBestSubscription.unsubscribe();
          sellAutoBestSubscription.unsubscribe();
        };
      },
    );
};

type businessType = typeof buyOperator | typeof sellOperator;

interface AutoInterface {
  bests: number[][];
  maxminArrs: BigSource[];
  adxArrs: BigSource[];
  klines: KLineBaseInterface[];
}

const autoRsiOperator = (operator: businessType, interval: number) => {
  return (observable: Observable<AutoInterface>) =>
    new Observable<[EqualizerRxInterface, number[]]>(
      (subscriber: Subscriber<[EqualizerRxInterface, number[]]>) => {
        const subscription = observable
          .pipe(
            concatMap(({ bests, maxminArrs, adxArrs, klines }) => {
              return from(bests).pipe(
                concatMap((best) => {
                  const last$ = zip(
                    from(klines),
                    from(maxminArrs),
                    from(adxArrs),
                  ).pipe(
                    concatMap(([item, rsiResult, adxResult]) => {
                      return of({ rsiResult, item, best, adxResult });
                    }),
                    operator(),
                    concatMap(({ item, info }) =>
                      of({
                        info,
                        _price: item.close,
                        symbol: item.symbol,
                      }),
                    ),
                    wareHouseRxOperator(interval),
                    equalizerRxOperator(interval),
                    defaultIfEmpty({
                      beforeSum: new Big(0),
                      aftersum: new Big(0),
                      isLock: true,
                    }),
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

export const buyOperator = () => {
  return (observable: Observable<OperatorInterface>) =>
    new Observable<OperatorResultInterface>(
      (subscriber: Subscriber<OperatorResultInterface>) => {
        let prev: TPrev = '';
        let base = new HelperWrapper();
        let send = new HelperWrapper();
        let diff = new SMA(7);

        const subscription = observable.subscribe({
          next({ rsiResult, adxResult, best, item }) {
            let info: string = '';

            const [upper, lower] = best;
            const adx = new Big(adxResult);
            const hist = new Big(rsiResult);

            diff.update(new Big(item.high).minus(item.low));

            if (hist.gt(upper) && (prev === 'LEFT' || prev === '')) {
              if (base.isOpen) {
                info = '平空';
                base.isOpen = false;
                base.prevOpenItem = item;
              }
              prev = 'TOP';
            } else if (hist.gt(lower) && (prev === 'BOTTOM' || prev === '')) {
              if (!base.isOpen) {
                info = '开多';
                base.isOpen = true;
              }
              prev = 'LEFT';
            } else if (
              hist.lt(lower) &&
              (prev === 'RIGHT' || prev === 'LEFT' || prev === '')
            ) {
              // if (base.isOpen) {
              //   info = '平多';
              //   base.isOpen = false;
              //   base.prevOpenItem = item;
              // }
              prev = 'BOTTOM';
            } else if (hist.lt(upper) && (prev === 'TOP' || prev === '')) {
              prev = 'RIGHT';
            }

            if (!!info) {
              if (
                !send.isOpen &&
                adx.gt(25) &&
                diff.isStable &&
                info.includes('开')
              ) {
                let stop = new Big(0);
                stop = new Big(item.close).minus(diff.getResult().times(4));
                subscriber.next({ item, info, stop: stop.toString() });
                send.prevOpenItem = item;
                send.isOpen = true;
              } else if (send.isOpen && info.includes('平')) {
                subscriber.next({ item, info });
                send.isOpen = false;
              }
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
          // console.log('buyOperator 清空状态');
          subscription.unsubscribe();
          // Clean up all state.
          base = null!;
          send = null!;
          diff = null!;
        };
      },
    );
};

export const sellOperator = () => {
  return (observable: Observable<OperatorInterface>) =>
    new Observable<OperatorResultInterface>(
      (subscriber: Subscriber<OperatorResultInterface>) => {
        let prev: TPrev = '';
        let base = new HelperWrapper();
        let send = new HelperWrapper();
        let diff = new SMA(7);

        const subscription = observable.subscribe({
          next({ rsiResult, adxResult, best, item }) {
            let info: string = '';

            const [upper, lower] = best;
            const adx = new Big(adxResult);
            const hist = new Big(rsiResult);

            diff.update(new Big(item.high).minus(item.low));

            if (
              hist.gt(upper) &&
              (prev === 'LEFT' || prev === 'RIGHT' || prev === '')
            ) {
              // if (base.isOpen) {
              //   info = '平空';
              //   base.isOpen = false;
              //   base.prevOpenItem = item;
              // }
              prev = 'TOP';
            } else if (hist.gt(lower) && (prev === 'BOTTOM' || prev === '')) {
              prev = 'LEFT';
            } else if (hist.lt(lower) && (prev === 'RIGHT' || prev === '')) {
              if (base.isOpen) {
                info = '平多';
                base.isOpen = false;
                base.prevOpenItem = item;
              }
              prev = 'BOTTOM';
            } else if (hist.lt(upper) && (prev === 'TOP' || prev === '')) {
              if (!base.isOpen) {
                info = '开空';
                base.isOpen = true;
              }
              prev = 'RIGHT';
            }

            if (!!info) {
              if (
                !send.isOpen &&
                adx.gt(25) &&
                diff.isStable &&
                info.includes('开')
              ) {
                let stop = new Big(0);
                stop = new Big(item.close).plus(diff.getResult().times(4));
                subscriber.next({ item, info, stop: stop.toString() });
                send.prevOpenItem = item;
                send.isOpen = true;
              } else if (send.isOpen && info.includes('平')) {
                subscriber.next({ item, info });
                send.isOpen = false;
              }
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
          // console.log('sellOperator 清空状态');
          subscription.unsubscribe();
          // Clean up all state.
          base = null!;
          send = null!;
          diff = null!;
        };
      },
    );
};
