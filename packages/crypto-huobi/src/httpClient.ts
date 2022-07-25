import {
  concatMap,
  defer,
  filter,
  from,
  Observable,
} from '@data-analysis/core';
import {
  HuoBiKLineInterface,
  MarketHistoryKlineInterface,
  SwapContractInfoInterface,
  SwapContractInfoResultInterface,
  SwapCrossAccountInfoResultInterface,
  SwapCrossAvailableLevelRateResultInterface,
  SwapCrossCancelAllInterface,
  SwapCrossCancelInterface,
  SwapCrossCancelResultInterface,
  SwapCrossOrderInfoInterface,
  SwapCrossOrderInfoResultInterface,
  SwapCrossOrderInterface,
  SwapCrossOrderResultInterface,
  SwapCrossPositionInfoResultInterface,
  SwapCrossSwitchLeverRateInterface,
  SwapCrossSwitchLeverRateResultInterface,
  SwapIndexResultInterface,
  SwapPriceLimitResultInterface,
} from './types/httpClient';

import { HbApi } from 'huobi-api-js';
import { timeHuobi } from '@data-analysis/utils';

export class HuobiHttpClient {
  private client;

  constructor(
    private readonly apiBaseUrl: string,
    private readonly profileConfig: {
      accessKey: string;
      secretKey: string;
    },
  ) {
    this.client = new HbApi({
      apiBaseUrl: this.apiBaseUrl,
      profileConfig: this.profileConfig,
    });
  }

  // -------------------------------------- 市场行情接口 --------------------------------------
  /**
   * [通用] 获取合约信息
   * @param info
   * @returns
   */
  fetchSwapContractInfo(
    info: SwapContractInfoInterface,
  ): Observable<SwapContractInfoResultInterface[]> {
    return defer(() =>
      this.client.restApi({
        path: `/linear-swap-api/v1/swap_contract_info`,
        method: 'GET',
        query: { ...info },
      }),
    );
  }

  /**
   * [通用] 获取合约指数信息
   * @param contract_code 合约品种名称: "BTC-USDT"
   * @returns
   */
  fetchSwapIndex(
    contract_code?: string,
  ): Observable<SwapIndexResultInterface[]> {
    return defer(() =>
      this.client.restApi({
        path: `/linear-swap-api/v1/swap_index`,
        method: 'GET',
        query: { contract_code },
      }),
    );
  }

  /**
   * [通用] 获取合约最高限价和最低限价
   * @param contract_code 合约品种名称: "BTC-USDT"
   * @returns
   */
  fetchSwapPriceLimit(
    contract_code?: string,
  ): Observable<SwapPriceLimitResultInterface[]> {
    return defer(() =>
      this.client.restApi({
        path: `/linear-swap-api/v1/swap_price_limit`,
        method: 'GET',
        query: { contract_code },
      }),
    );
  }

  /**
   * [通用] 获取K线数据
   * @param info
   * @returns
   */
  fetchMarketHistoryKline(
    info: MarketHistoryKlineInterface,
  ): Observable<HuoBiKLineInterface[]> {
    return defer(() =>
      this.client.restApi({
        path: `/linear-swap-ex/market/history/kline`,
        method: 'GET',
        query: { ...info },
      }),
    );
  }

  // -------------------------------------- 资产相关接口 --------------------------------------
  /**
   * [全仓] 获取用户账户信息
   * @param margin_account  保证金账户，不填则返回所有全仓保证金账户	"USDT"，目前只有一个全仓账户（USDT）
   * @returns
   */
  fetchSwapCrossAccountInfo(
    margin_account?: string,
  ): Observable<SwapCrossAccountInfoResultInterface[]> {
    return defer(() =>
      this.client.restApi({
        path: `/linear-swap-api/v1/swap_cross_account_info`,
        method: 'POST',
        body: { margin_account },
      }),
    );
  }

  /**
   * [全仓] 获取用户持仓信息
   * @param contract_code 合约代码	"BTC-USDT"... ,如果缺省，默认返回所有合约
   * @returns
   */
  fetchSwapCrossPositionInfo(
    contract_code?: string,
  ): Observable<SwapCrossPositionInfoResultInterface[]> {
    return defer(() =>
      this.client.restApi({
        path: `/linear-swap-api/v1/swap_cross_position_info`,
        method: 'POST',
        body: { contract_code },
      }),
    );
  }

  /**
   * [全仓] 查询用户可用杠杆倍数
   * @param contract_code 合约代码. 不填默认返回所有支持全仓的合约的实际可用杠杆倍数 比如："BTC-USDT"...
   * @returns
   */
  fetchSwapCrossAvailableLevelRate(
    contract_code?: string,
  ): Observable<SwapCrossAvailableLevelRateResultInterface[]> {
    return defer(() =>
      this.client.restApi({
        path: `/linear-swap-api/v1/swap_cross_available_level_rate`,
        method: 'POST',
        body: { contract_code },
      }),
    );
  }

  // -------------------------------------- 交易相关接口 --------------------------------------
  /**
   * [全仓] 合约下单
   * @param info
   * @returns
   */
  fetchSwapCrossOrder(
    info: SwapCrossOrderInterface,
  ): Observable<SwapCrossOrderResultInterface> {
    return defer(() =>
      this.client.restApi({
        path: `/linear-swap-api/v1/swap_cross_order`,
        method: 'POST',
        body: { ...info },
      }),
    );
  }

  /**
   * [全仓] 撤销订单
   * @param info
   * @returns
   */
  fetchSwapCrossCancel(
    info: SwapCrossCancelInterface,
  ): Observable<SwapCrossCancelResultInterface> {
    return defer(() =>
      this.client.restApi({
        path: `/linear-swap-api/v1/swap_cross_cancel`,
        method: 'POST',
        body: { ...info },
      }),
    );
  }

  /**
   * [全仓] 全部撤单
   * @param info
   * @returns
   */
  fetchSwapCrossCancelAll(
    info: SwapCrossCancelAllInterface,
  ): Observable<SwapCrossCancelResultInterface> {
    return defer(() =>
      this.client.restApi({
        path: `/linear-swap-api/v1/swap_cross_cancelall`,
        method: 'POST',
        body: { ...info },
      }),
    );
  }

  /**
   * [全仓] 切换杠杆
   * @param info
   * @returns
   */
  fetchSwapCrossSwitchLeverRate(
    info: SwapCrossSwitchLeverRateInterface,
  ): Observable<SwapCrossSwitchLeverRateResultInterface> {
    return defer(() =>
      this.client.restApi({
        path: `/linear-swap-api/v1/swap_cross_switch_lever_rate`,
        method: 'POST',
        body: { ...info },
      }),
    );
  }

  /**
   * [全仓] 获取合约订单信息
   * @param info
   * @returns
   */
  fetchSwapCrossOrderInfo(
    info: SwapCrossOrderInfoInterface,
  ): Observable<SwapCrossOrderInfoResultInterface[]> {
    return defer(() =>
      this.client.restApi({
        path: `/linear-swap-api/v1/swap_cross_order_info`,
        method: 'POST',
        body: { ...info },
      }),
    );
  }
}
