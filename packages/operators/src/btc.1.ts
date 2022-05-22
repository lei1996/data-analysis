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
  from,
  concatMap,
  of,
  zip,
  max,
  last,
  MACDConfig,
  Observable,
  Subscriber,
  share,
  bufferCount,
  map,
  filter,
  defer,
  tap,
  pipe,
  defaultIfEmpty,
  delayWhen,
  interval,
  RSI,
  switchMap,
  SMA,
} from '@data-analysis/core';
import { divideEquallyRx } from '@data-analysis/core/src/divideEqually';
import { KLineBaseInterface } from '@data-analysis/types/kline.type';
import { getNowTime } from '@data-analysis/utils';
import { equalizerRxOperator, wareHouseRxOperator } from './core';
import { BuyOperatorInterface, OperatorResultInterface } from './types/macd';
import { EqualizerRxInterface } from './types/equalizer.Rx';

type MacdFactory = (config: MACDConfig) => MACD;

const defaultMacdFactory: MacdFactory = (config: MACDConfig) =>
  new MACD(config);

type infoType = '开多' | '开空' | '平多' | '平空';

export const makeMacdObservable = (macdParam: number[]) => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<[KLineBaseInterface, BigSource]>(
      (subscriber: Subscriber<[KLineBaseInterface, BigSource]>) => {
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
            const { close, volume } = item;
            // console.log(item, 'k线数据 -');

            indicator.update(close);

            if (indicator.isStable) {
              const { histogram } = indicator.getResult();
              subscriber.next([item, histogram]);
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

export interface MacdResultInterface {
  id: string;
  info: infoType;
  _price: BigSource;
  symbol: string;
}

export interface macdOperatorSettingsInterface {
  isAllowOpen: number;
  rsiNumber: number;
  helperWrapperPipe: number;
}

export const macdOperator = (
  maxLength: number,
  settings: macdOperatorSettingsInterface = {
    isAllowOpen: 2,
    rsiNumber: 56,
    helperWrapperPipe: 3,
  },
  isDebug: boolean = false,
) => {
  return (observable: Observable<[KLineBaseInterface, BigSource]>) =>
    new Observable<MacdResultInterface>(
      (subscriber: Subscriber<MacdResultInterface>) => {
        let buy = new Business();
        let sell = new Business();
        let count: number = 0;
        // let isAllowOpen: number = 0;

        // 判断是否超过了初始化的参数
        const isComplete = (): boolean => {
          return isDebug || count > maxLength;
        };

        // 下单 fn 回调
        const orderFn = (item: MacdResultInterface) => {
          if (isComplete()) {
            subscriber.next(item);
          }
          // isAllowOpen--;
        };

        const main$ = observable.pipe(
          tap(([item]) => {
            count++;
            if (isComplete()) {
              console.log(
                item,
                count,
                // isAllowOpen,
                'k线 count isAllowOpen 计数器',
              );
            }
          }),
          share(),
        );

        const sourcePipe = (operator: businessType, best: number[]) => {
          return pipe(
            switchMap(([item, histogram]) => {
              return of({ histogram, item, best });
            }),
            operator(settings.helperWrapperPipe), // 会有问题，这样传递fn
            concatMap(({ item, info }) =>
              of({
                id: getNowTime(
                  item.id.toString().length === 10 ? item.id * 1000 : item.id,
                ),
                info,
                _price: item.close,
                symbol: item.symbol,
              } as MacdResultInterface),
            ),
          );
        };

        const buySubscription = main$
          .pipe(
            sourcePipe(buyOperator, buy.best),
            tap((x) => console.log(x, '开仓信息')),
          )
          .subscribe({
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

        const sellSubscription = main$
          .pipe(sourcePipe(sellOperator, sell.best))
          .subscribe({
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

        return () => {
          console.log('macdOperator 清空状态');

          buySubscription.unsubscribe();
          sellSubscription.unsubscribe();
          // Clean up all state.
        };
      },
    );
};

export type businessType = typeof buyOperator | typeof sellOperator;

export const buyOperator = (interval: number) => {
  return (observable: Observable<BuyOperatorInterface>) =>
    new Observable<OperatorResultInterface>(
      (subscriber: Subscriber<OperatorResultInterface>) => {
        let prev: Prev = '';
        let base = new HelperWrapper();
        let baseProfit = new SMA(interval);
        let send = new HelperWrapper();
        let macdProfit = new HelperWrapper();
        let macdIndicator = new MACD({
          indicator: EMA,
          shortInterval: 6,
          longInterval: 13,
          signalInterval: 4,
        });

        const subscription = observable.subscribe({
          next({ histogram, best, item }) {
            let info: string = '';

            // console.log(best, prev, 'best 查看是否会改变');

            const [upper, lower] = best;
            const hist = new Big(histogram);

            if (
              hist.gt(upper) &&
              !base.isOpen &&
              (prev === 'DOWN' || prev === '')
            ) {
              info = '开多';
              base.prevOpenItem = item;
              base.isOpen = true;
              prev = 'UP';
            } else if (
              hist.lt(lower) &&
              base.isOpen &&
              (prev === 'UP' || prev === '')
            ) {
              info = '平空';
              base.sum = new Big(item.close).minus(base.prevOpenItem.close);
              baseProfit.update(
                new Big(item.close).minus(base.prevOpenItem.close),
              );
              base.isOpen = false;
              prev = 'DOWN';
            }

            if (!!info && baseProfit.isStable) {
              if (
                baseProfit.getResult().lt(0) &&
                info.includes('开') &&
                !send.isOpen
              ) {
                // subscriber.next({ item, info });
                send.prevOpenItem = item;
                send.isOpen = true;
              }
              if (baseProfit.getResult().gte(0) && send.isOpen) {
                // subscriber.next({ item, info: '平空' });
                send.sum = new Big(item.close).minus(send.prevOpenItem.close);
                macdIndicator.update(send.sum);
                send.isOpen = false;
              }
              if (
                info.includes('平') &&
                new Big(item.close).lt(send.prevOpenItem.close) &&
                send.isOpen
              ) {
                // subscriber.next({ item, info: '平空' });
                send.sum = new Big(item.close).minus(send.prevOpenItem.close);
                macdIndicator.update(send.sum);
                send.isOpen = false;
              }
              // 这里要添加一个 止损 当前close lt 上一次开仓close - (high + low) * 2

              if (macdIndicator.isStable) {
                const { histogram } = macdIndicator.getResult();
                if (histogram.gt(0)) {
                  if (!macdProfit.isOpen && info.includes('开')) {
                    subscriber.next({ item, info });
                    macdProfit.prevOpenItem = item;
                    macdProfit.isOpen = true;
                  } else if (macdProfit.isOpen && info.includes('平')) {
                    subscriber.next({ item, info });
                    macdProfit.isOpen = false;
                  }
                }

                if (
                  macdProfit.isOpen &&
                  new Big(macdProfit.prevOpenItem.close)
                    .minus(
                      new Big(macdProfit.prevOpenItem.high)
                        .minus(macdProfit.prevOpenItem.low)
                        .times(1.5),
                    )
                    .gt(item.close)
                ) {
                  subscriber.next({ item, info: '平空' });
                  macdProfit.isOpen = false;
                }
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
          baseProfit = null!;
          send = null!;
          macdProfit = null!;
          macdIndicator = null!;
        };
      },
    );
};

export const sellOperator = (interval: number) => {
  return (observable: Observable<BuyOperatorInterface>) =>
    new Observable<OperatorResultInterface>(
      (subscriber: Subscriber<OperatorResultInterface>) => {
        let prev: Prev = '';
        let base = new HelperWrapper();
        let baseProfit = new SMA(interval);
        let send = new HelperWrapper();
        let macdProfit = new HelperWrapper();
        let macdIndicator = new MACD({
          indicator: EMA,
          shortInterval: 6,
          longInterval: 13,
          signalInterval: 4,
        });

        const subscription = observable.subscribe({
          next({ histogram, best, item }) {
            let info: string = '';

            // console.log(best, prev, 'best 查看是否会改变');

            const [upper, lower] = best;
            const hist = new Big(histogram);

            if (
              hist.gt(upper) &&
              base.isOpen &&
              (prev === 'DOWN' || prev === '')
            ) {
              info = '平多';
              base.sum = new Big(base.prevOpenItem.close).minus(item.close);
              baseProfit.update(
                new Big(base.prevOpenItem.close).minus(item.close),
              );
              base.isOpen = false;
              prev = 'UP';
            } else if (
              hist.lt(lower) &&
              !base.isOpen &&
              (prev === 'UP' || prev === '')
            ) {
              info = '开空';
              base.prevOpenItem = item;
              base.isOpen = true;
              prev = 'DOWN';
            }

            if (!!info && baseProfit.isStable) {
              
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
  private _prevOpenItem: KLineBaseInterface = {
    symbol: '',
    id: 0,
    open: 0,
    close: 0,
    high: 0,
    low: 0,
    volume: 0,
  };
  private _sum: Big = new Big(0);
  private _isOpen: boolean = false;

  public get prevOpenItem() {
    return this._prevOpenItem;
  }

  public set prevOpenItem(item: KLineBaseInterface) {
    // if (prev.length != 2) {
    //   throw new Error('The best is invalid');
    // }
    this._prevOpenItem = item;
  }

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
