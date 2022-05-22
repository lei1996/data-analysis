import {
  NewOrderReq,
  ModifyOrderReq,
  RestClient,
  HistoricalPricesReq,
} from 'ftx-api';
import { defer } from '@data-analysis/core';
import { RestClientOptions } from 'ftx-api/lib/util/requestUtils';

export class FtxHttpClient {
  private client;

  constructor(
    accessKey: string,
    secretKey: string,
    restClientOptions?: RestClientOptions,
  ) {
    this.client = new RestClient(accessKey, secretKey, restClientOptions);
  }

  /**
   * 查询主账户余额
   * @returns
   */
  fetchMainBalances() {
    return defer(() => this.client.getBalances());
  }

  /**
   * 查询子账户余额
   * @returns
   */
  fetchSubBalances(accountName: string) {
    return defer(() => this.client.getSubaccountBalances(accountName));
  }

  /**
   * 提交新订单
   * @param params
   * @returns
   */
  fetchOrder(params: NewOrderReq) {
    return defer(() => this.client.placeOrder(params));
  }

  /**
   * 撤销订单
   * @param params
   * @returns
   */
  fetchCancelOrder(orderId: string) {
    return defer(() => this.client.cancelOrder(orderId));
  }

  /**
   * 获取订单状态
   * @param params
   * @returns
   */
  fetchOrderStatus(orderId: string) {
    return defer(() => this.client.getOrderStatus(orderId));
  }

  /**
   * 修改订单
   * @param params
   * @returns
   */
  fetchModifyOrder(params: ModifyOrderReq) {
    return defer(() => this.client.modifyOrder(params));
  }

  /**
   * 获取所有类型市场
   */
  fetchMarkets() {
    return defer(() => this.client.getMarkets());
  }

  /**
   * 获取所有期货列表
   */
  fetchAllFutures() {
    return defer(() => this.client.listAllFutures());
  }

  /**
   * 获取历史k线数据
   */
  fetchHistoryKLines(params: HistoricalPricesReq) {
    return defer(() => this.client.getHistoricalPrices(params));
  }

  /**
   * 获取当前仓位
   */
  fetchOpenOrders() {
    return defer(() => this.client.getOpenOrders());
  }

  /**
   * 获取当前仓位
   */
  fetchPositions() {
    return defer(() => this.client.getPositions());
  }
}
