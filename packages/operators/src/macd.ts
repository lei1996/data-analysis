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
} from '@data-analysis/core';
import { KLineBaseInterface } from '@data-analysis/types/kline.type';

export const makeSuObservable = (interval: number) => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<[KLineBaseInterface]>(
      (subscriber: Subscriber<[KLineBaseInterface]>) => {
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

        const mainSubscription = main$
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
          )
          .subscribe({
            next(item) {},
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
          mainSubscription.unsubscribe();
          Subscription1.unsubscribe();
          // Clean up all state.
          macdIndicator = null!;
          volumeIndicator = null!;
          adxIndicator = null!;
        };
      },
    );
};
