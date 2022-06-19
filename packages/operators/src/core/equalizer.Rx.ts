import { Big, SMA, Observable, Subscriber } from '@data-analysis/core';

import { EqualizerRxInterface } from '../types/equalizer.Rx';
import { WareHouseRxInterface } from '../types/wareHouse.Rx';

export const equalizerRxOperator = (interval: number) => {
  return (observable: Observable<WareHouseRxInterface>) =>
    new Observable<EqualizerRxInterface>(
      (subscriber: Subscriber<EqualizerRxInterface>) => {
        let indicator: SMA = new SMA(interval);
        let result: EqualizerRxInterface = {
          beforeSum: new Big(0), // 修正前的累加值
          aftersum: new Big(0), // 修正后的累加值
          isLock: true,
        };

        const openSubscription = observable.subscribe({
          next(item) {
            const { sum, lastDiff } = item;

            indicator.update(sum);

            if (indicator.isStable) {
              const num = indicator.getResult();

              // 当上锁的状态不进行累加操作，
              if (!result.isLock) {
                result.aftersum = new Big(result.aftersum).plus(lastDiff);
              }

              // 修正前的数值 累加和
              result.beforeSum = new Big(result.beforeSum).plus(lastDiff);

              // interval 根收益均值小于最新收益总值 表明当前策略执行不乐观，需要锁定实盘开仓
              if (num.lt(0)) {
                result.isLock = true;
              } else {
                result.isLock = false;
              }

              subscriber.next(result);
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
          // console.log('equalizerRxOperator 清空所有operator状态');
          // Clean up all state.
          openSubscription.unsubscribe();
          indicator = null!;
          result = null!;
        };
      },
    );
};
