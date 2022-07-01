import {
  Big,
  concatMap,
  delay,
  filter,
  from,
  groupBy,
  map,
  of,
  reduce,
  share,
  take,
  toArray,
  mergeMap,
  zip,
  timer,
  tap,
  scan,
  bufferCount,
  pipe,
  last,
  defaultIfEmpty,
  merge,
} from '@data-analysis/core';
import { runInAction, makeAutoObservable } from 'mobx';

import {
  fetchKlineData,
  fetchAccountInfoData,
  fetchExchangeInfoData,
  fetchChinaStockKLines,
  CryptoSource,
} from '../http/http';
import {
  AccountInfoInterface,
  ProfitObjectInterface,
} from '@data-analysis/types/operator.type';

import { UserDataInterface } from '../types/store';
import { binanceAccountInfoDataPipe } from './binanceStore';
import {
  getNowTime,
  randomDate,
  randomStartEndTime,
} from '@data-analysis/utils';
import {
  makeMacdObservable,
  makeMacdExObservable,
  makeMomExObservable,
  makeRsiObservable,
  ResultInterface,
} from '@data-analysis/operators/src/base';
import { macdParam } from '@data-analysis/config/global';
import {
  BinancekLine,
  KLineBaseInterface,
} from '@data-analysis/types/kline.type';
import { makeSuObservable } from '@data-analysis/operators';

// 这里是面向 用户 的 store
class Store {
  // 数据来源 key
  key: CryptoSource[] = ['huobi', 'binance', 'ftx'];
  // 选择 index
  touchIndex: number = 0;
  operatorTouchIndex: number = 0;
  // 用户账户数据
  user: UserDataInterface = {
    margin_balance: '0',
    withdraw_available: '0',
  };

  // 图标数据 暂留
  onLine: AccountInfoInterface = {
    xAxisTexts: [],
    balances: [],
    crossWalletfixBalance: [],
    availableBalance: [],
  };

  orderList: number[] = [];

  periodLists = [1, 5, 15, 30, 60, 240] as const;
  periodSelectId = 2;

  chinaSymbol: string = '';
  chinaKLineLength: string = '150';
  chinaStock = [5, 15, 30, 60, 240] as const;
  chinaStockIndex: number = 0;
  chinaMacdParams: number[] = [6, 13, 4];

  chinaMList: Array<any> = [];
  chinaSum: string = '0';

  profitLists: ProfitObjectInterface[] = [];
  isRandom: boolean = true;
  maxOpenLimit: number = 1;
  symbolLength: number = 600;

  constructor() {
    // this.fetchExchangeInfoData();

    this.test();
    // this.autoBestTest();
    makeAutoObservable(this);
  }

  changeCryptoSource() {
    this.touchIndex = (this.touchIndex + 1) % this.key.length;
  }

  changeChinaMacdParams(value: number, index: number) {
    runInAction(() => {
      this.chinaMacdParams[index] = value;
    });
  }

  changeChinaStockIndex(index: number) {
    runInAction(() => {
      this.chinaStockIndex = index;
    });
  }

  changeoperatorTouchIndex(index: number) {
    console.log(index, 'index');

    runInAction(() => {
      this.operatorTouchIndex = index;
    });
  }

  changeIntervalTouchIndex(index: number) {
    console.log(index, 'index');

    runInAction(() => {
      this.periodSelectId = index;
    });
  }

  test() {
    // 模拟异步队列推入值，用于并发状态下 使用队列提交订单.
    timer(0, 2000)
      .pipe(bufferCount(4))
      .subscribe((x) => {
        this.orderList.push(...x);
      });

    timer(0, 1000)
      .pipe(
        concatMap(() => {
          while (!!this.orderList.length) {
            const order = this.orderList.shift();

            return of(order).pipe(delay(1000));
          }
          return of();
        }),
        // filter((x) => !!x),
        concatMap((x) => {
          console.log(x, '队列中的值');
          return of(x);
        }),
      )
      .subscribe((x) => {
        // console.log(x, '队列中的值');
      });

    let age$ = of(27, 25, 29);
    let name$ = of('Foo', 'Bar');
    let isDev$ = of(true, true, false, true);

    zip(age$, name$, isDev$).subscribe((x) => console.log(x));
  }

  /**
   * 请求k线数据
   * @param kline
   */
  klineData(kline: BinancekLine) {
    return fetchKlineData(this.key[this.touchIndex], kline);
  }

