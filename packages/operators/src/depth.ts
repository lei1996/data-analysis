// 分层
//     先推入数据，计算macd值，这里计算的值是公共的，有值推入到下一个class类。
//     推入进来的时候开始计算最大最小值。
//     初始化为0，0 第8根k线的时候开始动态计算最佳值，中途没有完成计算有新值推入进来，舍弃。
//     每个子任务 延迟 1.5秒推入。
//     这里用的数组是外面那个最大的数组，240 maxLength， 计算的时候需要 slice() 数组.
import {
  MACD,
  EMA,
  Big,
  BigSource,
  concatMap,
  of,
  MACDConfig,
  Observable,
  Subscriber,
  share,
  pipe,
  switchMap,
  bufferCount,
  map,
  MACDResult,
} from '@data-analysis/core';
import { getNowTime } from '@data-analysis/utils';
import { BuyOperatorInterface, OperatorResultInterface } from './types/depth';
import { FtxTickerResultInterface } from './types/depth';

type MacdFactory = (config: MACDConfig) => MACD;

const defaultMacdFactory: MacdFactory = (config: MACDConfig) =>
  new MACD(config);

export const makeMacdObservable = (macdParam: number[]) => {
  return (observable: Observable<FtxTickerResultInterface>) =>
    new Observable<[FtxTickerResultInterface, MACDResult]>(
      (subscriber: Subscriber<[FtxTickerResultInterface, MACDResult]>) => {
        const [shortInterval, longInterval, signalInterval] = macdParam;
        // 之后这里改成多态的方式就动态传递一个工厂类
        let indicator = defaultMacdFactory({
          indicator: EMA,
          shortInterval: shortInterval,
          longInterval: longInterval,
          signalInterval: signalInterval,
        });

        const subscription = observable.subscribe({
          next(item) {
            const { last } = item;

            indicator.update(last);

            if (indicator.isStable) {
              const macdResult = indicator.getResult();
              subscriber.next([item, macdResult]);
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
          console.log('makeMacdObservable 清空状态');
          subscription.unsubscribe();
          // Clean up all state.
          indicator = null!;
        };
      },
    );
};

export const macdOperator = (maxLength: number) => {
  return (observable: Observable<[FtxTickerResultInterface, MACDResult]>) =>
    new Observable<OperatorResultInterface>(
      (subscriber: Subscriber<OperatorResultInterface>) => {
        let buy = new Business();
        let sell = new Business();
        let isLock: Boolean = false;

        const orderFn = (item: OperatorResultInterface) => {
          if (!isLock) {
            subscriber.next(item);
          }
        }

        const main$ = observable.pipe(share());

        const sourcePipe = (operator: businessType, best: number[]) => {
          return pipe(
            switchMap(([item, macdResult]) =>
              of({
                histogram: (macdResult as MACDResult).histogram,
                item,
                best,
              }),
            ),
            operator(), // 会有问题，这样传递fn
          );
        };

        const buySource$ = main$.pipe(
          sourcePipe(buyOperator, buy.best),
          share(),
        );
        const sellSource$ = main$.pipe(
          sourcePipe(sellOperator, sell.best),
          share(),
        );

        const buySubscription = buySource$.subscribe({
          next(item) {
            orderFn(item);
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
            orderFn(item);
          },
          error(err) {
            // We need to make sure we're propagating our errors through.
            subscriber.error(err);
          },
          complete() {
            subscriber.complete();
          },
        });

        const isLockSubscription = main$
          .pipe(
            bufferCount(maxLength, 1),
            map((x) =>
              x.reduce(
                (curr, next) => ({
                  maxVal: new Big(curr.maxVal).gt(next[1].macd)
                    ? curr.maxVal
                    : next[1].macd,
                  minVal: new Big(curr.minVal).lt(next[1].macd)
                    ? curr.minVal
                    : next[1].macd,
                  lastVal: new Big(next[1].macd),
                }),
                {
                  maxVal: new Big(-9999999) as BigSource,
                  minVal: new Big(9999999) as BigSource,
                  lastVal: new Big(0) as BigSource,
                },
              ),
            ),
          )
          .subscribe((x) => {
            if (
              new Big(x.lastVal).lt(0) &&
              new Big(x.lastVal).div(x.minVal).abs().gt(0.5)
            ) {
              isLock = false;
            } else if (
              new Big(x.lastVal).gt(0) &&
              new Big(x.lastVal).div(x.maxVal).abs().gt(0.5)
            ) {
              isLock = false;
            }
            isLock = true;
          });

        return () => {
          console.log('macdOperator 清空状态');

          // Clean up all state.
          buySubscription.unsubscribe();
          sellSubscription.unsubscribe();
          isLockSubscription.unsubscribe();
        };
      },
    );
};

export type businessType = typeof buyOperator | typeof sellOperator;

export const buyOperator = () => {
  return (observable: Observable<BuyOperatorInterface>) =>
    new Observable<OperatorResultInterface>(
      (subscriber: Subscriber<OperatorResultInterface>) => {
        let prev: Prev = '';
        let base = new HelperWrapper();

        const subscription = observable.subscribe({
          next({ histogram, best, item }) {
            let info: string = '';

            const [upper, lower] = best;
            const hist = new Big(histogram);

            if (
              hist.gt(upper) &&
              base.isOpen &&
              (prev === 'DOWN' || prev === '')
            ) {
              info = '平空';
              base.isOpen = false;
              prev = 'UP';
            } else if (
              hist.lt(lower) &&
              !base.isOpen &&
              (prev === 'UP' || prev === '')
            ) {
              info = '开多';
              base.isOpen = true;
              prev = 'DOWN';
            }

            if (!!info) {
              subscriber.next({ item, info });
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

        const subscription = observable.subscribe({
          next({ histogram, best, item }) {
            let info: string = '';

            const [upper, lower] = best;
            const hist = new Big(histogram);

            if (
              hist.gt(upper) &&
              base.isOpen &&
              (prev === 'DOWN' || prev === '')
            ) {
              info = '平多';
              base.isOpen = false;
              prev = 'UP';
            } else if (
              hist.lt(lower) &&
              !base.isOpen &&
              (prev === 'UP' || prev === '')
            ) {
              info = '开空';
              base.isOpen = true;
              prev = 'DOWN';
            }

            if (!!info) {
              subscriber.next({ item, info });
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

type Prev = '' | 'UP' | 'DOWN';

export class Business {
  private _best: number[] = [0, 0];
  private _isLock: boolean = true;
  private _isOpen: boolean = false;

  public get best() {
    return this._best;
  }

  public set best(best: number[]) {
    if (best.length != 2) {
      throw new Error('The best is invalid');
    }
    this._best = best;
  }

  public get isLock() {
    return this._isLock;
  }

  public set isLock(isLock: boolean) {
    this._isLock = isLock;
  }

  public get isOpen() {
    return this._isOpen;
  }

  public set isOpen(isOpen: boolean) {
    this._isOpen = isOpen;
  }
}

export class HelperWrapper {
  private _sum: Big = new Big(0);
  private _isOpen: boolean = false;

  public get sum() {
    return this._sum;
  }

  public set sum(sum: BigSource) {
    this._sum = this._sum.plus(sum);
  }

  public get isOpen() {
    return this._isOpen;
  }

  public set isOpen(isOpen: boolean) {
    this._isOpen = isOpen;
  }
}
