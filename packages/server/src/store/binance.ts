import server from '@data-analysis/config/server';
import { macdParam } from '@data-analysis/config/global';
import {
  BinanceClient,
  Candle,
  CandleChartInterval_LT,
  CandleChartResult,
  FuturesBalanceResult,
  PositionRiskResult,
} from '@data-analysis/crypto-binance';

import {
  delay,
  mergeMap,
  of,
  tap,
  take,
  zip,
  retryWhen,
  partition,
  share,
  concatAll,
  filter,
  map,
  concatWith,
  Big,
  throttleTime,
  timer,
  concatMapTo,
  pairwise,
  catchError,
  concatMap,
  from,
  groupBy,
  reduce,
  switchMap,
} from '@data-analysis/core';
import { getNowTime, timeBinance } from '@data-analysis/utils';
import { BinanceKLineInterface } from '@data-analysis/types/kline.type';
import {
  macdOperator,
  makeMacdObservable,
} from '@data-analysis/operators/src/macd';
import {
  DirectionVolumnInterface,
  OrderMapInterface,
} from '@data-analysis/types/order.type';

const orderEnum: any = {
  多: 'buy',
  空: 'sell',
};

class BinanceStore {
  // 初始化期货
  private binanceServices: BinanceClient = new BinanceClient(
    server.bian.development.API_KEY,
    server.bian.development.API_SECRET,
  );

  private _accountInfoLists: FuturesBalanceResult[] = [];
  private _accountInfo: FuturesBalanceResult = {
    accountAlias: '',
    asset: '',
    balance: '',
    crossWalletBalance: '',
    crossUnPnl: '',
    availableBalance: '',
    maxWithdrawAmount: '',
  };
  private _openMargin: any = {
    buy: new Big(0),
    sell: new Big(0),
  };
  private map: Map<string, OrderMapInterface> = new Map<
    string,
    OrderMapInterface
  >();
  private maxOpenLimit: number = 25; // 最大合约数

  constructor() {
    // this.onLoad();
    // this.main();
  }

  // 获取账户权益信息
  get accountInfo() {
    return this._accountInfo;
  }

  openMargin(dir: string) {
    switch (dir) {
      case 'buy':
        return this._openMargin.buy;
      case 'sell':
        return this._openMargin.sell;
    }
  }

  // 获取每次开仓的账户信息 - array
  get accountInfoLists() {
    return this._accountInfoLists;
  }

