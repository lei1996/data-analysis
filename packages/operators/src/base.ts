import {
  MACD,
  EMA,
  MACDConfig,
  Observable,
  Subscriber,
  MACDResult,
  BigSource,
  Big,
  RSI,
  ADX,
  MOM,
  share,
} from '@data-analysis/core';
import { KLineBaseInterface } from '@data-analysis/types/kline.type';

type MacdFactory = (config: MACDConfig) => MACD;

const defaultMacdFactory: MacdFactory = (config: MACDConfig) =>
  new MACD(config);

export const makeMacdObservable = (macdParam: number[]) => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<[KLineBaseInterface, MACDResult]>(
      (subscriber: Subscriber<[KLineBaseInterface, MACDResult]>) => {
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
            const { close } = item;

            indicator.update(close);

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

export const makeMacdExObservable = (interval: number, macdParam: number[]) => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<[KLineBaseInterface, BigSource, BigSource]>(
      (subscriber: Subscriber<[KLineBaseInterface, BigSource, BigSource]>) => {
        const [shortInterval, longInterval, signalInterval] = macdParam;
        // 之后这里改成多态的方式就动态传递一个工厂类
        let indicator = defaultMacdFactory({
          indicator: EMA,
          shortInterval: shortInterval,
          longInterval: longInterval,
          signalInterval: signalInterval,
        });
        let adxIndicator = new ADX(interval);

        const subscription = observable.subscribe({
          next(item) {
            const { high, low, close } = item;

            indicator.update(close);
            adxIndicator.update({ close, high, low });

            if (indicator.isStable && adxIndicator.isStable) {
              const { histogram: result } = indicator.getResult();
              const adxResult = adxIndicator.getResult();
              subscriber.next([item, result, adxResult]);
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

export const makeMomExObservable = (interval: number) => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<[KLineBaseInterface, BigSource, BigSource]>(
      (subscriber: Subscriber<[KLineBaseInterface, BigSource, BigSource]>) => {
        // 之后这里改成多态的方式就动态传递一个工厂类
        let indicator = new MOM(interval);
        let adxIndicator = new ADX(interval);

        const subscription = observable.subscribe({
          next(item) {
            const { high, low, close } = item;

            indicator.update(close);
            adxIndicator.update({ close, high, low });

            if (indicator.isStable && adxIndicator.isStable) {
              const result = indicator.getResult();
              const adxResult = adxIndicator.getResult();
              subscriber.next([item, result, adxResult]);
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
          console.log('makeMomObservable 清空状态');
          subscription.unsubscribe();
          // Clean up all state.
          indicator = null!;
        };
      },
    );
};

export const makeRsiObservable = (interval: number) => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<[KLineBaseInterface, BigSource, BigSource]>(
      (subscriber: Subscriber<[KLineBaseInterface, BigSource, BigSource]>) => {
        let indicator = new RSI(interval);
        let adxIndicator = new ADX(interval);

        const subscription = observable.subscribe({
          next(item) {
            const { high, low, close } = item;

            indicator.update(close);
            adxIndicator.update({ close, high, low });

            if (indicator.isStable && adxIndicator.isStable) {
              const result = indicator.getResult();
              const adxResult = adxIndicator.getResult();
              subscriber.next([item, result, adxResult]);
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
          console.log('makeRsiObservable 清空状态');
          subscription.unsubscribe();
          // Clean up all state.
          indicator = null!;
        };
      },
    );
};

export const makeSuObservable = (interval: number) => {
  return (observable: Observable<KLineBaseInterface>) =>
    new Observable<[KLineBaseInterface, BigSource]>(
      (subscriber: Subscriber<[KLineBaseInterface, BigSource]>) => {
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

        const mainSubscription = main$.subscribe({
          next(item) {
            const { close } = item;

            macdIndicator.update(close);
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

export type Prev = '' | 'UP' | 'DOWN';
export type TPrev = '' | 'LEFT' | 'TOP' | 'RIGHT' | 'BOTTOM';

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
  private _stop: Big = new Big(0);
  private _isOpen: boolean = false;

  public get prevOpenItem() {
    return this._prevOpenItem;
  }

  public set prevOpenItem(item: KLineBaseInterface) {
    this._prevOpenItem = item;
  }

  public get sum() {
    return this._sum;
  }

  public set sum(sum: BigSource) {
    this._sum = this._sum.plus(sum);
  }

  public get stop() {
    return this._stop;
  }

  public set stop(stop: BigSource) {
    this._stop = new Big(stop);
  }

  public get isOpen() {
    return this._isOpen;
  }

  public set isOpen(isOpen: boolean) {
    this._isOpen = isOpen;
  }
}

type infoType = '开多' | '开空' | '平多' | '平空';

export interface ResultInterface {
  id: string | number;
  date?: string;
  info: infoType;
  key: string;
  _price: BigSource;
  symbol: string;
  stop?: string;
}
