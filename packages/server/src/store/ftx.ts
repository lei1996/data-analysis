import { macdParam } from '@data-analysis/config/global';
import server from '@data-analysis/config/server';
import {
  Big,
  BigSource,
  bufferCount,
  catchError,
  concatMap,
  defaultIfEmpty,
  delay,
  filter,
  from,
  map,
  mergeMap,
  Observable,
  of,
  pairwise,
  retryWhen,
  take,
  tap,
  timer,
} from '@data-analysis/core';
import { FtxHttpClient, FtxWebsocketClient } from '@data-analysis/crypto-ftx';
import {
  Balance,
  NewOrderReq,
  ModifyOrderReq,
  HistoricalPricesReq,
} from '@data-analysis/crypto-ftx/src/types/httpClient';
import { FtxTickerResultInterface } from '@data-analysis/crypto-ftx/src/types/wsClient';
import {
  makeMacdObservable,
  macdOperator,
} from '@data-analysis/operators/src/macd';

interface FtxOrderMapInterface {
  openVolumn: {
    buy: BigSource;
    sell: BigSource;
  };
  ticker: FtxTickerResultInterface;
}

class FtxStore {
  private readHttpClient: FtxHttpClient;
  private httpClient: FtxHttpClient;
  private wsClient: FtxWebsocketClient;

  private maxOpenLimit: number = 40;
  private map: Map<string, FtxOrderMapInterface> = new Map<
    string,
    FtxOrderMapInterface
  >();

  private _user: Balance[] = [];
  private _userLists: Balance[][] = [];

  get user() {
    return this._user;
  }

  get userLists() {
    return this._userLists;
  }

  constructor() {
    const { API_KEY, API_SECRET } = server.ftx.development;
    this.readHttpClient = new FtxHttpClient(API_KEY, API_SECRET);
    this.httpClient = new FtxHttpClient(
      server.ftx.production.API_KEY,
      server.ftx.production.API_SECRET,
    );
    this.wsClient = new FtxWebsocketClient(API_KEY, API_SECRET);

    this.onLoad();
    this.main();
    this.test();
  }

  onLoad() {
    this.autofetchBalances(300); // 定时更新权益
    this.autofetchPositions(60); // 定时更新仓位
  }

  main() {
    // this.fetchAllFutures('PERP')
    //   .pipe(
    //     take(this.maxOpenLimit),
    //     map((x) => ({ name: x.name, sizeIncrement: x.sizeIncrement })),
    //     concatMap((x) =>
    //       of(x).pipe(
    //         tap((x) => this.ticker(x.name)),
    //         delay(20 * 1000),
    //       ),
    //     ),
    //     mergeMap((x) =>
    //       this.fetchHistoryKlines$(x.name, 15, 300).pipe(
    //         map((orderInfo) => ({
    //           size: x.sizeIncrement,
    //           orderInfo: orderInfo.info,
    //         })),
    //         concatMap((order) => {
    //           const map = this.getMapValue(x.name);
    //           const price = order.orderInfo.includes('多')
    //             ? map.ticker.bid
    //             : map.ticker.ask;
    //           let size: number = order.size;

    //           if (order.orderInfo.includes('平')) {
    //             size = new Big(
    //               order.orderInfo.includes('空')
    //                 ? map.openVolumn.buy
    //                 : map.openVolumn.sell,
    //             ).toNumber();
    //           }

    //           return of({
    //             name: x.name,
    //             info: order.orderInfo,
    //             size,
    //             price,
    //           }).pipe(
    //             filter((x) => new Big(x.size).gt(0)),
    //             concatMap((x) =>
    //               this.fetchNewOrder(x.name, x.info, x.size, x.price),
    //             ),
    //           );
    //         }),
    //       ),
    //     ),
    //   )
    //   .subscribe((x) => {
    //     console.log(x, '开仓');
    //   });

    this.ticker('BTC-PERP');
    this.fetchHistoryKlines$('BTC-PERP', 15, 300)
      .pipe(
        map((orderInfo) => ({
          size: 0.0001,
          orderInfo: orderInfo.info,
        })),
        concatMap((order) => {
          const map = this.getMapValue('BTC-PERP');
          const price = order.orderInfo.includes('多')
            ? map.ticker.bid
            : map.ticker.ask;
          let size: number = order.size;
          const usdt = this.user.filter((x) => x.coin === 'USDT')[0];
          const usd = this.user.filter((x) => x.coin === 'USD')[0];

          const total = new Big(usdt.total).minus(usd.total).div(1).round(0);

          size = total.times(size).toNumber();

          if (order.orderInfo.includes('平')) {
            size = new Big(
              order.orderInfo.includes('空')
                ? map.openVolumn.buy
                : map.openVolumn.sell,
            ).toNumber();
          }

          return of({
            name: 'BTC-PERP',
            info: order.orderInfo,
            size,
            price,
          }).pipe(
            filter((x) => new Big(x.size).gt(0)),
            concatMap((x) =>
              this.fetchNewOrder(x.name, x.info, x.size, x.price),
            ),
          );
        }),
      )
      .subscribe((x) => {
        console.log(x, '开仓');
      });
  }

