import server from '@data-analysis/config/server';

import {
  Big,
  filter,
  map,
  concatMap,
  from,
  BigSource,
  Subject,
  pairwise,
  delay,
  Observable,
  timer,
  take,
  concatWith,
  of,
  tap,
  mergeMap,
} from '@data-analysis/core';
import {
  HuobiHttpClient,
  inflateData,
  authData,
  makeWebsocketInstance,
} from '@data-analysis/crypto-huobi';
import {
  kLinePeriod,
  SwapCrossCancelInterface,
  MarketHistoryKlineInterface,
  SwapContractInfoInterface,
  SwapCrossAccountInfoResultInterface,
  SwapCrossOrderInterface,
  SwapCrossOrderInfoInterface,
  Direction,
  Offset,
} from '@data-analysis/crypto-huobi/src/types';

import { makeSuObservable } from '@data-analysis/operators/src/macd';

const orderEnum = {
  空: 'buy',
  多: 'sell',
  开: 'open',
  平: 'close',
} as const;

type OffsetEx = '开' | '平';
type DirectionEx = '多' | '空';

interface OpenOrdersInterface {
  buy: BigSource;
  sell: BigSource;
}

interface DepthInterface {
  bids: [number, number][];
  asks: [number, number][];
}

interface KLineInterface {
  id: number; // 时间戳
  open: BigSource; // 开盘价
  close: BigSource; // 收盘价
  low: BigSource; // 最低价
  high: BigSource; // 最高价
  volume: BigSource; // 成交量
}

class BaseCoin {
  openOrders: OpenOrdersInterface = {
    buy: new Big(0),
    sell: new Big(0),
  };
  leverRate: number = 20; // 杠杆倍数
  // 深度
  depth: DepthInterface = {
    bids: [],
    asks: [],
  };

  private _kLine: Subject<KLineInterface> = new Subject<KLineInterface>();

  constructor(readonly symbol: string, interval: string) {
    // 初始化 Websocket KLine Client
    this.marketDepthSubscribe(symbol);
    this.positionCrossSubscribe(symbol);
    this.kLineSubscribe(symbol, interval);
  }

  // 最新的k线数据
  get lastKLine() {
    return this._kLine.asObservable();
  }

  // 持仓数据
  positionCrossSubscribe(symbol: string) {
    const url = 'api.hbdm.vn';
    const path = '/linear-swap-notification';
    const authD = JSON.stringify(
      authData(
        url,
        path,
        server.huobi.profileConfig.accessKey,
        server.huobi.profileConfig.secretKey,
      ),
    );

    console.log(authD, 'authD ->');

    makeWebsocketInstance(
      `wss://${url}${path}`,
      JSON.stringify({
        op: 'sub',
        topic: `positions_cross.${symbol}`,
      }),
      authD,
    ).subscribe({
      next: (msg) => {
        const data = inflateData(msg.data);

        if (data.topic === 'positions_cross') {
          const arrs = data.data;

          for (const arr of arrs) {
            this.openOrders = {
              ...this.openOrders,
              [arr.direction]: new Big(arr.volume),
            };
            this.leverRate = arr.leverRate;
          }
        }

        // map((x) => ({
        //   contract_code: x.contract_code,
        //   volume: x.volume,
        //   available: x.available,
        //   direction: x.direction,
        //   position_margin: x.position_margin,
        // }))

        // console.log(data, '持仓变化数据');
      },
      error: (e) => {
        console.log(e, '报错信息');
      },
      complete: () => {
        console.log('持仓变化数据 连接关闭');
        this.positionCrossSubscribe(symbol);
      },
    });
  }

