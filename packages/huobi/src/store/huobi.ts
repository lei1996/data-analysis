import server from '@data-analysis/config/server';

import {
  Big,
  delay,
  filter,
  map,
  mergeMap,
  of,
  tap,
  take,
  concatWith,
  concatMap,
  from,
  throttleTime,
  toArray,
  BigSource,
  retryWhen,
} from '@data-analysis/core';
import {
  HuobiHttpClient,
  WebsocketKLineClient,
  WebsocketNotificationClient,
} from '@data-analysis/crypto-huobi';
import {
  kLinePeriod,
  SwapCrossCancelInterface,
  MarketDepthResultInterface,
  MarketHistoryKlineInterface,
  SwapContractInfoInterface,
  SwapCrossAccountInfoResultInterface,
  SwapCrossOrderInterface,
  SwapCrossOrderInfoInterface,
  SwapCrossPositionsCrossResultInterface,
} from '@data-analysis/crypto-huobi/src/types';

const orderEnum = {
  空: 'buy',
  多: 'sell',
  开: 'open',
  平: 'close',
} as const;

type OffsetEx = '开' | '平';
type DirectionEx = '多' | '空';

interface HuobiOrderMapInterface {
  openVolumn: {
    buy: BigSource;
    sell: BigSource;
  };
  leverRate: number;
  depth: {
    bids: [number, number][];
    asks: [number, number][];
  };
  openMargin: {
    buy: BigSource;
    sell: BigSource;
  };
}

interface OpenOrdersInterface {
  buy: BigSource;
  sell: BigSource;
}

interface DepthInterface {
  bids: [number, number][];
  asks: [number, number][];
}

class BaseCoin {
  private symbol: string; // 品种
  private websocketKLineClient: WebsocketKLineClient;
  private websocketNotificationClient: WebsocketNotificationClient;
  private openOrders: OpenOrdersInterface = {
    buy: new Big(0),
    sell: new Big(0),
  };
  private leverRate: number; // 杠杆倍数
  depth: DepthInterface = {
    bids: [],
    asks: [],
  };

  constructor(symbol: string, leverRate: number = 20) {
    // 初始化 Websocket KLine Client
    this.websocketKLineClient = new WebsocketKLineClient(server.huobi.wsUrl);
    this.websocketNotificationClient = new WebsocketNotificationClient(
      'api.hbdm.vn',
      '/linear-swap-notification',
      server.huobi.profileConfig.accessKey,
      server.huobi.profileConfig.secretKey,
      symbol,
    );
    this.marketDepth(symbol);
    this.positions();

    this.symbol = symbol;
    this.leverRate = leverRate;
  }

  marketDepth(symbol: string) {
    this.websocketKLineClient
      .marketDepth$(symbol, 'step6')
      .pipe(throttleTime(1000))
      .subscribe(({ symbol, ...rest }) => {
        console.log(rest, '深度数据 ->');

        this.depth = rest;
      });
  }

  positions() {
    this.websocketNotificationClient
      .positions$()
      .pipe(
        throttleTime(5 * 1000),
        concatMap((x) =>
          from(x).pipe(
            map((x) => ({
              contract_code: x.contract_code,
              volume: x.volume,
              available: x.available,
              direction: x.direction,
              position_margin: x.position_margin,
            })),
            toArray(),
          ),
        ),
      )
      .subscribe((x) => console.log(x, '持仓数据 ->'));
  }
}

class HuobiStore {
  private huobiServices: HuobiHttpClient;
  private websocketKLineClient: WebsocketKLineClient;
  private websocketNotificationClient: WebsocketNotificationClient;
  private accountInfo: SwapCrossAccountInfoResultInterface | {} = {};
  private maxOpenLimit: number = 1; // 最大开仓数