  test() {
    // this.fetchAllFutures('PERP').subscribe((x) => {
    //   console.log(x, x.length, 'ftx 期货列表');
    //   //   this.user = x;
    // });
    // this.fetchNewOrder({
    //   market: 'NEAR-PERP',
    //   side: 'sell',
    //   price: 14.78,
    //   reduceOnly: true,
    //   type: 'limit',
    //   size: 0.1,
    // }).subscribe((x) => {
    //   console.log(x, 'ftx 下单结束');
    //   //   this.user = x;
    // });
    // this.fetchOrderStatus('109610127389').subscribe((x) => {
    //   console.log(x, '获取订单状态');
    // });
    // this.fetchModifyOrder({
    //   orderId: '109610127389',
    //   price: 15.2,
    //   size: 0.1,
    // }).subscribe((x) => {
    //   console.log(x, '修改订单');
    // });
    // this.fetchCancelOrder('109610127389').subscribe((x) => {
    //   console.log(x, '撤单');
    // });
    // this.wsClient.wsFills();
    // this.ticker('BTC-PERP');
    // this.fetchPositions().subscribe((x) => {
    //   console.log(x, '获取当前开仓');
    //   const map = this.getMapValue(x.future);
    //   this.map.set(x.future, {
    //     ...map,
    //     openVolumn: {
    //       ...map.openVolumn,
    //       [x.side]: new Big(x.size),
    //     },
    //   });
    // });
    // this.orders();
  }

  /**
   * 主账户权益
   * @returns
   */
  fetchMainBalances() {
    return this.readHttpClient.fetchMainBalances().pipe(
      filter((x) => x.success),
      map((x) => x.result),
    );
  }

  /**
   * 获取所有期货列表 - 允许过滤参数
   * @returns
   */
  fetchAllFutures(filterName: string) {
    return this.readHttpClient.fetchAllFutures().pipe(
      filter((x) => x.success),
      concatMap((x) =>
        from(x.result).pipe(
          filter((x) => x.name.includes(filterName) && x.enabled),
        ),
      ),
    );
  }

  /**
   * 获取k线数据
   * @returns
   */
  fetchHistoryKLines(params: HistoricalPricesReq) {
    return this.readHttpClient.fetchHistoryKLines(params).pipe(
      filter((x) => x.success),
      map((x) => x.result),
    );
  }

  /**
   * 提交新订单
   * @returns
   */
  fetchOrder(newOrder: NewOrderReq) {
    return this.httpClient.fetchOrder(newOrder).pipe(
      filter((x) => x.success),
      map((x) => x.result),
    );
  }