  // k线数据
  kLineSubscribe(symbol: string, interval: string) {
    makeWebsocketInstance(
      server.huobi.wsUrl,
      JSON.stringify({
        sub: `market.${symbol}.kline.${interval}`,
      }),
    ).subscribe({
      next: (msg) => {
        const data = inflateData(msg.data);

        if (!!data.ch && (data.ch as string).includes('kline')) {
          const { id, open, close, high, low, vol } = data.tick;

          this._kLine.next({
            id: id * 1000,
            open,
            close,
            high,
            low,
            volume: vol,
          });
        }
      },
      error: (e) => {
        console.log(e, '报错信息');
      },
      complete: () => {
        console.log('k线数据 连接关闭');
        this.kLineSubscribe(symbol, interval);
      },
    });
  }

  // 市场深度数据
  marketDepthSubscribe(symbol: string) {
    makeWebsocketInstance(
      server.huobi.wsUrl,
      JSON.stringify({
        sub: `market.${symbol}.depth.step6`,
      }),
    ).subscribe({
      next: (msg) => {
        const data = inflateData(msg.data);

        if (data.ch && data.ch.includes(symbol) && data.ch.includes('step6')) {
          const { asks, bids } = data.tick;
          this.depth = {
            asks,
            bids,
          };
        }
      },
      error: (e) => {
        console.log(e, '报错信息');
      },
      complete: () => {
        console.log('深度数据 连接关闭');
        this.marketDepthSubscribe(symbol);
      },
    });
  }
}

interface AutoSwapCrossOrderInterface {
  contract_code: string;
  volume: number;
  direction: Direction;
  offset: Offset;
  lever_rate: number;
}

class HuobiStore {
  private huobiServices: HuobiHttpClient;
  private map: Map<string, BaseCoin> = new Map<string, BaseCoin>();
  private maxSymbolLimit: number = 1; // 最大执行品种数

  constructor() {
    // 初始化 Http Client
    this.huobiServices = new HuobiHttpClient(server.huobi.apiBaseUrl, {
      accessKey: server.huobi.profileConfig.accessKey,
      secretKey: server.huobi.profileConfig.secretKey,
    });

    this.onLoad();
    this.main();
  }

  onLoad() {
    this.map.set('BTC-USDT', new BaseCoin('BTC-USDT', '15min'));
  }

  main() {
    // timer(5000, 5000)
    //   .pipe(
    //     take(1),
    //     concatMap(() =>
    //       this.autoSwapCrossOrder({
    //         contract_code: 'BTC-USDT',
    //         volume: 1,
    //         direction: 'buy',
    //         offset: 'open',
    //         lever_rate: 200,
    //       }),
    //     ),
    //   )
    //   .subscribe((x) => console.log(x, 'maker 单'));

    this.fetchSwapContractInfo({})
      .pipe(
        take(this.maxSymbolLimit),
        concatMap((x) => of(x).pipe(delay(5 * 1000))),
        tap((x) => {
          console.log(x, '中途debug');
        }),
        mergeMap((x) => {
          return this.fetchHistoryKlines$(
            x.contract_code,
            '15min',
            300,
            14,
          ).pipe(
            makeSuObservable(14),
            map((orderInfo) => ({
              symbol: x.contract_code,
              quantityPrecision:
                x.price_tick.toString().split('.').pop()?.length ?? 1, // 合约价格精度
              orderInfo: orderInfo,
            })),
            concatMap((order) => {
              console.log(order, 'debug 在并发任务里面使用concatMap');
              const [a, b] = order.orderInfo.split('');
              const offset = orderEnum[a as OffsetEx];
              const direction = orderEnum[b as DirectionEx];
              const leverRate = this.getMapValue('BTC-USDT').leverRate;

              let qty: number = 0; // 数量

              if (order.orderInfo.includes('开')) {
                qty = 1;
              } else if (order.orderInfo.includes('平')) {
                const { buy, sell } = this.getMapValue(order.symbol).openOrders;
                qty = new Big(
                  order.orderInfo.includes('空') ? buy : sell,
                ).toNumber();
              }

              return of({
                volume: qty,
                symbol: order.symbol,
                offset,
                direction,
                leverRate,
              }).pipe(
                filter(({ volume }) => volume !== 0),
                concatMap(({ volume, symbol, offset, direction, leverRate }) =>
                  this.autoSwapCrossOrder({
                    contract_code: symbol,
                    volume: volume,
                    direction: direction,
                    offset: offset,
                    lever_rate: leverRate,
                  }),
                ),
              );
            }),
          );
        }),
      )
      .subscribe((x) => console.log(x, '开/平仓'));
  }

