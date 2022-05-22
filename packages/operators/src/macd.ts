import {
  SMA,
  Big,
  Observable,
  Subscriber,
  tap,
  share,
  pipe,
  switchMap,
  of,
  concatMap,
  MACDResult,
} from '@data-analysis/core';
import { KLineBaseInterface } from '@data-analysis/types/kline.type';
import { getNowTime } from '@data-analysis/utils';
import { Business, HelperWrapper, Prev, ResultInterface } from './base';
import { equalizerRxOperator, wareHouseRxOperator } from './core';
import { BuyOperatorInterface, OperatorResultInterface } from './types/macd';

export const autoMacdExTestOperator = (
  key: string,
  isDebug: boolean = false,
) => {
  return (observable: Observable<[KLineBaseInterface, MACDResult]>) =>
    new Observable<ResultInterface>(
      (subscriber: Subscriber<ResultInterface>) => {
        let buy = new Business();
        let sell = new Business();

        // 下单 fn 回调
        const orderFn = (item: ResultInterface) => {
          subscriber.next(item);
        };

        const main$ = observable.pipe(
          tap(([item, { histogram }]) => {
            console.log(
              item,
              histogram.round(2).toString(),
              'k线 count 计数器',
            );
          }),
          share(),
        );

        const sourcePipe = (
          key: string,
          operator: businessType,
          best: number[],
        ) => {
          return pipe(
            switchMap(([item, result]) =>
              of({ histogram: result.histogram, item, best }),
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

        const buySource$ = main$.pipe(
          // delayWhen((_) => interval(isComplete() ? 0 : isDebug ? 0 : 6 * 1000)),
          sourcePipe(`auto${key}Buy`, buyOperator, buy.best),
          share(),
        );
        const sellSource$ = main$.pipe(
          // delayWhen((_) => interval(isComplete() ? 0 : isDebug ? 0 : 6 * 1000)),
          sourcePipe(`auto${key}Sell`, sellOperator, sell.best),
          share(),
        );

        const buySubscription = buySource$.subscribe({
          next(item) {
            // if (!buy.isLock || item.info.includes('平')) {
            //   if (!buy.isOpen && item.info.includes('开')) {
            //     buy.isOpen = true;
            orderFn(item);
            //   } else if (buy.isOpen && item.info.includes('平')) {
            //     buy.isOpen = false;
            //     orderFn({
            //       ...item,
            //       // info: '平空',
            //     });
            //   }
            // }
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
            // if (!sell.isLock || item.info.includes('平')) {
            //   if (!sell.isOpen && item.info.includes('开')) {
            //     sell.isOpen = true;
            orderFn(item);
            // } else if (sell.isOpen && item.info.includes('平')) {
            //   sell.isOpen = false;
            //   orderFn({
            //     ...item,
            //     // info: '平多',
            //   });
            // }
            // }
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
          console.log(`auto${key}Operator 清空状态`);

          // Clean up all state.
          buySubscription.unsubscribe();
          sellSubscription.unsubscribe();
        };
      },
    );
};

type businessType = typeof buyOperator | typeof sellOperator;

export const buyOperator = () => {
  return (observable: Observable<BuyOperatorInterface>) =>
    new Observable<OperatorResultInterface>(
      (subscriber: Subscriber<OperatorResultInterface>) => {
        let prev: Prev = '';
        let base = new HelperWrapper();
        let send = new HelperWrapper();
        let ma5 = new SMA(5);
        let diff = new SMA(7);
        let isLock: boolean = false;

        const subscription = observable.subscribe({
          next({ histogram, best, item }) {
            let info: string = '';

            // console.log(best, prev, 'best 查看是否会改变');

            const [upper, lower] = best;
            const hist = new Big(histogram);
            diff.update(new Big(item.high).minus(item.low));
            ma5.update(item.close);

            if (
              hist.lt(upper) &&
              base.isOpen &&
              (prev === 'UP' || prev === '')
            ) {
              info = '平空';
              base.isOpen = false;
              prev = 'DOWN';
            }
            if (
              hist.gt(lower) &&
              !base.isOpen &&
              (prev === 'DOWN' || prev === '')
            ) {
              info = '开多';
              base.isOpen = true;
              base.prevOpenItem = item;
              prev = 'UP';
            }

            if (ma5.isStable) {
              if (ma5.getResult().gt(item.close)) {
                isLock = true;
              } else {
                isLock = false;
              }
            }

            if (!!info) {
              if (!send.isOpen && !isLock && diff.isStable && info.includes('开')) {
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
          // console.log('sellOperator 清空状态');
          subscription.unsubscribe();
          // Clean up all state.
        };
      },
    );
};

export const sellOperator = () => {
  return (observable: Observable<BuyOperatorInterface>) =>
    new Observable<OperatorResultInterface>(
      (subscriber: Subscriber<OperatorResultInterface>) => {
        let prev: Prev = '';
        let base = new HelperWrapper();
        let send = new HelperWrapper();
        let ma5 = new SMA(5);
        let diff = new SMA(7);
        let isLock: boolean = false;

        const subscription = observable.subscribe({
          next({ histogram, best, item }) {
            let info: string = '';

            // console.log(best, prev, 'best 查看是否会改变');

            const [upper, lower] = best;
            const hist = new Big(histogram);
            diff.update(new Big(item.high).minus(item.low));
            ma5.update(item.close);

            if (
              hist.lt(upper) &&
              !base.isOpen &&
              (prev === 'UP' || prev === '')
            ) {
              info = '开空';
              base.isOpen = true;
              base.prevOpenItem = item;
              prev = 'DOWN';
            }
            if (
              hist.gt(lower) &&
              base.isOpen &&
              (prev === 'DOWN' || prev === '')
            ) {
              info = '平多';
              base.isOpen = false;
              prev = 'UP';
            }

            if (ma5.isStable) {
              if (ma5.getResult().gt(item.close)) {
                isLock = false;
              } else {
                isLock = true;
              }
            }

            if (!!info) {
              if (!send.isOpen && !isLock && diff.isStable && info.includes('开')) {
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
        };
      },
    );
};