  /**
   * 获取订单状态
   * @returns
   */
  fetchOrderStatus(orderId: string) {
    return this.httpClient.fetchOrderStatus(orderId).pipe(
      filter((x) => x.success),
      map((x) => x.result),
    );
  }

  /**
   * 撤销订单
   * @returns
   */
  fetchCancelOrder(orderId: string) {
    return this.httpClient
      .fetchCancelOrder(orderId)
      .pipe(filter((x) => x.success));
  }

  /**
   * 修改订单
   * @returns
   */
  fetchModifyOrder(params: ModifyOrderReq) {
    return this.httpClient.fetchModifyOrder(params).pipe(
      filter((x) => x.success),
      map((x) => x.result),
    );
  }

  /**
   * 获取当前仓位 ??
   * @returns
   */
  fetchOpenOrders() {
    return this.httpClient.fetchOpenOrders().pipe(
      filter((x) => x.success),
      map((x) => x.result),
    );
  }

  /**
   * 获取当前仓位
   * @returns
   */
  fetchPositions() {
    return this.httpClient.fetchPositions().pipe(
      filter((x) => x.success),
      concatMap((x) =>
        from(x.result).pipe(
          map((x) => ({
            future: x.future,
            size: x.size,
            side: x.side,
          })),
        ),
      ),
    );
  }

  /**
   * 订单簿
   * 该orderbook通道提供有关订单簿两侧最好的 100 个订单的数据。
   */
  orderbook() {
    this.wsClient
      .orderbook({
        channel: 'orderbook',
        market: 'BTC-PERP',
      })
      .subscribe((x) => console.log(x, '订单簿数据'));
  }

  /**
   * 最佳买卖市场数据
   * bid：最佳买入价，如果投标存在，否则null - ask：最佳的卖出价
   */
  ticker(name: string) {
    this.wsClient
      .ticker({
        channel: 'ticker',
        market: name,
      })
      .subscribe((x) => {
        console.log(x, name, '最佳买卖市场数据');
        const map = this.getMapValue(name);
        this.map.set(name, {
          ...map,
          ticker: x,
        });
      });
  }

  /**
   * orders
   */
  orders() {
    this.wsClient.orders('orders').subscribe((x) => {
      console.log(x, 'orders');
      // const map = this.getMapValue(name);
      // this.map.set(name, {
      //   ...map,
      //   ticker: x,
      // });
    });
  }

  /**
   * 定时记录权益状态
   * @param maxLength 最大窗口大小
   */
  autofetchBalances(maxLength: number) {
    timer(0, 60 * 1000)
      .pipe(
        concatMap(() =>
          this.fetchMainBalances().pipe(
            catchError((err) => {
              console.error(err, '获取权益报错');
              return of();
            }),
          ),
        ),
        tap((x) => {
          console.log(x, 'ftx 账户余额');
          this._user = x;
        }),
        bufferCount(maxLength, 1),
      )
      .subscribe((x) => {
        this._userLists = x;
      });
  }

  /**
   * 定时更新持仓
   */
  autofetchPositions(interval: number) {
    timer(0, interval * 1000)
      .pipe(concatMap(() => this.fetchPositions()))
      .subscribe((x) => {
        console.log(x, '获取当前开仓');
        const map = this.getMapValue(x.future);
        this.map.set(x.future, {
          ...map,
          openVolumn: {
            ...map.openVolumn,
            [x.side]: new Big(x.size),
          },
        });
      });
  }