  constructor() {
    // 初始化 Http Client
    this.huobiServices = new HuobiHttpClient(server.huobi.apiBaseUrl, {
      accessKey: server.huobi.profileConfig.accessKey,
      secretKey: server.huobi.profileConfig.secretKey,
    });
    // 初始化 Websocket KLine Client
    this.websocketKLineClient = new WebsocketKLineClient(server.huobi.wsUrl);
    this.websocketNotificationClient = new WebsocketNotificationClient(
      'api.hbdm.vn',
      '/linear-swap-notification',
      server.huobi.profileConfig.accessKey,
      server.huobi.profileConfig.secretKey,
    );

    this.onLoad();
    this.main();
  }

  onLoad() {
    // websocket 推送账户权益
    this.websocketNotificationClient.accounts$().subscribe((x) => {
      console.log(x[0], '账户权益 ->');

      this.accountInfo = x[0];
    });
  }

  main() {
    this.fetchSwapContractInfo({})
      .pipe(
        take(this.maxOpenLimit),
        concatMap((x) => of(x).pipe(delay(10 * 1000))),
        tap((x) => {
          console.log(x, '中途debug');
        }),
        mergeMap((x) =>
          this.fetchHistoryKlines$(x.contract_code, '15min', 300, 14).pipe(
            map((orderInfo) => ({
              symbol: x.contract_code,
              quantityPrecision:
                x.price_tick.toString().split('.').pop()?.length ?? 1, // 合约价格精度
              orderInfo: orderInfo.info,
              stop: orderInfo.stop,
            })),
            filter((x) => {
              const accountInfo = this
                .accountInfo as SwapCrossAccountInfoResultInterface;
              return !(
                x.orderInfo.includes('开') &&
                new Big(accountInfo.withdraw_available || 0.1)
                  .div(
                    // 实际权益
                    new Big(accountInfo.margin_static).plus(
                      accountInfo.profit_unreal,
                    ) || 0.1,
                  )
                  .lt(0.7)
              );
            }), // 可用权益低于 30% 停止开仓
            concatMap((order) => {
              console.log(order, 'debug 在并发任务里面使用concatMap');

              const [a, b] = order.orderInfo.split('');

              const offset = orderEnum[a as OffsetEx];
              const direction = orderEnum[b as DirectionEx];

              let qty: number = 0; // 数量

              const stop: any = {};

              if (order.orderInfo.includes('开')) {
                qty = 1;
                stop['tp_trigger_price'] = new Big(order.stop ?? 0)
                  .round(order.quantityPrecision)
                  .toString();
                stop['tp_order_price_type'] = 'optimal_20';
              } else {
                qty = new Big(1).toNumber();
                console.log(qty, order.symbol, map, '平仓 qty');
              }

              // 最小开仓数 * 开仓系数 * 系统允许的精度 = 开仓数量
              return of({
                volume: qty,
                stop,
                order,
              }).pipe(
                delay(1500),
                filter(({ volume }) => volume !== 0),
                concatMap(({ volume, stop, order }) =>
                  this.fetchSwapCrossOrder({
                    contract_code: order.symbol,
                    volume,
                    direction,
                    offset,
                    lever_rate: '20',
                    order_price_type: 'optimal_20',
                    ...stop,
                  }),
                ),
              );
            }),
          ),
        ),
      )
      .subscribe((x) => console.log(x, '开仓'));
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
   * 合约下单
   */
  fetchSwapCrossOrder(info: SwapCrossOrderInterface) {
    return this.huobiServices.fetchSwapCrossOrder(info).pipe(
      map((x) => {
        if (!!!x) {
          throw `huobi 下单失败. 品种：${info.contract_code}, 开平仓: ${info.direction} ${info.offset}, 数量: ${info.volume}`;
        }
        return x;
      }),
      retryWhen((err) =>
        err.pipe(
          tap((err) => console.log(err)),
          delay(60 * 1000),
        ),
      ),
    );
  }

  /**
   * 获取k线数据
   */
  fetchHistoryKline(info: MarketHistoryKlineInterface) {
    return this.huobiServices
      .fetchMarketHistoryKline(info)
      .pipe(map((x) => ({ ...x, symbol: info.contract_code })));
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
    }).pipe(
      concatWith(this.websocketKLineClient.wsKline$(contract_code, period)),
    );
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
}

export default new HuobiStore();
