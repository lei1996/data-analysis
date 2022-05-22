import {
  Big,
  filter,
  Observable,
  partition,
  share,
  Subscriber,
} from '@data-analysis/core';

import { OrderElementInterface } from '@data-analysis/types/order.type';
import { BigSourceQueue } from '@data-analysis/core';
import { WareHouseRxInterface } from '../types/wareHouse.Rx';
import { Order } from '@data-analysis/core/src/order';

export const wareHouseRxOperator = (queueLength: number) => {
  return (observable: Observable<OrderElementInterface>) =>
    new Observable<WareHouseRxInterface>(
      (subscriber: Subscriber<WareHouseRxInterface>) => {
        let order: Order = new Order(3);
        let result: BigSourceQueue = new BigSourceQueue(queueLength);

        const subscription = observable.subscribe({
          next(item) {
            const { _price, info } = item;

            if (info.includes('开')) {
              order.open({
                price: _price,
                quantity: 2 * order.orderList.length + 1,
              });
            } else if (info.includes('平')) {
              const avgPrice = order.avgPrice();

              if (avgPrice.eq(0)) {
                return;
              }

              order.close();

              const diffPrice =
                info === '平空'
                  ? new Big(_price).minus(avgPrice)
                  : new Big(avgPrice).minus(new Big(_price));

              result.push(diffPrice);
              subscriber.next({ sum: result.sum, lastDiff: diffPrice });
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
          result = null!;
          order = null!;
        };
      },
    );
};