  autoSwapCrossOrder(order: AutoSwapCrossOrderInterface): Observable<any> {
    // bids: 买盘, asks: 卖盘
    const { bids, asks } = this.getMapValue('BTC-USDT').depth;

    const price = (
      order.direction === 'buy' ? bids[0][0] : asks[0][0]
    ).toString();

    console.log(price, 'meker 挂单价格 ->');

    return this.fetchSwapCrossOrder({
      ...order,
      order_price_type: 'post_only',
      price: price,
    }).pipe(
      delay(10 * 1000),
      filter((x) => !!x),
      concatMap((x) =>
        this.fetchSwapCrossOrderInfo({
          contract_code: 'SHIB-USDT',
          order_id: x.order_id_str,
        }).pipe(
          filter(([orderInfo]) => orderInfo.status !== 6),
          concatMap(() =>
            this.fetchSwapCrossCancel({
              contract_code: 'SHIB-USDT',
              order_id: x.order_id_str,
            }),
          ),
          concatMap(() => this.autoSwapCrossOrder(order)),
        ),
      ),
    );
  }

  /**
   * 获取上市的合约信息
   */
  fetchSwapContractInfo(info: SwapContractInfoInterface) {
    return this.huobiServices.fetchSwapContractInfo(info).pipe(
      concatMap((x) => from(x).pipe(filter((x) => x.contract_status === 1))),
      // count(), // 105 个上市合约
    );
  }

  /**
   * 获取用户账户信息
   */
  fetchSwapCrossAccountInfo() {
    return this.huobiServices.fetchSwapCrossAccountInfo();
  }

  /**
   * 合约下单
   */
  fetchSwapCrossOrder(info: SwapCrossOrderInterface) {
    return this.huobiServices.fetchSwapCrossOrder(info);
  }

  /**
   * 获取k线数据
   */
  fetchHistoryKline(
    info: MarketHistoryKlineInterface,
  ): Observable<KLineInterface> {
    return this.huobiServices.fetchMarketHistoryKline(info).pipe(
      map(({ id, high, low, open, close, vol }) => ({
        id: id * 1000,
        open,
        close,
        high,
        low,
        volume: vol,
      })),
    );
  }

  /**
   * websocket 推送k线数据
   */
  wsKlines$(symbol: string) {
    return this.getMapValue(symbol).lastKLine.pipe(
      pairwise(),
      filter((items) => items[0].id !== items[1].id),
      map((x) => x[0]),
    );
  }

  /**
   * 获取k线数据流
   */
  fetchHistoryKlines$(
    contract_code: string,
    period: kLinePeriod,
    size: number = 300,
    offset: number = 14,
    mergeLength: number = 1,
  ) {
    return this.fetchHistoryKline({
      contract_code,
      period,
      size: size * mergeLength + (offset + 1),
    }).pipe(concatWith(this.wsKlines$(contract_code)));
  }

  /**
   * 获取合约订单信息
   */
  fetchSwapCrossOrderInfo(info: SwapCrossOrderInfoInterface) {
    return this.huobiServices.fetchSwapCrossOrderInfo(info);
  }

  /**
   * 撤销订单
   */
  fetchSwapCrossCancel(info: SwapCrossCancelInterface) {
    return this.huobiServices.fetchSwapCrossCancel(info);
  }

  /**
   * 获取map key里面的value值
   * @param date
   * @returns
   */
  getMapValue(symbol: string) {
    return this.map.get(symbol) ?? new BaseCoin('BTC-USDT', '15min');
  }
}

export default new HuobiStore();