  main() {
    // this.order(
    //   {
    //     orderInfo: '平多',
    //     symbol: 'ONTUSDT',
    //   },
    //   '17.1',
    // ).subscribe((x) => console.log(x, '测试下单'));
    this.futuresExchangeInfo()
      .pipe(
        take(this.maxOpenLimit),
        concatMap((x) => of(x).pipe(delay(10 * 1000))),
        tap((x) => console.log(x, '中途debug')),
        mergeMap((x) =>
          this.fetchHistoryKlines$(x.symbol, '15m', 300, 1).pipe(
            map((orderInfo) => ({
              symbol: x.symbol,
              quantityPrecision: x.quantityPrecision, // 系统设定的数量精度
              minQty: x.marketFilters.minQty,
              stepSize: x.marketFilters.stepSize,
              notional: x.minNotionalFilters.notional,
              orderInfo: orderInfo.info,
            })),
            filter((x) => {
              return !(
                x.orderInfo.includes('开') &&
                new Big(this._accountInfo.availableBalance || 0.1)
                  .div(
                    // 实际权益
                    new Big(this._accountInfo.crossWalletBalance).plus(
                      this._accountInfo.crossUnPnl,
                    ) || 0.1,
                  )
                  .lt(0.3)
              );
            }), // 可用权益低于 30% 停止开仓
            concatMap((order) => {
              console.log(order, 'debug 在并发任务里面使用concatMap');
              const val = this.getMapValue(order.symbol); // 取出 map 中的 value 值

              this._accountInfoLists.push(this._accountInfo); // 记录每次开仓时的权益

              let qty: string = ''; // 数量

              if (order.orderInfo.includes('开')) {
                const openPriceBase = this.maxOpenLimit * 3; // 75 usdt 作为一个标准值.

                // 实际权益
                const realBalance = new Big(
                  this._accountInfo.crossWalletBalance,
                ).plus(this._accountInfo.crossUnPnl);

                // 当前实际权益 / 开仓基准值 = 超过 75 usdt 才允许 x2
                const openBaseVolumn: number =
                  realBalance.div(openPriceBase).round(0).toNumber() || 1;

                // 5 usdt 名义最小开仓数量
                const localMinQty = new Big(order.notional).div(val.lastPrice);

                // 最小开仓数量
                let minQty: Big = localMinQty.gt(order.minQty)
                  ? localMinQty.plus(order.stepSize)
                  : new Big(order.minQty);

                // 转换参数
                const direction = orderEnum[order.orderInfo.split('')[1]];
                const position_margin = this._openMargin[direction];

                console.log(
                  position_margin.toString(),
                  realBalance.toString(),
                  direction,
                  this._openMargin.buy.toString(),
                  this._openMargin.sell.toString(),
                  'position_margin -',
                );

                // 多/空 保证金占用设计为 35%  超出返回0
                if (new Big(position_margin).div(realBalance).gt(0.4)) {
                  minQty = new Big(0);
                }

                // 开仓保证金
                const openUsdt = new Big(val.lastPrice)
                  .times(minQty)
                  .div(val.leverRate);

                if (openUsdt.div(realBalance).gte(0.1)) {
                  minQty = new Big(0);
                }

                qty = minQty
                  .times(openBaseVolumn)
                  .times(2.5)
                  .round(order.quantityPrecision)
                  .toString();
              } else {
                const direction =
                  order.orderInfo.split('')[1] === '多' ? 'sell' : 'buy';

                qty = val.openVolumn[direction].toString();
              }

              // 最小开仓数 * 开仓系数 * 系统允许的精度 = 开仓数量
              return of({
                minQty: qty,
                order,
              }).pipe(
                delay(1500),
                filter(({ minQty }) => minQty !== '0'),
                concatMap(({ minQty, order }) => this.order(order, minQty)),
              );
            }),
          ),
        ),
      )
      .subscribe((x) => {
        console.log('实盘开仓订单:', getNowTime(new Date().getTime()), x);
      });
  }

  onLoad() {
    this.autoPositionRisk(); // 自动更新仓位数据
    this.autoCloseOrders(); // 自动平仓大于4小时的订单
    this.autoGetUsdtBalance(); // 自动获取账户权益
    this.autoComputeOpenMargin(30 * 1000); // 定时计算总的开仓保证金
  }

  order(order: any, minQty: string) {
    return this.binanceServices
      .order(order.orderInfo, order.symbol, 'MARKET', minQty)
      .pipe(
        catchError((err) => {
          console.error(err, 'binance 下单失败');
          return of();
        }),
      );
  }

  /**
   * 获取历史k线
   * @param symbol
   * @param interval
   * @param limit
   * @returns
   */
  historyKLine(
    symbol: string,
    interval: CandleChartInterval_LT,
    limit?: number,
    startTime?: number,
    endTime?: number,
  ) {
    return this.binanceServices
      .historyKLine(symbol, interval, limit, startTime, endTime)
      .pipe(
        concatAll(),
        filter(
          (item) =>
            new Date().getTime() - item.openTime >= timeBinance[interval],
        ),
        map((x: CandleChartResult) =>
          this.transKLineData(x, x.openTime, symbol),
        ),
        retryWhen((errors) => errors.pipe(delay(5000))), // 5秒之后重连
      );
  }

