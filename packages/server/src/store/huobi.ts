import server from '@data-analysis/config/server';
import { macdParam } from '@data-analysis/config/global';

import {
  Big,
  delay,
  filter,
  map,
  mergeMap,
  of,
  tap,
  take,
  zip,
  interval,
  partition,
  share,
  concatWith,
  concatMap,
  from,
  concatMapTo,
  throttleTime,
  groupBy,
  concatAll,
  reduce,
  toArray,
  timer,
} from '@data-analysis/core';
import { getNowTime } from '@data-analysis/utils';
import {
  HuobiHttpClient,
  WebsocketKLineClient,
  WebsocketNotificationClient,
} from '@data-analysis/crypto-huobi';
import { macdOperator, makeMacdObservable } from '@data-analysis/operators';
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

const orderEnum: any = {
  多: 'buy',
  空: 'sell',
  开: 'open',
  平: 'close',
};

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
  private maxOpenLimit: number = 0; // 最大开仓数
  private map = new Map();
  private readonly maxContractLength: number = 3; // 数量过大，websocket 容易报错重连.

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

    // this.main();
  }

  get accountinfo() {
    return this.accountInfo;
  }
  get accountInfoLists() {
    return this._accountInfoLists;
  }

  // 动态持仓数量
  dynamicVolumn(contract_code: string, direction: string) {
    const priceVal = this.maxContractLength * 2; // 50 usdt 作为一个标准值.
    // 基准开仓数量 权益少于 50u 时 为0 大于50u 小于100u为1
    const baseVolumn = (this.accountInfo.margin_balance / priceVal) | 0;
    const symbolMap = this.map.get(contract_code);
    const openMargin = this.map.get('openMargin');

    // 该方向总占用的保证金
    const position_margin = (!!openMargin && openMargin[direction]) || 0;

    // 如果该方向的保证金占用超过一半 直接返回0
    if (new Big(position_margin).div(this.accountInfo.margin_balance).gt(0.5)) {
      return 0;
    }

    // 获取到已经开仓的数量 如果没有数据 则为0
    const openVolumn =
      (!!symbolMap.openVolumn && symbolMap.openVolumn[direction]) || 0;

    const volumn = openVolumn > baseVolumn ? 0 : baseVolumn;
    return volumn > 0 ? volumn : 1;
  }

  async main() {
    // websocket 推送账户权益
    this.websocketNotificationClient.accounts$().subscribe((x) => {
      this.accountInfo = x[0];
    });
    // // websocket 订阅订单成交数据
    // this.websocketNotificationClient.orders$().subscribe((x) => {
    //   console.log(x, '订阅订单成交数据');
    // });
    // websocket 持仓变动更新数据
    this.positions$()
      .pipe(
        toArray(),
        tap((arrs) => {
          // 计算 多/空 持仓占用总权益的百分比
          const openMargin = {
            buy: new Big(0),
            sell: new Big(0),
          };
          for (const arr of arrs) {
            openMargin[arr.direction].plus(arr.position_margin);
          }
          this.map.set('openMargin', openMargin);
        }),
        concatAll(),
      )
      .subscribe((x) => {
        const val = this.map.get(x.contract_code);
        this.map.set(x.contract_code, {
          ...val,
          openVolumn: {
            [x.direction]: x.volume,
          },
        });

        // console.log(x, val, '持仓变动更新数据');
      });
    // // websocket 合约订单撮合数据
    // this.websocketNotificationClient.matchOrders$().subscribe((x) => {
    //   console.log(x, '合约订单撮合数据');
    // });

    // 保存每个合约的最大杠杆值
    this.fetchSwapCrossAvailableLevelRate().subscribe((x) => {
      const lever_rate = x.available_level_rate.split(',').pop();

      const val = this.map.get(x.contract_code);
      this.map.set(x.contract_code, { ...val, lever_rate });
    });

    const source$ = zip(this.fetchSwapContractInfo({}), timer(7000 + 2000, 10 * 1000)).pipe(
      take(this.maxContractLength), // 不加这个会报v8错误.
      tap(([x]) => {
        this.maxOpenLimit++;
        // 获取深度数据
        this.websocketKLineClient
          .marketDepth$(x.contract_code, 'step6')
          .pipe(throttleTime(1000))
          .subscribe((depth) => {
            // console.log(this.map.get(x.contract_code), '深度数据');
            const val = this.map.get(x.contract_code);
            this.map.set(x.contract_code, { ...val, depth: depth });
          });
        console.log(this.maxOpenLimit, x.price_tick, '合约数量');
      }),
      mergeMap(([x]) =>
        this.fetchHistoryKlines$(x.contract_code, '15min', 150, 1).pipe(
          mergeMap((orderInfo) =>
            of({
              contract_code: x.contract_code,
              quantityPrecision:
                x.price_tick.toString().split('.').pop()?.length ?? 1, // 合约价格精度
              orderInfo,
            }),
          ),
        ),
      ),
      share(),
    );

    const [open$, close$] = partition(source$, (order) =>
      order.orderInfo.includes('开'),
    );

    open$
      .pipe(
        filter(() => {
          return new Big(this.accountInfo.withdraw_available)
            .div(
              // 实际权益
              new Big(this.accountInfo.margin_static).plus(
                this.accountInfo.profit_unreal,
              ) || 0.1,
            )
            .gt(0.2);
        }),
        tap(() => {
          this._accountInfoLists.xAxisTexts.push(
            getNowTime(new Date().getTime()),
          );
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
        }), // 记录每次开仓时候的账户数据.
        mergeMap((order) => {
          const [a, b] = order.orderInfo.split('');

          const offset = orderEnum[a];
          const direction = orderEnum[b];

          const symbolMap = this.map.get(order.contract_code);
          const lever_rate = symbolMap.lever_rate;
          const depth: MarketDepthResultInterface = symbolMap.depth;
          const price = b === '多' ? depth.bids : depth.asks;

          return this.fetchSwapCrossOrder({
            contract_code: order.contract_code,
            volume: this.dynamicVolumn(order.contract_code, direction),
            direction,
            offset,
            lever_rate: Number(lever_rate),
            order_price_type: 'opponent',
            // price: price[0][0].toString(),
          }).pipe(
            filter((item) => !!item && !!item.order_id_str), // 过滤 null
            concatMap((item) =>
              this.fetchSwapCrossOrderInfo({
                contract_code: order.contract_code,
                order_id: item.order_id_str,
              }).pipe(
                delay(5 * 60 * 1000),
                filter((x) => !!x && x[0].status !== 6),
                concatMapTo(
                  this.fetchSwapCrossCancel({
                    contract_code: order.contract_code,
                    order_id: item.order_id_str,
                  }),
                ),
              ),
            ),
          );
        }),
      )
      .subscribe((order) => {
        console.log('实盘开仓订单:', getNowTime(new Date().getTime()), order);
      });
    close$
      .pipe(
        mergeMap((order) => {
          const [a, b] = order.orderInfo.split('');

          const offset = orderEnum[a];
          const direction = orderEnum[b];

          const symbolMap = this.map.get(order.contract_code);
          const lever_rate = symbolMap.lever_rate;
          const depth: MarketDepthResultInterface = symbolMap.depth;
          const price = b === '多' ? depth.bids : depth.asks;
          const volumn =
            (!!symbolMap.openVolumn && symbolMap.openVolumn[direction]) || 0;

          return this.fetchSwapCrossOrder({
            contract_code: order.contract_code,
            volume: volumn,
            direction,
            offset,
            lever_rate: Number(lever_rate),
            order_price_type: 'post_only',
            price: price[0][0].toString(),
          }).pipe(
            filter((item) => !!item && !!item.order_id_str), // 过滤 null
            concatMap((item) =>
              this.fetchSwapCrossOrderInfo({
                contract_code: order.contract_code,
                order_id: item.order_id_str,
              }).pipe(
                delay(5 * 60 * 1000),
                filter((x) => !!x && x[0].status !== 6),
                concatMapTo(
                  this.fetchSwapCrossCancel({
                    contract_code: order.contract_code,
                    order_id: item.order_id_str,
                  }),
                ),
                // 撤单后对手价平仓.
                concatMapTo(
                  this.fetchSwapCrossOrder({
                    contract_code: order.contract_code,
                    volume: volumn,
                    direction,
                    offset,
                    lever_rate: Number(lever_rate),
                    order_price_type: 'opponent',
                  }),
                ),
              ),
            ),
          );
        }),
      )
      .subscribe((order) => {
        console.log('实盘平仓订单:', getNowTime(new Date().getTime()), order);
      });
  }

  /**
   * 用户持仓推送
   */
  positions$() {
    return this.websocketNotificationClient.positions$().pipe(
      concatAll(),
      filter((x) => x.volume > 0),
      map((x) => ({
        contract_code: x.contract_code,
        volume: x.volume,
        available: x.available,
        direction: x.direction,
        position_margin: x.position_margin,
      })),
    );
  }

  /**
   * 获取上市的合约信息
   */
  fetchSwapContractInfo(info: SwapContractInfoInterface) {
    return this.huobiServices.fetchSwapContractInfo(info).pipe(
      concatMap((x) => from(x)),
      filter((x) => x.contract_status === 1),
      // count(), // 105 个上市合约
    );
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
    mergeLength: number = 1,
  ) {
    return this.fetchHistoryKline({
      contract_code,
      period,
      size: size * mergeLength + macdParam[1],
    }).pipe(
      concatWith(this.websocketKLineClient.wsKline$(contract_code, period)),
      // kLineFactoryOperator(contract_code, mergeLength), // 本地合并k线 这个会丢失一些参数
      makeMacdObservable(macdParam),
      macdOperator(size),
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
   * 火币切换杠杆到 max
   */
  private SwitchLeverRate() {
    this.fetchSwapCrossAvailableLevelRate()
      .pipe(
        concatMap((x) => {
          const levelArrs = x.available_level_rate.split(',');

          return this.huobiServices
            .fetchSwapCrossSwitchLeverRate({
              contract_code: x.contract_code,
              lever_rate: Number(levelArrs.pop()),
            })
            .pipe(delay(5000));
        }),
      )
      .subscribe((x) => console.log(x, '切换杠杆到max'));
  }

  async test() {
    // 通用行情
    // this.huobiServices
    //   .fetchSwapContractInfo({})
    //   .subscribe((x) => console.log(x[0].contract_code, '获取合约信息'));
    // this.huobiServices
    //   .fetchSwapIndex()
    //   .subscribe((x) => console.log(x[0].index_price, '获取合约指数信息'));
    // this.huobiServices
    //   .fetchSwapPriceLimit()
    //   .subscribe((x) =>
    //     console.log(x[0].low_limit, '获取合约最高限价和最低限价'),
    //   );
    // this.huobiServices
    //   .fetchMarketHistoryKline({
    //     contract_code: 'BTC-USDT',
    //     period: '5min',
    //     size: 300,
    //   })
    //   .subscribe((x) => console.log(x, '获取K线数据'));
    // this.huobiServices
    //   .fetchSwapCrossAccountInfo()
    //   .subscribe((x) =>
    //     console.log(x[0].contract_detail[0].symbol, '获取用户账户信息'),
    //   );
    // this.huobiServices
    //   .fetchSwapCrossPositionInfo()
    //   .subscribe((x) => console.log(x, '获取用户持仓信息'));
    // this.huobiServices
    //   .fetchSwapCrossAvailableLevelRate()
    //   .subscribe((x) =>
    //     console.log(x[0].available_level_rate, '查询用户可用杠杆倍数'),
    //   );
    // // 多次下的限价单 不会合并，每个订单不管成交与否，都有一个订单号
    // this.huobiServices
    //   .fetchSwapCrossOrder({
    //     contract_code: 'SHIB-USDT',
    //     volume: '1',
    //     direction: 'buy',
    //     offset: 'open',
    //     lever_rate: 75,
    //     order_price_type: 'limit',
    //     price: '0.00000010',
    //   })
    //   .subscribe((x) => console.log(x, '合约下单'));
    // this.huobiServices
    //   .fetchSwapCrossCancel({
    //     contract_code: 'SHIB-USDT',
    //     order_id: '911217902437736448,911218052485218304,911218102917529600',
    //   })
    //   .subscribe((x) => console.log(x.errors, '撤销订单'));
    // this.huobiServices
    //   .fetchSwapCrossCancelAll({
    //     contract_code: 'SHIB-USDT',
    //   })
    //   .subscribe((x) => console.log(x, '全部撤单'));
    // this.huobiServices
    //   .fetchSwapCrossSwitchLeverRate({
    //     contract_code: 'SHIB-USDT',
    //     lever_rate: 75
    //   })
    //   .subscribe((x) => console.log(x, '切换杠杆'));
    // this.huobiServices
    //   .fetchSwapCrossOrderInfo({
    //     contract_code: 'SHIB-USDT',
    //     order_id: '911248744472121344',
    //   })
    //   .subscribe((x) => console.log(x, '获取合约订单信息'));
    // notificationWsClient
    //   .orders$()
    //   .subscribe((x) => console.log(x, '订阅订单成交数据'));
    // notificationWsClient
    //   .accounts$()
    //   .subscribe((x) => console.log(x[0], '订阅资产变动数据'));
    // notificationWsClient
    //   .positions$()
    //   .subscribe((x) => console.log(x, '持仓变动更新数据'));
    // notificationWsClient
    //   .matchOrders$()
    //   .subscribe((x) => console.log(x.price, '合约订单撮合数据'));
    // divideEquallyRx(-5, 5, 24).pipe(
    //   concatMap(nums => {
    //     const result = [];
    //     for (let i = 0; i < nums.length - 1; i++) {
    //       for (let j = i + 1; j < nums.length; j++) {
    //         result.push([nums[i], nums[j]]);
    //       }
    //     }
    //     return from(result);
    //   }),
    // ).subscribe((x) => console.log(x, '结果'));
    // divideEquallyRx(-13, -5, 24).subscribe((x) => console.log(x, '结果'));
    // divideEquallyRx(13, 25, 24).subscribe((x) => console.log(x, '结果'));
    // divideEquallyRx(0, 24, 24).subscribe((x) => console.log(x, '结果'));
    // divideEquallyRx(-24, 0, 24).subscribe((x) => console.log(x, '结果'));
  }
}

export default new HuobiStore();