  /**
   * 获取交易对信息
   */
  fetchExchangeInfoData() {
    const commonPipe = () => {
      return pipe(
        groupBy((x: ResultInterface) => x.key),
        mergeMap((group$) =>
          group$.pipe(
            reduce((acc, cur) => [...acc, cur], [] as ResultInterface[]),
          ),
        ),
      );
    };

    // 基准时间
    const baseTime = randomDate(
      new Date(2021, 5, 1),
      new Date(new Date().getTime()),
    )
      .getTime()
      .toString();

    // 时间间隔
    const period = this.periodLists[this.periodSelectId];

    const cryptoSource = this.key[this.operatorTouchIndex];

    const size = this.symbolLength;

    // 这里要随机定义150条数据的起始/终止时间 然后递归 每5秒推入一根k线看变化.
    const { timeRandomOffset, start, end } = randomStartEndTime(
      baseTime,
      period * 60 * 1000,
      size,
    );

    console.log(
      timeRandomOffset,
      '随机15分钟偏移量',
      getNowTime(start.times(1000).toString()),
      '起始时间',
      getNowTime(end.times(1000).toString()),
      '终止时间',
    );

    const intervalObj = {
      huobi: {
        1: '1min',
        5: '5min',
        15: '15min',
        30: '30min',
        60: '60min',
        240: '4hour',
      },
      binance: {
        1: '1m',
        5: '5m',
        15: '15m',
        30: '30m',
        60: '1h',
        240: '4h',
      },
      ftx: {
        1: 60,
        5: 60 * 5,
        15: 60 * 15,
        30: 60 * 30,
        60: 60 * 60,
        240: 60 * 60 * 4,
      },
    } as const;

    fetchExchangeInfoData(cryptoSource)
      .pipe(
        take(this.maxOpenLimit),
        concatMap((x) => of(x).pipe(delay(2 * 1000))),
        mergeMap((symbol: string) => {
          // 配置随机参数
          const params = this.isRandom
            ? {
                startTime: start.toString(),
                endTime: end.toString(),
              }
            : {
                limit: (size + macdParam[1]).toString(),
              };

          return fetchKlineData(cryptoSource, {
            symbol: symbol,
            interval: intervalObj[cryptoSource][period],
            ...params,
          }).pipe(
            concatMap((x: KLineBaseInterface[]) => {
              console.log('查看渲染次数');
              let kline: any = {};
              const share$ = from(x).pipe(
                concatMap((x) => of(x).pipe(delay(20))),
                tap((x) => kline = x),
                makeSuObservable(14),
                concatMap((info) => of({ info, close: kline.close })),
              );

              return share$;
            }),
          );
        }),
        // toArray(),
        // tap((arrs) => {
        //   from(arrs)
        //     .pipe(
        //       concatMap((arr: any) => {
        //         const { symbol, profit } = arr;

        //         return zip(
        //           [symbol],
        //           from(Object.keys(profit)).pipe(
        //             concatMap((key) =>
        //               from(profit[key] as string[]).pipe(
        //                 defaultIfEmpty('0'),
        //                 last(),
        //               ),
        //             ),
        //             scan((curr, next: string) => curr.plus(next), new Big(0)),
        //             defaultIfEmpty(new Big(0)),
        //             last(),
        //           ),
        //         );
        //       }),
        //     )
        //     .subscribe(([symbol, sum]) => {
        //       console.log(symbol, '总值：', sum.toString());
        //     });
        // }),
      )
      .subscribe((x: any) => {
        // this.profitLists = x;
        console.log(x, cryptoSource);
      });
  }

  // 每次开仓时用户权益的数值，用于绘制图表
  accountInfoData() {
    const source$ = fetchAccountInfoData(this.key[this.touchIndex]);

    source$
      .pipe(
        filter((x) => x.cryptoSource === 'huobi'),
        map((x) => x.data),
      )
      .subscribe((x) => {
        runInAction(() => {
          this.onLine = x;
        });
      });

    source$
      .pipe(
        filter((x) => x.cryptoSource === 'binance'),
        map((x) => x.data),
        binanceAccountInfoDataPipe(),
      )
      .subscribe((x) => {
        runInAction(() => {
          this.onLine = x;
        });
      });
  }

  computeResultPipe(symbol: string) {
    return pipe(
      tap((x: ResultInterface[][]) => console.log(x, '开平仓源数据')),
      concatMap((arrs: ResultInterface[][]) => {
        return from(arrs).pipe(
          concatMap((lists, i) => {
            const result = [];
            const obj = {
              isOpen: false,
              price: new Big(0),
            };
            let direction = '';

            for (const arr of lists) {
              if (!obj.isOpen && arr.info.includes('开')) {
                obj.price = new Big(arr._price);
                obj.isOpen = true;
              } else if (obj.isOpen && arr.info.includes('平')) {
                result.push(
                  arr.info === '平空'
                    ? new Big(arr._price).minus(obj.price).toString()
                    : new Big(obj.price).minus(arr._price).toString(),
                );
                obj.isOpen = false;
                obj.price = new Big(0);
              }

              direction = arr.key;
            }

            // return of(result); // 原始数据 每个开平仓的差值
            return from(result).pipe(
              reduce(
                (curr, next) => [
                  ...curr,
                  new Big(curr[curr.length - 1]).plus(next).toString(),
                ],
                ['0'],
              ),
              map((x) => ({ [direction]: x, symbol })),
            );
          }),
        );
      }),
      tap((x) => console.log(x, '处理完成的数据源')),
      reduce((curr, next) => Object.assign(curr, next), {}),
      map(({ symbol, ...rest }: any) => ({ symbol, profit: rest })),
    );
  }
}

export default new Store();
