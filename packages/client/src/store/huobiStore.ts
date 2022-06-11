import axios from 'axios';

import { defer, map, of, pipe, switchMap } from '@data-analysis/core';
import { SwapCrossAccountInfoResultInterface } from '@data-analysis/crypto-huobi/src/types';
import { makeAutoObservable } from 'mobx';
import { spliceURL } from '@data-analysis/utils/spliceURL';

// 用户权益
export function huobiUserDataPipe() {
  return pipe(
    switchMap((x: SwapCrossAccountInfoResultInterface) =>
      of({
        margin_balance: x.margin_balance,
        withdraw_available: x.withdraw_available,
      }),
    ),
  );
}

interface KLineParamsInterface {
  symbol: string; // 交易对
  interval: string; // 时间间隔
  limit: string; // k线长度
  startTime?: string; // 开始时间
  endTime?: string; // 结束时间
}

class HuobiStore {
  // 火币 socket url
  socketUrl: string = 'wss://api.hbdm.vn/linear-swap-ws';
  // 当前交易对的配置信息
  currTard: KLineParamsInterface = {
    symbol: 'BTC-USDT',
    interval: '1min',
    limit: '300'
  };

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * 请求k线数据
   * @param kline k线入参
   * @returns
   */
  fetchKLine(kline: KLineParamsInterface) {
    return defer(() =>
      axios.get(`/api/kline/huobi${spliceURL(kline)}`).then((x) => x.data),
    );
  }

  /**
   * 获取所有交易对信息
   * @param
   * @returns
   */
  fetchExchangeInfoData() {
    return defer(() =>
      axios.get('/api/exchangeInfo/huobi').then((x) => x.data),
    );
  }
}

export default new HuobiStore();