  /**
   * websocket interval 流 - 只在每 interval 间隔发出一个值
   * @param symbol
   * @param interval
   * @returns
   */
  wsIntervalkLine(symbol: string, interval: CandleChartInterval_LT) {
    const share$ = this.binanceServices.wskLine(symbol, interval).pipe(share());

    // 每6秒 存储 websocket 推送的 实时最新价 和 更新 持仓占用保证金
    share$
      .pipe(
        throttleTime(6 * 1000),
        map((x) => this.transKLineData(x, x.startTime, symbol)),
      )
      .subscribe((x) => {
        const val = this.getMapValue(x.symbol);

        const openMarginBuy = new Big(x.close)
          .times(val.openVolumn.buy)
          .div(val.leverRate)
          .abs();

        const openMarginSell = new Big(x.close)
          .times(val.openVolumn.sell)
          .div(val.leverRate)
          .abs();

        // console.log(
        //   x.symbol,
        //   openMarginBuy.toString(),
        //   openMarginSell.toString(),
        //   '间隔计算占用保证金',
        // );

        this.map.set(x.symbol, {
          ...val,
          lastPrice: x.close,
          openMargin: {
            buy: openMarginBuy,
            sell: openMarginSell,
          },
        });
      });

    return share$.pipe(
      pairwise(),
      filter((items) => items[0].startTime !== items[1].startTime),
      map((x) => x[0]),
      map((x) => this.transKLineData(x, x.startTime, symbol)),
    );
  }

  /**
   * 组装好的 kline 流
   * @param symbol
   * @param interval
   * @param limit
   * @param mergeLength
   * @returns
   */
  fetchHistoryKlines$(
    symbol: string,
    interval: CandleChartInterval_LT,
    limit: number = 96,
    mergeLength: number = 1,
  ) {
    return this.historyKLine(
      symbol,
      interval,
      limit * mergeLength + macdParam[1],
    ).pipe(
      concatWith(this.wsIntervalkLine(symbol, interval)),
      makeMacdObservable(macdParam),
      macdOperator(limit),
    );
  }

  transKLineData = (
    candle: Candle | CandleChartResult,
    id: number,
    symbol: string,
  ): BinanceKLineInterface => ({
    id: id,
    symbol: symbol,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  });

  /**
   * 获取合约交易对信息
   */
  futuresExchangeInfo() {
    return this.binanceServices.futuresExchangeInfo();
  }

  /**
   * 账户 usdt 权益
   * @returns
   */
  futuresUsdtBalance() {
    return this.binanceServices.futuresBalance().pipe(
      concatAll(),
      filter((x) => x.asset === 'USDT'),
    );
  }

  /**
   * 账户万向划转
   * @returns
   */
  universalTransfer(type: boolean, amount: string, asset: string = 'USDT') {
    return this.binanceServices.universalTransfer({
      type: type ? 'MAIN_UMFUTURE' : 'UMFUTURE_MAIN',
      asset: asset,
      amount: amount,
    });
  }

  /**
   * 平仓大于8小时的订单
   * @returns
   */
  futuresCloseOrders(hour: number) {
    const hours = 1000 * 60 * 60 * hour;

    return this.binanceServices.futuresPositionRisk().pipe(
      switchMap((x) =>
        from(x).pipe(
          filter((x) => x.symbol.includes('USDT') && !x.symbol.includes('_')), // 暂时只允许usdt的交易对通过
          filter((x: any) => {
            const time =
              new Big(x.positionAmt).abs().gt(0) &&
              new Big(new Date().getTime()).minus(x.updateTime).gt(hours);

            // console.log(
            //   time,
            //   x.positionAmt,
            //   new Date().getTime(),
            //   x.updateTime,
            //   new Big(new Date().getTime()).minus(x.updateTime).gt(fourHours),
            //   '允许的订单 1',
            // );

            return time;
          }), // 过滤出持仓仓位 和 大于4小时的订单
          // tap((x) => console.log(x, '允许的订单')),
          concatMap((x) =>
            this.order(
              {
                orderInfo: x.positionSide === 'LONG' ? '平空' : '平多',
                symbol: x.symbol,
              },
              new Big(x.positionAmt).abs().toString(),
            ).pipe(
              delay(2000),
            ),
          ),
        ),
      ),
    );
  }

