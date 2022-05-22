import { defer, map } from '@data-analysis/core';
import axios from '@data-analysis/utils/axios';
import { moment } from '@data-analysis/utils/index';

import xlsx from 'xlsx';

export class ShenZhenStockClient {
  constructor(private readonly apiUrl: string = 'https://www.szse.cn') {}

  /**
   * 深圳证券交易所 股票 list 数据
   * @returns []
   */
  fetchEquityData() {
    return this.callBufferApi(
      `/api/report/ShowReport?SHOWTYPE=xlsx&CATALOGID=1110&TABKEY=tab1`,
    ).pipe(
      map((x) => xlsx.read(x, { type: 'buffer' })),
      map((x) => xlsx.utils.sheet_to_json(x.Sheets[x.SheetNames[0]])),
    );
  }

  /**
   * 深圳证券交易所 可转债 list 数据
   * @returns []
   */
  fetchConvertibleBondData() {
    return this.callBufferApi(
      `/api/report/ShowReport?SHOWTYPE=xlsx&CATALOGID=1277&TABKEY=tab1&txtDate=${moment(
        new Date(new Date().setHours(-24)),
      ).format('YYYY-MM-DD')}`,
    ).pipe(
      map((x) => xlsx.read(x, { type: 'buffer' })),
      map((x) => xlsx.utils.sheet_to_json(x.Sheets[x.SheetNames[0]])),
    );
  }

  /**
   * 深圳证券交易所 基金 list 数据
   * @returns []
   */
  fetchFwrData() {
    return this.callBufferApi(
      `/api/report/ShowReport?SHOWTYPE=xlsx&CATALOGID=1105&TABKEY=tab1`,
    ).pipe(
      map((x) => xlsx.read(x, { type: 'buffer' })),
      map((x) => xlsx.utils.sheet_to_json(x.Sheets[x.SheetNames[0]])),
    );
  }

  /**
   * 深圳证券交易所 日k线 数据
   * @param begin 起始位置
   * @param end 结束位置
   * @returns
   */
  fetchDaykData(code: string) {
    return this.callApi(
      `/api/market/ssjjhq/getHistoryData?cycleType=32&marketId=1&code=${code}`,
    ).pipe(map((x) => x.data.picupdata));
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
   * url请求 请求 buffer 文件流
   * @param url string
   * @returns
   */
  private callBufferApi(url: string) {
    return defer(() =>
      axios
        .get(`${this.apiUrl}${this.splicingUrl(url)}`, {
          timeout: 10 * 1000,
          responseType: 'arraybuffer',
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
    return `${url}&random=${Math.random()}`;
  }
}
