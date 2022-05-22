import {
  MACD,
  EMA,
  Observable,
  Subscriber,
  ADX,
  BigSource,
} from '@data-analysis/core';
import { KLineBaseInterface } from '@data-analysis/types/kline.type';

export const autoSelectionOperator = (
  adxLength: number = 14,
  macdParam: number[],
) => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<[BigSource, BigSource]>(
      (subscriber: Subscriber<[BigSource, BigSource]>) => {
        const [shortInterval, longInterval, signalInterval] = macdParam;

        let adxIndicator = new ADX(adxLength);
        let macdIndicator = new MACD({
          indicator: EMA,
          shortInterval: shortInterval,
          longInterval: longInterval,
          signalInterval: signalInterval,
        });

        const subscription = observable.subscribe({
          next(item) {
            const { high, low, close } = item;
            // console.log(item, 'k线数据 -');

            adxIndicator.update({
              high,
              low,
              close,
            });

            macdIndicator.update(close);

            if (adxIndicator.isStable && macdIndicator.isStable) {
              // console.log(adxIndicator.getResult().round(8).toString(), macdIndicator.getResult().histogram.round(8).toString(), 'adx');
              // console.log(item, 'k线数据 -');

              subscriber.next([
                adxIndicator.getResult().round(8),
                macdIndicator.getResult().histogram.round(8),
              ]);
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
          adxIndicator = null!;
          macdIndicator = null!;
        };
      },
    );
};
