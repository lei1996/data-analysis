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
} from '@data-analysis/core';
import { KLineBaseInterface } from '@data-analysis/types/kline.type';
import { Prev } from './base';
import { OperatorInterface } from './types/macd';

export const makeSuObservable = (interval: number) => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<string>(
      (subscriber: Subscriber<string>) => {
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

        const share$ = main$
          .pipe(
            concatMap((item) => {
              const { close } = item;

              macdIndicator.update(close);

              if (macdIndicator.isStable) {
                const { histogram } = macdIndicator.getResult();
                return of(histogram);
              }
              return of();
            }),
            share()
          );

        const buySubscription = share$
          .pipe(
            concatMap((x) => of({result: x, best: [10, 0]})),
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
      },
    );
};

// 做多 - 操作符
export const buyOperator = () => {
  return (observable: Observable<OperatorInterface>) =>
    new Observable<string>((subscriber: Subscriber<string>) => {
      let prev: Prev = '';

      const subscription = observable.subscribe({
        next({ result, best }) {
          let info: string = '';

          const [upper, lower] = best;
          const hist = new Big(result);

          if (hist.gt(upper) && (prev === 'DOWN' || prev === '')) {
            info = '平空';
            prev = 'UP';
          } else if (hist.lt(lower) && (prev === 'UP' || prev === '')) {
            info = '开多';
            prev = 'DOWN';
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

      const subscription = observable.subscribe({
        next({ result, best }) {
          let info: string = '';

          const [upper, lower] = best;
          const hist = new Big(result);

          if (hist.gt(upper) && (prev === 'DOWN' || prev === '')) {
            info = '开空';
            prev = 'UP';
          } else if (hist.lt(lower) && (prev === 'UP' || prev === '')) {
            info = '平多';
            prev = 'DOWN';
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
