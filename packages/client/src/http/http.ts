import axios from 'axios';

import {
  BinancekLine,
  KLineBaseInterface,
} from '@data-analysis/types/kline.type';
import { spliceURL } from '@data-analysis/utils/spliceURL';
import {
  concatMap,
  defer,
  from,
  map,
  switchMap,
  toArray,
} from '@data-analysis/core';

export type CryptoSource = 'huobi' | 'binance' | 'ftx';

// 获取k线数据
export const fetchKlineData = (
  cryptoSource: CryptoSource,
  kline: BinancekLine,
) => {
  const param = spliceURL(kline);

  const share$ = defer(() =>
    axios.get(`/api/kline/${cryptoSource}${param}`).then((x) => x.data),
  );

  switch (cryptoSource) {
    case 'huobi':
      return share$;
    case 'binance':
      return share$;
    case 'ftx':
      return share$.pipe(
        concatMap((x: any[]) =>
          from(x).pipe(
            map((x) => ({ ...x, id: x.time })),
            toArray(),
          ),
        ),
      );

    default:
      return share$;
  }
};

// 获取用户账户信息
export const fetchUserData = (cryptoSource: CryptoSource) => {
  return defer(() =>
    axios
      .get(`/api/user/${cryptoSource}`)
      .then((x) => ({ data: x.data, cryptoSource })),
  );
};

// 获取用户账户信息
export const fetchAccountInfoData = (cryptoSource: CryptoSource) => {
  return defer(() =>
    axios
      .get(`/api/accountInfo/${cryptoSource}`)
      .then((x) => ({ data: x.data, cryptoSource })),
  );
};

// 获取交易对信息
export const fetchExchangeInfoData = (cryptoSource: CryptoSource) => {
  const share$ = defer(() =>
    axios
      .get(`/api/exchangeInfo/${cryptoSource}`)
      .then((x) => ({ data: x.data })),
  );

  switch (cryptoSource) {
    case 'huobi':
      return share$.pipe(
        switchMap((x) => from(x.data).pipe(map((x: any) => x.contract_code))),
      );
    case 'binance':
      return share$.pipe(
        switchMap((x) => from(x.data).pipe(map((x: any) => x.symbol))),
      );
    case 'ftx':
      return share$.pipe(
        switchMap((x) => from(x.data).pipe(map((x: any) => x.name))),
      );

    default:
      return share$.pipe(
        switchMap((x) => from(x.data).pipe(map((x: any) => x.contract_code))),
      );
  }
};

export const fetchChinaStockKLines = (params: {
  symbol: string;
  interval: number;
  limit: string;
}) => {
  const param = spliceURL(params);

  return defer(() => axios.get(`/api/kline/china${param}`).then((x) => x.data));
};
