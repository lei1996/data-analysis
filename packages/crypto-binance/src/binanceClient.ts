import Binance, {
  AccountUpdate,
  Candle,
  CandleChartInterval_LT,
  CandleChartResult,
  CandlesOptions,
  ExchangeInfo,
  ExecutionReport,
  OrderSide_LT,
  OrderType_LT,
  OrderUpdate,
  OutboundAccountInfo,
  PartialDepth,
  PositionSide_LT,
  UniversalTransfer,
} from 'binance-api-node';
import {
  catchError,
  concatAll,
  concatMap,
  defer,
  filter,
  from,
  map,
  Observable,
  of,
  retry,
} from '@data-analysis/core';
import { BinanceKLineInterface } from '@data-analysis/types/kline.type';
import { timeBinance } from '@data-analysis/utils';

type infoType = '开多' | '开空' | '平多' | '平空';

interface orderParamInterface {
  side: OrderSide_LT;
  positionSide: PositionSide_LT;
}

// http://localhost:7777/order?symbol=BTCUSDT&side=BUY&positionSide=LONG&type=MARKET&quantity=0.001 // 开多
// http://localhost:7777/order?symbol=BTCUSDT&side=SELL&positionSide=LONG&type=MARKET&quantity=0.001 // 平空
// http://localhost:7777/order?symbol=BTCUSDT&side=SELL&positionSide=SHORT&type=MARKET&quantity=0.001 // 开空
// http://localhost:7777/order?symbol=BTCUSDT&side=BUY&positionSide=SHORT&type=MARKET&quantity=0.001 // 平多
const orderParams = (info: infoType) => {
  switch (info) {
    case '开多':
      return {
        side: 'BUY',
        positionSide: 'LONG',
      } as orderParamInterface;
    case '平空':
      return {
        side: 'SELL',
        positionSide: 'LONG',
      } as orderParamInterface;
    case '开空':
      return {
        side: 'SELL',
        positionSide: 'SHORT',
      } as orderParamInterface;
    case '平多':
      return {
        side: 'BUY',
        positionSide: 'SHORT',
      } as orderParamInterface;

    default:
      return {} as orderParamInterface;
  }
};

