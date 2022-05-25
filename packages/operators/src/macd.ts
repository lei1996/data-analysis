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
} from '@data-analysis/core';
import { KLineBaseInterface } from '@data-analysis/types/kline.type';
import { Prev } from './base';
import { equalizerRxOperator, orderHubRxOperator } from './core';
import { EqualizerRxInterface } from './types/equalizer.Rx';
import { OperatorInterface } from './types/macd';

type OperatorType = typeof buyOperator | typeof sellOperator;

// 查找最优解 入参
interface AutoBestInterface {
  bests: number[][]; // 上界 和 下界  -> [10, -5]
  maxminArrs: BigSource[]; // macd 指标缓存
  klines: KLineBaseInterface[]; // kLine 缓存
}

export const makeSuObservable = (interval: number) => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<string>((subscriber: Subscriber<string>) => {
      let macdIndicator = new MACD({
        indicator: EMA,
        shortInterval: 6,
        longInterval: 13,
        signalInterval: 4,
      });
      let volumeIndicator = new RSI(interval); // 量的 RSI 值
      let adxIndicator = new ADX(interval); // 当前趋势 值

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

          macdIndicator.update(close);

          if (macdIndicator.isStable) {
            const { histogram } = macdIndicator.getResult();
            return of(histogram);
          }
          return of();
        }),
        share(),
      );

      const buySubscription = share$
        .pipe(
          concatMap((x) => of({ result: x, best: [10, 0] })),
          buyOperator(),
        )
        .subscribe({
          next(item) {
            console.log('多头', item);
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
        console.log('makeSuObservable 清空状态');
        buySubscription.unsubscribe();
        Subscription1.unsubscribe();
        // Clean up all state.
        macdIndicator = null!;
        volumeIndicator = null!;
        adxIndicator = null!;
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
                        symbol: kline.symbol,
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

      const subscription = observable.subscribe({
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
      };
    });
};