  /**
   * 轮询请求k线数据
   * @param market_name
   * @param interval
   * @param limit
   * @returns
   */
  fetchKLine(market_name: string, interval: number, limit: number = 300) {
    // k线数据
    return timer(0, 60 * 1000).pipe(
      concatMap((i) =>
        this.fetchHistoryKLines({
          market_name: market_name,
          resolution: 60 * interval, // 15min 以秒为单位的倍数
          limit: i >= 1 ? 2 : limit,
        }).pipe(
          concatMap((x) =>
            from(x).pipe(
              filter((x: any) =>
                new Big(new Date().getTime())
                  .minus(x.time)
                  .gte(60 * interval * 1000),
              ),
              map(({ time, ...rest }) => ({ id: time, ...rest })),
            ),
          ),
          retryWhen((err) => err.pipe(delay(5000))), // 5秒后重试
        ),
      ),
      pairwise(),
      filter((items) => items[0].id !== items[1].id),
      map((x) => x[0]),
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
    interval: number,
    limit: number = 300,
    mergeLength: number = 1,
  ) {
    return this.fetchKLine(
      symbol,
      interval,
      limit * mergeLength + macdParam[1] + 1,
    ).pipe(makeMacdObservable(macdParam), macdOperator(limit));
  }

  /**
   * 提交新订单 - 自动重新挂单
   * @param newOrder
   * @param delayTime
   */
  fetchNewOrder(
    symbol: string,
    info: string,
    size: number,
    price: number,
    delayTime: number = 60 * 1000,
  ) {
    const orderParams: NewOrderReq = {
      market: symbol,
      side: info.includes('多') ? 'buy' : 'sell',
      price: price,
      reduceOnly: info.includes('开') ? false : true,
      type: 'limit',
      size: size,
    };

    return this.fetchOrder(orderParams).pipe(
      catchError((err) => {
        console.error(err, 'ftx 提交新订单 报错');
        return of();
      }),
      tap((x) => console.log(x, 'ftx 提交新订单')),
      concatMap((x) =>
        of(x).pipe(
          delay(delayTime),
          concatMap((x) =>
            this.fetchLimitOrder(x.id, symbol, delayTime).pipe(
              catchError((err) => {
                console.error(err, 'ftx 重新挂单 报错');
                return of();
              }),
            ),
          ),
          defaultIfEmpty(x), // 如果订单直接成交了，返回刚才的订单
        ),
      ),
    );
  }

  /**
   * 带有重新修改挂单功能的函数
   * @param orderId
   * @param delayTime
   * @param retryCount
   * @returns
   */
  fetchLimitOrder(
    orderId: string,
    symbol: string,
    delayTime: number = 60 * 1000,
    retryCount: number = 0,
  ): Observable<any> {
    // 重试3次之后自动撤销订单
    if (retryCount >= 3) {
      return this.fetchOrderStatus(orderId).pipe(
        filter((x) => x.status === 'open'),
        concatMap((x) => this.fetchCancelOrder(x.id)),
      );
    }

    // 重新挂单
    return this.fetchOrderStatus(orderId).pipe(
      filter((x) => x.status === 'open'),
      concatMap((x) => {
        const map = this.getMapValue(symbol);
        const price = x.side === 'buy' ? map.ticker.bid : map.ticker.ask;

        if (price === x.price) {
          return this.fetchLimitOrder(
            x.id,
            symbol,
            delayTime,
            retryCount + 1,
          ).pipe(delay(delayTime));
        }

        return this.fetchModifyOrder({
          orderId: x.id,
          price: x.side === 'buy' ? map.ticker.bid : map.ticker.ask,
          size: x.size,
        }).pipe(
          tap((x) => console.log(x, '修改挂单')),
          delay(delayTime),
          concatMap((x) =>
            this.fetchLimitOrder(x.id, symbol, delayTime, retryCount + 1),
          ),
        );
      }),
    );
  }

  /**
   * 获取map key里面的value值
   * @param name
   * @returns
   */
  getMapValue(name: string) {
    return (
      this.map.get(name) ?? {
        openVolumn: {
          buy: new Big(0),
          sell: new Big(0),
        },
        ticker: {
          bid: 0,
          ask: 0,
          bidSize: 0,
          askSize: 0,
          last: 0,
          time: 0,
        },
      }
    );
  }
}

export default new FtxStore();
