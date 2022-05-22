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
import { getNowTime } from '@data-analysis/utils';
import {
  HuobiHttpClient,
  WebsocketKLineClient,
  WebsocketNotificationClient,
} from '@data-analysis/crypto-huobi';
import {
  makeRsiExObservable,
  makeRsiObservable,
} from '@data-analysis/operators/src/base';
import { autoRsiExTestOperator } from '@data-analysis/operators/src/rsi';
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
import { AccountInfoInterface } from '@data-analysis/types/operator.type';
import { RsiTestOperator } from '@data-analysis/operators/src/rsi.Rx';

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

class HuobiStore {
  private huobiServices: HuobiHttpClient;
  private websocketKLineClient: WebsocketKLineClient;
  private websocketNotificationClient: WebsocketNotificationClient;
  private accountInfo: SwapCrossAccountInfoResultInterface = {
    margin_mode: 'cross',
    margin_account: 'USDT',
    margin_asset: 'USDT',
    margin_balance: 0,
    margin_static: 0,
    margin_position: 0,
    margin_frozen: 0,
    profit_real: 0,
    profit_unreal: 0,
    withdraw_available: 0,
    risk_rate: 0,
    contract_detail: [],
  };
  private _accountInfoLists: AccountInfoInterface = {
    xAxisTexts: [],
    balances: [],
    crossWalletfixBalance: [],
    availableBalance: [],
  };
  private maxOpenLimit: number = 1; // 最大开仓数
  private openCount: number = 0; // 开仓数
  private map: Map<string, HuobiOrderMapInterface> = new Map<
    string,
    HuobiOrderMapInterface
  >();

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

  get accountinfo() {
    return this.accountInfo;
  }
  get accountInfoLists() {
    return this._accountInfoLists;
  }

  // 动态持仓数量
  dynamicVolumn(contract_code: string, direction: 'buy' | 'sell') {
    const base = this.maxOpenLimit * 25; // 30 usdt 作为一个标准值.
    // 基准开仓数量 权益少于 30u 时 为1 大于30u 小于60u为1 大于60u为 2
    const baseX =
      new Big(this.accountInfo.margin_balance).div(base).round(0).toNumber() ||
      1;
    const baseVolumn = new Big(2 * this.openCount + 1)
      .times(baseX)
      .round(0)
      .toNumber();

    const map = this.getMapValue(contract_code);
    const openMargin = this.getMapValue('total').openMargin;

    // 该方向总占用的保证金
    const position_margin = openMargin[direction] || 0;

    // 如果该方向的保证金占用超过一半 直接返回0
    if (new Big(position_margin).div(this.accountInfo.margin_balance).gt(0.5)) {
      return 0;
    }

    // 获取到已经开仓的数量 如果没有数据 则为0
    const openVolumn = map.openVolumn[direction];

    const volumn = new Big(openVolumn).gte(baseVolumn) ? 0 : baseVolumn;

    return volumn;
  }

