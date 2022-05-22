import {
  catchError,
  concatMap,
  filter,
  from,
  map,
  of,
} from '@data-analysis/core';
import { FtxHttpClient } from '@data-analysis/crypto-ftx';

import {
  NewOrderReq,
  ModifyOrderReq,
  HistoricalPricesReq,
} from '@data-analysis/crypto-ftx/src/types/httpClient';

class FtxStore {
  private httpClient: FtxHttpClient;

  constructor() {
    this.httpClient = new FtxHttpClient('', '');
  }

  /**
   * 主账户权益
   * @returns
   */
  fetchMainBalances() {
    return this.httpClient.fetchMainBalances().pipe(
      filter((x) => x.success),
      map((x) => x.result),
    );
  }

  /**
   * 获取所有期货列表 - 允许过滤参数
   * @returns
   */
  fetchAllFutures(filterName: string) {
    return this.httpClient.fetchAllFutures().pipe(
      filter((x) => x.success),
      concatMap((x) =>
        from(x.result).pipe(
          filter((x) => x.name.includes(filterName) && x.enabled),
        ),
      ),
    );
  }

  /**
   * 获取k线数据
   * @returns
   */
  fetchHistoryKLines(params: HistoricalPricesReq) {
    return this.httpClient.fetchHistoryKLines(params).pipe(
      filter((x) => x.success),
      map((x) => x.result),
    );
  }

  /**
   * 提交新订单
   * @returns
   */
  fetchOrder(newOrder: NewOrderReq) {
    return this.httpClient.fetchOrder(newOrder).pipe(
      filter((x) => x.success),
      map((x) => x.result),
    );
  }

  /**
   * 获取订单状态
   * @returns
   */
  fetchOrderStatus(orderId: string) {
    return this.httpClient.fetchOrderStatus(orderId).pipe(
      filter((x) => x.success),
      map((x) => x.result),
    );
  }

  /**
   * 撤销订单
   * @returns
   */
  fetchCancelOrder(orderId: string) {
    return this.httpClient
      .fetchCancelOrder(orderId)
      .pipe(filter((x) => x.success));
  }

  /**
   * 修改订单
   * @returns
   */
  fetchModifyOrder(params: ModifyOrderReq) {
    return this.httpClient.fetchModifyOrder(params).pipe(
      filter((x) => x.success),
      map((x) => x.result),
    );
  }

  /**
   * 获取当前仓位 ??
   * @returns
   */
  fetchOpenOrders() {
    return this.httpClient.fetchOpenOrders().pipe(
      filter((x) => x.success),
      map((x) => x.result),
    );
  }

  /**
   * 获取当前仓位
   * @returns
   */
  fetchPositions() {
    return this.httpClient.fetchPositions().pipe(
      filter((x) => x.success),
      concatMap((x) =>
        from(x.result).pipe(
          map((x) => ({
            future: x.future,
            size: x.size,
            side: x.side,
          })),
        ),
      ),
    );
  }

  /**
   * 提交新订单 - 自动重新挂单
   * @param newOrder
   * @param delayTime
   */
  fetchNewOrder(symbol: string, info: string, size: number, price: number) {
    const orderParams: NewOrderReq = {
      market: symbol,
      side: info.includes('多') ? 'buy' : 'sell',
      price: price,
      reduceOnly: info.includes('开') ? false : true,
      type: 'limit',
      size: size,
    };

    return this.fetchOrder(orderParams).pipe(
      catchError((err) => {
        console.error(err, 'ftx 提交新订单 报错');
        return of();
      }),
    );
  }
}

export default new FtxStore();
