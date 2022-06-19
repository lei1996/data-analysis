import {
  Big,
  Observable,
  Subscriber,
} from '@data-analysis/core';
import { OrderElementInterface } from '@data-analysis/types/order.type';
import { WareHouseRxInterface } from '../types/wareHouse.Rx';

export const orderHubRxOperator = (queueLength: number) => {
  return (observable: Observable<OrderElementInterface>) =>
    new Observable<WareHouseRxInterface>(
      (subscriber: Subscriber<WareHouseRxInterface>) => {
        let order = {
          sum: new Big(0),
          prev: new Big(0),
        };

        const subscription = observable.subscribe({
          next(item) {
            const { _price, info } = item;

            if (info.includes('开')) {
              order.prev = new Big(_price);
            } else if (info.includes('平')) {
              const diffPrice =
                info === '平空'
                  ? new Big(_price).minus(order.prev)
                  : new Big(order.prev).minus(new Big(_price));

              order.sum = order.sum.plus(diffPrice);
              subscriber.next({ sum: order.sum, lastDiff: diffPrice });
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
          // console.log('wareHouseRx 清空所有operator状态');
          // Clean up all state.
          subscription.unsubscribe();
          order = null!;
        };
      },
    );
};