  onLoad() {
    // websocket 推送账户权益
    this.websocketNotificationClient.accounts$().subscribe((x) => {
      this.accountInfo = x[0];
      // console.log(x[0], 'x[0] --');
    });
    // 保存每个合约的最大杠杆值
    this.fetchSwapCrossAvailableLevelRate().subscribe((x) => {
      const lever_rate = x.available_level_rate.split(',').pop() || 20;

      const val = this.getMapValue(x.contract_code);
      this.map.set(x.contract_code, { ...val, leverRate: +lever_rate });
    });
    // http & websocket 持仓变动更新数据
    this.autoUpdatePositions$();
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
              return !(
                x.orderInfo.includes('开') &&
                new Big(this.accountInfo.withdraw_available || 0.1)
                  .div(
                    // 实际权益
                    new Big(this.accountInfo.margin_static).plus(
                      this.accountInfo.profit_unreal,
                    ) || 0.1,
                  )
                  .lt(0.7)
              );
            }), // 可用权益低于 30% 停止开仓
            concatMap((order) => {
              console.log(order, 'debug 在并发任务里面使用concatMap');
              const map = this.getMapValue(order.symbol); // 取出 map 中的 value 值

              const [a, b] = order.orderInfo.split('');

              const offset = orderEnum[a as OffsetEx];
              const direction = orderEnum[b as DirectionEx];

              this.accountInfoLog(); // 记录每次开/平仓时的权益

              let qty: number = 0; // 数量

              const stop: any = {};

              if (order.orderInfo.includes('开')) {
                qty = this.dynamicVolumn(order.symbol, direction);
                stop['tp_trigger_price'] = new Big(order.stop ?? 0)
                  .round(order.quantityPrecision)
                  .toString();
                stop['tp_order_price_type'] = 'optimal_20';
              } else {
                qty = new Big(
                  map.openVolumn[direction === 'buy' ? 'sell' : 'buy'],
                ).toNumber();
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
                tap(() => {
                  if (offset === 'open' && this.openCount < 3) {
                    this.openCount++;
                  } else if (offset === 'close') {
                    this.openCount = 0;
                  }
                }),
                concatMap(({ volume, stop, order }) =>
                  this.fetchSwapCrossOrder({
                    contract_code: order.symbol,
                    volume,
                    direction,
                    offset,
                    lever_rate: map.leverRate,
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
   * 记录账户信息日志.
   */
  accountInfoLog() {
    this._accountInfoLists.xAxisTexts.push(getNowTime(new Date().getTime()));
    this._accountInfoLists.balances.push(
      this.accountInfo.margin_balance.toString(),
    );
    this._accountInfoLists.crossWalletfixBalance.push(
      new Big(this.accountInfo.margin_static)
        .plus(this.accountInfo.profit_unreal)
        .round(8)
        .toString(),
    );
    this._accountInfoLists.availableBalance.push(
      this.accountInfo.withdraw_available.toString(),
    );
  }

  marketDepth(symbol: string) {
    this.websocketKLineClient
      .marketDepth$(symbol, 'step6')
      .pipe(throttleTime(1000))
      .subscribe(({ symbol, ...rest }) => {
        const val = this.getMapValue(symbol);
        this.map.set(symbol, { ...val, depth: rest });
      });
  }

  /**
   * 用户持仓推送
   */
  positionsWs() {
    return this.websocketNotificationClient.positions$().pipe(
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
    );
  }

  /**
   * [全仓] 获取用户持仓信息
   */
  fetchSwapCrossPositionInfo(contract_code?: string) {
    return this.huobiServices.fetchSwapCrossPositionInfo(contract_code).pipe(
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
    );
  }

  /**
   *
   * @param info
   * @returns
   */
  autoUpdatePositions$() {
    // this.fetchSwapCrossPositionInfo()
    //   .pipe(
    //     concatWith(this.positionsWs()),
    this.positionsWs().subscribe((arrs) => {
      // 计算 多/空 持仓占用总权益的百分比
      const openMargin = {
        buy: new Big(0),
        sell: new Big(0),
      };
      for (const arr of arrs) {
        const map = this.getMapValue(arr.contract_code);
        this.map.set(arr.contract_code, {
          ...map,
          openVolumn: {
            ...map.openVolumn,
            [arr.direction]: arr.volume,
          },
        });
        openMargin[arr.direction] = openMargin[arr.direction].plus(
          arr.position_margin,
        );
      }
      const map = this.getMapValue('total');
      this.map.set('total', { ...map, openMargin });
    });
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
      makeRsiExObservable(offset),
      RsiTestOperator(size, 'RsiEx'),
    );
  }

  /**
   * 获取杠杆信息
   */
  fetchSwapCrossAvailableLevelRate() {
    return this.huobiServices
      .fetchSwapCrossAvailableLevelRate()
      .pipe(concatMap((x) => from(x)));
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
   * 获取用户账户信息
   */
  fetchSwapCrossAccountInfo() {
    return this.huobiServices.fetchSwapCrossAccountInfo();
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
        openMargin: {
          buy: new Big(0),
          sell: new Big(0),
        },
      }
    );
  }
}

export default new HuobiStore();
