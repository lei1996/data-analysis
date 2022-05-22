import { filter, map, concatMap, from } from '@data-analysis/core';
import { HuobiHttpClient } from '@data-analysis/crypto-huobi';

import server from '@data-analysis/config/server';
import {
  SwapCrossCancelInterface,
  MarketHistoryKlineInterface,
  SwapContractInfoInterface,
  SwapCrossOrderInterface,
  SwapCrossOrderInfoInterface,
} from '@data-analysis/crypto-huobi/src/types';

class HuobiStore {
  private huobiServices: HuobiHttpClient;

  constructor() {
    // 初始化 Http Client
    this.huobiServices = new HuobiHttpClient(server.huobi.apiBaseUrl, {
      accessKey: '',
      secretKey: '',
    });
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
}

export default new HuobiStore();
