import { BigSource } from '@data-analysis/core';
import { makeAutoObservable } from 'mobx';

interface KLineInterface {
  id: number; // 时间戳
  open: BigSource; // 开盘价
  close: BigSource; // 收盘价
  low: BigSource; // 最低价
  high: BigSource; // 最高价
  volume: BigSource; // 成交量
}

class KLineStore {
  private _map: Map<string, KLineInterface[]> = new Map();

  constructor() {
    makeAutoObservable(this);
  }

  // 新增一个交易对
  addItem(symbol: string, klines: KLineInterface[]) {
    this._map.set(symbol, klines);
  }

  // 移除某一个交易对
  remove(symbol: string) {
    if (!this.has(symbol)) return;

    this._map.delete(symbol);
  }

  // 修改某个交易对里面的所有k线
  update(symbol: string, kline: KLineInterface) {
    if (!this.has(symbol)) return;

    const klines = this.getKLineValue(symbol);

    // 如果是最后一个k线，则更新它
    if (klines[klines.length - 1].id === kline.id) {
      klines[klines.length - 1] = kline;
    } else {
      klines.push(kline);
    }

    this._map.set(symbol, klines);
  }

  // 查找交易对里面的k线
  find(symbol: string) {
    if (!this.has(symbol)) return [];

    return this.getKLineValue(symbol);
  }

  has(symbol: string) {
    return this._map.has(symbol);
  }

  /**
   * 获取map key里面的value值
   * @param symbol
   * @returns
   */
  getKLineValue(symbol: string) {
    return this._map.get(symbol) ?? [];
  }
}

export default new KLineStore();
