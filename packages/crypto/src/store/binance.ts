import {
  delay,
  mergeMap,
  concatAll,
  filter,
  map,
  Big,
  concatMap,
  from,
  groupBy,
  reduce,
} from '@data-analysis/core';

import {
  BinanceClient,
  Candle,
  CandleChartResult,
  CandlesOptions,
  PositionRiskResult,
} from '@data-analysis/crypto-binance';
import { timeBinance } from '@data-analysis/utils';
import { BinanceKLineInterface } from '@data-analysis/types/kline.type';

class BinanceStore {
  // 初始化期货
  private binanceServices: BinanceClient = new BinanceClient('', '');

  constructor() {}

  /**
   * 获取历史k线
   * @param symbol
   * @param interval
   * @param limit
   * @returns
   */
  historyKLine(params: CandlesOptions) {
    return this.binanceServices.historyKLine(params).pipe(
      concatMap((x) => from(x)),
      filter(
        (item) =>
          new Date().getTime() - item.openTime >= timeBinance[params.interval],
      ),
      map((x: CandleChartResult) =>
        this.transKLineData(x, x.openTime, params.symbol),
      ),
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
}

export default new BinanceStore();
