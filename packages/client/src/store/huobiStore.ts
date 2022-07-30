import axios from 'axios';

import {
  concatMap,
  defer,
  filter,
  from,
  map,
  Observable,
  of,
  pipe,
  switchMap,
  toArray,
} from '@data-analysis/core';
import {
  SwapContractInfoResultInterface,
  SwapCrossAccountInfoResultInterface,
} from '@data-analysis/crypto-huobi/src/types';
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
  limit?: string; // k线长度
  startTime?: string; // 开始时间
  endTime?: string; // 结束时间
}

class HuobiStore {
  // 火币 socket url
  socketUrl: string = 'wss://api.hbdm.vn/linear-swap-ws';
  // 当前交易对的配置信息
  currTard: KLineParamsInterface = {
    symbol: 'BTC-USDT',
    interval: '15min',
    limit: '300',
  };

  exLists: Array<string> = [];
  intervalLists = ['1min', '5min', '15min', '30min', '60min', '4hour'];


  constructor() {
    makeAutoObservable(this);
    this.onLoad();
  }

  onLoad() {
    this.fetchExchangeInfoData()
      .pipe(
        concatMap((items) =>
          from(items).pipe(
            filter((x) => x.contract_status === 1),
            map((x) => x.contract_code),
            toArray(),
          ),
        ),
      )
      .subscribe((x) => {
        this.exLists = x;
      });
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
  fetchExchangeInfoData(): Observable<SwapContractInfoResultInterface[]> {
    return defer(() =>
      axios.get('/api/exchangeInfo/huobi').then((x) => x.data),
    );
  }
}

export default new HuobiStore();