export class BinanceClient {
  private client;

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    private readonly httpFutres?: string,
  ) {
    this.client = Binance({
      apiKey: this.apiKey,
      apiSecret: this.apiSecret,
      httpFutures: this.httpFutres,
    });
  }

  /**
   * 获取 usdt合约 历史K线
   * @param symbol
   * @param interval
   * @param limit
   * @returns
   */
  historyKLine(params: CandlesOptions) {
    return defer(() => this.client.futuresCandles(params));
  }

  /**
   * 期货 k线订阅
   * @param symbol
   * @param interval
   * @returns
   */
  wskLine(symbol: string, interval: CandleChartInterval_LT) {
    return new Observable<Candle>((subscribe) => {
      const clean = this.client.ws.futuresCandles(
        symbol,
        interval,
        (candle) => {
          subscribe.next(candle);
        },
      );

      return () => {
        clean();
      };
    });
  }

  /**
   * 期货局部深度
   * @param options
   * @returns
   */
  futuresPartialDepth(options: { symbol: string; level: number }) {
    const observer$ = new Observable<PartialDepth>((subscribe) => {
      const clean = this.client.ws.futuresPartialDepth(options, (depth) => {
        subscribe.next(depth);
      });

      return () => {
        clean();
      };
    });
    return observer$;
  }

  /**
   * 用户相关数据 需要鉴权
   * @returns
   */
  futuresUser() {
    return new Observable<
      OutboundAccountInfo | ExecutionReport | AccountUpdate | OrderUpdate
    >((subscribe) => {
      this.client.ws.futuresUser((msg) => {
        subscribe.next(msg);
      });
    });
  }

  /**
   *
   * @returns
   */
  marginUser() {
    return new Observable<OutboundAccountInfo | ExecutionReport>(
      (subscribe) => {
        this.client.ws.marginUser((msg) => {
          subscribe.next(msg);
        });
      },
    );
  }

  /**
   * 开仓平仓
   * @param info: infoType
   * @param symbol
   * @param quantity
   * @returns
   */
  order(params: {
    info: infoType;
    symbol: string;
    orderType: OrderType_LT;
    quantity: string;
    price?: number;
  }) {
    const { info, symbol, orderType, quantity = '0.001', price } = params;
    const orderParam: any = orderParams(info);

    if (!!price) {
      orderParam.price = price;
    }

    return defer(() =>
      this.client.futuresOrder({
        symbol: symbol,
        type: orderType,
        quantity: quantity,
        ...orderParam,
        // recvWindow: 60 * 1000,
      }),
    ).pipe(
      retry(3),
      catchError((err) => {
        console.error(
          err,
          `binance 下单失败. 品种：${symbol}, 开平仓: ${info}, 数量: ${quantity}`,
        );
        return of();
      }),
    );
  }

  /**
   * 未知待测试
   * @param info: infoType
   * @param symbol
   * @param quantity
   * @returns
   */
  futuresOpenOrders() {
    return defer(() => this.client.futuresOpenOrders({}));
  }

  /**
   * 获取杠杆信息.
   * @returns
   */
  futuresLeverageBracket() {
    return defer(() => this.client.futuresLeverageBracket()).pipe(
      concatAll(),
      filter((x) => x.symbol.includes('USDT') && !x.symbol.includes('_')),
    );
  }

  /**
   * 调整期货杠杆到 max
   * @returns
   */
  changeFuturesLeverage() {
    return this.futuresLeverageBracket().pipe(
      concatMap((x) =>
        defer(() =>
          this.client.futuresLeverage({
            symbol: x.symbol,
            leverage: x.brackets[0].initialLeverage,
          }),
        ).pipe(catchError(() => of())),
      ),
    );
  }

  /**
   * 获取当前交易所的usdt合约的活动的交易对 并获取最小开仓数量.
   * @returns
   */
  futuresExchangeInfo() {
    return defer(() => this.client.futuresExchangeInfo()).pipe(
      concatMap((x: ExchangeInfo) => from(x.symbols)),
      filter(
        (x) =>
          x.symbol.includes('USDT') &&
          !x.symbol.includes('_') &&
          x.status === 'TRADING',
      ), // 过滤 usdt 交易对和 处在交易的合约.
      map((x: any) => ({
        symbol: x.symbol,
        quantityPrecision: x.quantityPrecision, // 系统设定的数量精度
        pricePrecision: x.pricePrecision, // 价格精度
        marketFilters: x.filters.filter(
          (x: any) => x.filterType === 'MARKET_LOT_SIZE',
        )[0],
        minNotionalFilters: x.filters.filter(
          (x: any) => x.filterType === 'MIN_NOTIONAL',
        )[0],
      })),
    );
  }

  /**
   * 期货 usdt 余额
   * @returns
   */
  futuresBalance() {
    return defer(() => this.client.futuresAccountBalance());
  }

  /**
   * 期货 账户 信息
   * @returns
   */
  futuresAccountInfo() {
    return defer(() => this.client.futuresAccountInfo());
  }

  /**
   * 用户万向划转
   * fromSymbol 必须要发送，当类型为 ISOLATEDMARGIN_MARGIN 和 ISOLATEDMARGIN_ISOLATEDMARGIN
   * toSymbol 必须要发送，当类型为 MARGIN_ISOLATEDMARGIN 和 ISOLATEDMARGIN_ISOLATEDMARGIN
   *
   * 目前支持的type划转类型:
   * MAIN_UMFUTURE 现货钱包转向U本位合约钱包
   *
   * MAIN_CMFUTURE 现货钱包转向币本位合约钱包
   *
   * MAIN_MARGIN 现货钱包转向杠杆全仓钱包
   *
   * MAIN_MINING 现货钱包转向矿池钱包
   *
   * UMFUTURE_MAIN U本位合约钱包转向现货钱包
   *
   * UMFUTURE_MARGIN U本位合约钱包转向杠杆全仓钱包
   *
   * CMFUTURE_MAIN 币本位合约钱包转向现货钱包
   *
   * MARGIN_MAIN 杠杆全仓钱包转向现货钱包
   *
   * MARGIN_UMFUTURE 杠杆全仓钱包转向U本位合约钱包
   *
   * MINING_MAIN 矿池钱包转向现货钱包
   *
   * MINING_UMFUTURE 矿池钱包转向U本位合约钱包
   *
   * MARGIN_CMFUTURE 杠杆全仓钱包转向币本位合约钱包
   *
   * CMFUTURE_MARGIN 币本位合约钱包转向杠杆全仓钱包
   *
   * MARGIN_MINING 杠杆全仓钱包转向矿池钱包
   *
   * MINING_MARGIN 矿池钱包转向杠杆全仓钱包
   *
   * ISOLATEDMARGIN_MARGIN 杠杆逐仓钱包转向杠杆全仓钱包
   *
   * MARGIN_ISOLATEDMARGIN 杠杆全仓钱包转向杠杆逐仓钱包
   *
   * ISOLATEDMARGIN_ISOLATEDMARGIN 杠杆逐仓钱包转向杠杆逐仓钱包
   *
   * MAIN_FUNDING 现货钱包转向资金钱包
   *
   * FUNDING_MAIN 资金钱包转向现货钱包
   *
   * FUNDING_UMFUTURE 资金钱包转向U本位合约钱包
   *
   * UMFUTURE_FUNDING U本位合约钱包转向资金钱包
   *
   * MARGIN_FUNDING 杠杆全仓钱包转向资金钱包
   *
   * FUNDING_MARGIN 资金钱包转向杠杆全仓钱包
   *
   * FUNDING_CMFUTURE 资金钱包转向币本位合约钱包
   *
   * CMFUTURE_FUNDING 币本位合约钱包转向资金钱包
   *
   * @returns
   */
  universalTransfer(options: UniversalTransfer) {
    return defer(() => this.client.universalTransfer(options));
  }

  /**
   * 期货 仓位 杠杆 信息
   * @returns
   */
  futuresPositionRisk() {
    return defer(() =>
      this.client.futuresPositionRisk({
        recvWindow: 10000,
      }),
    );
  }

  /**
   * 期货当前的最新价
   * @returns
   */
  futuresPrices() {
    return defer(() => this.client.futuresPrices());
  }

  /**
   * 期货更改持仓方式
   * @returns
   */
  futuresPositionModeChange() {
    return defer(() =>
      this.client
        .futuresPositionModeChange({
          dualSidePosition: 'true',
          recvWindow: 5000,
        })
        .catch((err) => console.log(err, '期货更改持仓方式报错')),
    );
  }
}
