import { defer } from '@data-analysis/core';
import axios from '@data-analysis/utils/axios';

export class ShanghaiStockClient {
  constructor(
    private readonly apiUrl: string = 'http://yunhq.sse.com.cn:32041/v1/sh1',
  ) {}

  /**
   * 上海证券交易所 股票 list 数据
   * @param begin 起始位置
   * @param end 结束位置
   * @returns
   */
  fetchEquityData(begin: number = 0, end: number = 9999999) {
    return this.callApi(
      `/list/exchange/equity?select=code,name&begin=${begin}&end=${end}`,
    );
  }

  /**
   * 上海证券交易所 基金 list 数据
   * @param begin 起始位置
   * @param end 结束位置
   * @returns
   */
  fetchFwrData(begin: number = 0, end: number = 9999999) {
    return this.callApi(
      `/list/exchange/fwr?select=code,name&begin=${begin}&end=${end}`,
    );
  }

  /**
   * 上海证券交易所 债券 list 数据
   * @param begin 起始位置
   * @param end 结束位置
   * @returns
   */
  fetchBondData(begin: number = 0, end: number = 9999999) {
    return this.callApi(
      `/list/exchange/bond?select=code,name&begin=${begin}&end=${end}`,
    );
  }

  /**
   * 上海证券交易所 指数 list 数据
   * @param begin 起始位置
   * @param end 结束位置
   * @returns
   */
  fetchIndexData(begin: number = 0, end: number = 9999999) {
    return this.callApi(
      `/list/exchange/index?select=code,name&begin=${begin}&end=${end}`,
    );
  }

  /**
   * 上海证券交易所 日k线 数据
   * @param begin 起始位置
   * @param end 结束位置
   * @returns
   */
  fetchDaykData(code: string, begin: number = -50, end: number = -1) {
    return this.callApi(
      `/dayk/${code}?select=date,open,high,low,close,volume&begin=${begin}&end=${end}`,
    );
  }

  /**
   * url请求
   * @param url string
   * @returns
   */
  private callApi(url: string) {
    return defer(() =>
      axios
        .get(`${this.apiUrl}${this.splicingUrl(url)}`, {
          timeout: 10 * 1000,
        })
        .then((x) => x.data),
    );
  }

  /**
   * 去除浏览器缓存
   * @param url 接口url 不带时间戳
   * @returns
   */
  private splicingUrl(url: string) {
    return `${url}&_=${new Date().getTime()}`;
  }
}