  /**
   * 延迟一段时间自动平仓订单.
   */
  autoCloseOrders() {
    timer(8 * 1000, 4 * 60 * 60 * 1000)
      .pipe(
        // tap((x) => console.log('定时平仓log')),
        concatMapTo(this.futuresCloseOrders(24)),
        // retryWhen((err) => err.pipe(delay(5000))),
      )
      .subscribe((x) => {
        console.log(x, '定时平仓大于2小时的订单');
      });
  }

  // 初始化更新仓位数据 & websocket 更新仓位数据
  autoPositionRisk() {
    this.futuresPositionRisk()
      .pipe(concatWith(this.futuresWsPositions()))
      .subscribe((x) => {
        const val = this.getMapValue(x.symbol);

        console.log(
          x,
          x.leverage === '0' ? val.leverRate : x.leverage,
          '持仓数据 -',
        );

        this.map.set(x.symbol, {
          ...val,
          openVolumn: {
            ...val.openVolumn,
            buy: new Big(x.openVolumn['SHORT'] ?? 0),
            sell: new Big(x.openVolumn['LONG'] ?? 0),
          },
          leverRate: Number(x.leverage === '0' ? val.leverRate : x.leverage),
        });
      });
  }

  /**
   * 每隔 2秒 获取一次账户权益
   */
  autoGetUsdtBalance() {
    const share$ = timer(3 * 1000, 10 * 1000).pipe(
      concatMapTo(this.futuresUsdtBalance()),
      catchError(() =>
        of({
          accountAlias: '',
          asset: '',
          balance: '',
          crossWalletBalance: '',
          crossUnPnl: '',
          availableBalance: '',
          maxWithdrawAmount: '',
        }),
      ),
      filter((x) => x.balance !== ''),
      share(),
    );

    share$.subscribe((accountInfo) => {
      console.log(accountInfo, '账户权益');

      this._accountInfo = accountInfo;
    });

    // 定时将超出10u的权益转到现货账户
    // share$
    //   .pipe(
    //     throttleTime(1000 * 60 * 60 * 24),
    //     filter((x) => new Big(x.crossWalletBalance).plus(x.crossUnPnl).gt(10)),
    //     switchMap((x) =>
    //       this.universalTransfer(
    //         false,
    //         new Big(x.crossWalletBalance)
    //           .plus(x.crossUnPnl)
    //           .minus(10)
    //           .round(3)
    //           .toString(),
    //       ),
    //     ),
    //     // retryWhen((err) => err.pipe(delay(5000))),
    //   )
    //   .subscribe((x) => {
    //     console.log(x, '定时转u到现货账户');
    //   });

    // 监控是否爆仓，爆仓转10u到合约账户
    share$
      .pipe(
        throttleTime(1000 * 60 * 60 * 24),
        filter((x) => new Big(x.crossWalletBalance).round(0).eq(0)),
        switchMap((x) => this.universalTransfer(true, '10')),
        // retryWhen((err) => err.pipe(delay(5000))),
      )
      .subscribe((x) => {
        console.log(x, '定时监控爆仓转u到合约账户');
      });
  }

  /**
   * user websocket 数据
   */
  futuresUser() {
    return this.binanceServices.futuresUser();
  }

  /**
   * websocket 账户数据更新推送
   * positionSide: "BOTH" || "LONG" || "SHORT" 三种持仓类型 long 持仓表示买多  short 持仓表示卖空
   */
  futuresWsPositions() {
    return this.futuresUser().pipe(
      filter((x) => x.eventType === 'ACCOUNT_UPDATE'),
      concatMap((x: any) =>
        of(x.positions).pipe(
          filter((x) => Array.isArray(x) && !!x.length),
          map((x: any) => ({
            symbol: x[0].symbol, // 名称
            openVolumn: {
              [x[0].positionSide as string]: new Big(x[0].positionAmount)
                .abs()
                .toString(),
              [x[1].positionSide as string]: new Big(x[1].positionAmount)
                .abs()
                .toString(),
              [x[2].positionSide as string]: new Big(x[2].positionAmount)
                .abs()
                .toString(),
            }, // 仓位数量
            leverage: '0',
          })),
        ),
      ),
    );
  }

