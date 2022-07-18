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
  concatWith,
  of,
  tap,
  bufferCount,
  toArray,
  pipe,
  zip,
  max,
  min,
  scan,
  last,
  timer,
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
  SwapCrossOrderInterface,
  SwapCrossOrderInfoInterface,
  Direction,
  Offset,
} from '@data-analysis/crypto-huobi/src/types';
import { makeTestObservable } from '@data-analysis/operators';

import { makeCuObservable } from '@data-analysis/operators/src/macd';
import { correctionTime } from '@data-analysis/utils';

const orderEnum = {
  多: 'buy',
  空: 'sell',
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

  // 开仓的数量
  openCount: number = 1;

  private _kLine: Subject<KLineInterface> = new Subject<KLineInterface>();

  constructor(readonly symbol: string, interval: string) {
    // 初始化 Websocket KLine Client
    this.marketDepthSubscribe(symbol);
    this.positionCrossSubscribe(symbol);
    this.accountsCrossSubscribe();
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

          // console.log(arrs, '持仓信息');

          for (const arr of arrs) {
            this.openOrders = {
              ...this.openOrders,
              [arr.direction]: new Big(arr.volume),
            };

            this.leverRate = arr.lever_rate;
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
        this.positionCrossSubscribe(symbol);
      },
      complete: () => {
        // console.log('持仓变化数据 连接关闭');
        this.positionCrossSubscribe(symbol);
      },
    });
  }

  // usdt 权益数据
  accountsCrossSubscribe() {
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
        topic: `accounts_cross.USDT`,
      }),
      authD,
    ).subscribe({
      next: (msg) => {
        const data = inflateData(msg.data);

        if (data.topic === 'accounts_cross') {
          // console.log(new Big(data.data[0].margin_balance).div(100).round(0).toNumber() + 1, 'usdt data.data ->');

          this.openCount =
            new Big(data.data[0].margin_balance).div(100).round(0).toNumber() +
              1 || 1;
        }
      },
      error: (e) => {
        console.log(e, '报错信息');
        this.accountsCrossSubscribe();
      },
      complete: () => {
        // console.log('权益变化数据 连接关闭');
        this.accountsCrossSubscribe();
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
        this.kLineSubscribe(symbol, interval);
      },
      complete: () => {
        // console.log('k线数据 连接关闭');
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
        this.marketDepthSubscribe(symbol);
      },
      complete: () => {
        // console.log('深度数据 连接关闭');
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

/**
 * 合并k线
 * @param
 * @returns
 */
export const mergeKLine = (interval: number = 15) => {
  return pipe(
    bufferCount<KLineInterface>(interval),
    concatMap((items: KLineInterface[]) => {
      const source$ = zip(
        from(items).pipe(max((a, b) => (new Big(a.high).lt(b.high) ? -1 : 1))),
        from(items).pipe(min((a, b) => (new Big(a.low).lt(b.low) ? -1 : 1))),
        from(items).pipe(
          scan((a, b) => a.plus(b.volume), new Big(0)),
          last(),
        ),
      );

      return source$.pipe(
        map(
          ([max, min, volume]) =>
            ({
              id: items[0].id,
              open: items[0].open,
              close: items[items.length - 1].close,
              high: max.high,
              low: min.low,
              volume: volume.toNumber(),
            } as KLineInterface),
        ),
      );
    }),
  );
};

class HuobiStore {
  private huobiServices: HuobiHttpClient;
  private map: Map<string, BaseCoin> = new Map<string, BaseCoin>();

  constructor(
    private readonly symbol: string,
    private readonly interval: kLinePeriod,
  ) {
    // 初始化 Http Client
    this.huobiServices = new HuobiHttpClient(server.huobi.apiBaseUrl, {
      accessKey: server.huobi.profileConfig.accessKey,
      secretKey: server.huobi.profileConfig.secretKey,
    });

    this.onLoad();
    this.main();
  }

  onLoad() {
    // this.map.set(this.symbol, new BaseCoin(this.symbol, this.interval));
  }

  main() {
    // this.fetchHistoryKlines$(this.symbol, this.interval, 60, 1)
    this.autoFetchKlines({
      contract_code: this.symbol,
      period: '15min',
      size: 1,
    })
      .pipe(
        // mergeKLine(15),
        tap((x) => console.log(x, this.symbol)),
        // makeCuObservable(),
        makeTestObservable(),
        concatMap((orderInfo) => {
          console.log(orderInfo, 'debug 在并发任务里面使用concatMap');
          const [a, b] = orderInfo.split('');
          const offset = orderEnum[a as OffsetEx];
          const direction = orderEnum[b as DirectionEx];
          const map = this.getMapValue(this.symbol);
          const leverRate = map.leverRate;
          const openCount = map.openCount;
          const { buy, sell } = map.openOrders;

          let qty: number = 0; // 数量

          if (orderInfo.includes('开')) {
            qty = new Big(
              map.openOrders[orderInfo.includes('多') ? 'buy' : 'sell'],
            ).gte(openCount)
              ? 0
              : openCount;

            console.log(
              qty,
              orderInfo,
              buy.toString(),
              sell.toString(),
              '开仓数量 ->',
            );
          } else if (orderInfo.includes('平')) {
            qty = new Big(orderInfo.includes('空') ? buy : sell).toNumber();

            console.log(
              qty,
              orderInfo,
              buy.toString(),
              sell.toString(),
              '开仓数量 ->',
            );
          }

          return of({
            volume: qty,
            symbol: this.symbol,
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
      )
      .subscribe((x) => console.log(x, '开/平仓'));
  }

  autoFetchKlines(info: MarketHistoryKlineInterface) {
    return timer(5 * 1000, 1000 * 60 * 15).pipe(
      concatMap((index) => {
        return this.huobiServices
          .fetchMarketHistoryKline(info)
          .pipe(
            map(({ id, high, low, open, close, vol }) => ({
              id: id * 1000,
              open,
              close,
              high,
              low,
              volume: vol,
            })),
          );
      }),
    );
  }

  autoSwapCrossOrder(order: AutoSwapCrossOrderInterface): Observable<any> {
    // 实例
    const map = this.getMapValue(order.contract_code);

    // bids: 买盘, asks: 卖盘
    const { bids, asks } = map.depth;

    // const price = (
    //   order.direction === 'buy' ? bids[0][0] : asks[0][0]
    // ).toString();

    console.log(order, 'meker 挂单价格 ->');

    return this.fetchSwapCrossOrder({
      ...order,
      order_price_type: 'optimal_20',
      // price: price,
    }).pipe(
      delay(5 * 1000),
      filter((x) => !!x),
      concatMap((x) => {
        // if (!!!x) {
        //   return this.autoSwapCrossOrder(order);
        // }

        return this.fetchSwapCrossOrderInfo({
          contract_code: order.contract_code,
          order_id: x.order_id_str,
        }).pipe(
          filter(([orderInfo]) => orderInfo.status !== 6),
          concatMap(() =>
            this.fetchSwapCrossCancel({
              contract_code: order.contract_code,
              order_id: x.order_id_str,
            }),
          ),
          concatMap(() => this.autoSwapCrossOrder(order)),
        );
      }),
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
    to?: kLinePeriod,
  ): Observable<KLineInterface> {
    const share$ = this.huobiServices.fetchMarketHistoryKline(info).pipe(
      map(({ id, high, low, open, close, vol }) => ({
        id: id * 1000,
        open,
        close,
        high,
        low,
        volume: vol,
      })),
    );

    return share$.pipe(
      toArray(),
      concatMap((items) => {
        const start = correctionTime(items[0].id) + 14 * 60;

        return from(items).pipe(filter((x) => x.id >= start * 1000));
      }),
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
    to?: kLinePeriod,
  ) {
    return this.fetchHistoryKline(
      {
        contract_code,
        period,
        size: size * mergeLength + (offset - 1),
      },
      to,
    ).pipe(concatWith(this.wsKlines$(contract_code)));
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
    return this.map.get(symbol) ?? new BaseCoin(this.symbol, this.interval);
  }
}

export default new HuobiStore(
  server.huobi.symbol,
  server.huobi.interval as kLinePeriod,
);