  /**
   * user websocket 数据
   */
  marginUser() {
    this.binanceServices.marginUser().subscribe((x) => {
      console.log(x, 'marginUser数据');
    });
  }

  /**
   * 账户信息数据，暂时用不到
   */
  futuresAccountInfo() {
    this.binanceServices.futuresAccountInfo().subscribe((x) => {
      console.log(x, 'futuresAccountInfo数据');
    });
  }

  /**
   * 期货仓位信息和杠杆信息
   */
  futuresPositionRisk() {
    return this.binanceServices.futuresPositionRisk().pipe(
      delay(1500),
      concatMap((x) =>
        from(x).pipe(
          filter((x) => x.symbol.includes('USDT') && !x.symbol.includes('_')), // 暂时只允许usdt的交易对通过
          groupBy((p) => p.symbol),
          mergeMap((group$) =>
            group$.pipe(
              reduce((acc, cur) => [...acc, cur], [] as PositionRiskResult[]),
            ),
          ),
          map((x: PositionRiskResult[]) => ({
            symbol: x[0].symbol, // 名称
            openVolumn: {
              [x[0].positionSide]: new Big(x[0].positionAmt).abs().toString(),
              [x[1].positionSide]: new Big(x[1].positionAmt).abs().toString(),
            }, // 仓位数量
            leverage: x[0].leverage, // 杠杆倍数
          })),
        ),
      ),
    );
  }

  /**
   * 深度信息
   * @param symbol
   * @param level
   */
  futuresPartialDepth(symbol: string, level: number) {
    this.binanceServices
      .futuresPartialDepth({
        symbol,
        level,
      })
      .pipe(
        delay(3 * 60 * 1000),
        throttleTime(1000),
        map((x: any) => ({ bids: x.bidDepth, asks: x.askDepth })),
      )
      .subscribe((x) => {
        // console.log(x, '深度信息');

        const val = this.getMapValue(symbol);
        this.map.set(symbol, {
          ...val,
          depth: x,
        });
      });
  }

  /**
   * interval 时间计算 多/空 持仓保证金
   * @param interval 延迟时间
   */
  autoComputeOpenMargin(interval: number) {
    timer(60 * 1000, interval)
      .pipe(
        concatMap(() => {
          let buy = new Big(0);
          let sell = new Big(0);

          for (const value of this.map.values()) {
            buy = buy.plus(value.openMargin.buy);
            sell = sell.plus(value.openMargin.sell);

            // console.log(
            //   value.openMargin.buy.toString(),
            //   value.openMargin.sell.toString(),
            //   buy.toString(),
            //   sell.toString(),
            //   ' debug 多空',
            // );
          }

          return of({ buy, sell });
        }),
      )
      .subscribe((openMargin) => {
        console.log(
          openMargin.buy.toString(),
          openMargin.sell.toString(),
          '定时计算总的 多/空 持仓保证金',
        );

        this._openMargin = openMargin;
      });
  }

  /**
   * 获取map key里面的value值
   * @param symbol
   * @returns
   */
  getMapValue(symbol: string) {
    return (
      this.map.get(symbol) ?? {
        openVolumn: {
          buy: new Big(0),
          sell: new Big(0),
        },
        leverRate: 0,
        depth: {
          bids: [],
          asks: [],
        },
        lastPrice: new Big(0),
        openMargin: {
          buy: new Big(0),
          sell: new Big(0),
        },
      }
    );
  }
}

export default new BinanceStore();
