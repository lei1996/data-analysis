import KoaRouter from '@koa/router';
import { Big, defer, firstValueFrom, toArray } from '@data-analysis/core';
import axios from '@data-analysis/utils/axios';

import binanceStore from '../store/binance';
import huobiStore from '../store/huobi';
import ftxStore from '../store/ftx';

const klineRouter = new KoaRouter({
  prefix: '/kline',
});

// 火币
klineRouter.get('/huobi', async (ctx) => {
  const { symbol, interval, limit, startTime, endTime }: any =
    ctx.request.query;

  const obj: any = {};

  if (!!limit) {
    obj['size'] = limit;
  }

  if (!!startTime) {
    obj['from'] = startTime;
  }

  if (!!endTime) {
    obj['to'] = endTime;
  }

  // 转成promise
  ctx.body = await firstValueFrom(
    huobiStore
      .fetchHistoryKline({
        contract_code: symbol,
        period: interval,
        ...obj,
      })
      .pipe(toArray()), // 转成数组
  );
});

// 币安
klineRouter.get('/binance', async (ctx) => {
  const { symbol, interval, limit, startTime, endTime }: any =
    ctx.request.query;

  const obj: any = {};

  if (!!limit) {
    obj['limit'] = limit;
  }

  if (!!startTime) {
    obj['startTime'] = new Big(startTime).times(1000).toString();
  }

  if (!!endTime) {
    obj['endTime'] = new Big(endTime).times(1000).toString();
  }

  // 转成promise
  ctx.body = await firstValueFrom(
    binanceStore
      .historyKLine({
        symbol,
        interval,
        ...obj,
      })
      .pipe(toArray()), // 转成数组
  );
});

// ftx
klineRouter.get('/ftx', async (ctx) => {
  const { symbol, interval, limit, startTime, endTime }: any =
    ctx.request.query;

  const obj: any = {};

  if (!!limit) {
    obj['limit'] = limit;
  }

  if (!!startTime) {
    obj['start_time'] = startTime;
  }

  if (!!endTime) {
    obj['end_time'] = endTime;
  }

  // 转成promise
  ctx.body = await firstValueFrom(
    ftxStore.fetchHistoryKLines({
      market_name: symbol,
      resolution: interval,
      ...obj,
    }),
  );
});

const syEnum = {
  '60': 'sh',
  '30': 'sz',
  '00': 'sz',
} as const;

type Sy = '60' | '00' | '00';

// china stock
klineRouter.get('/china', async (ctx) => {
  const { symbol, interval, limit, startTime, endTime }: any =
    ctx.request.query;

  const sy = symbol.slice(0, 2);
  const code = `${syEnum[sy as Sy]}${symbol}`;

  // 转成promise
  ctx.body = await firstValueFrom(
    defer(() =>
      axios
        .get(
          `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${code}&scale=${interval}&ma=240&datalen=${limit}`,
        )
        .then((x) => x.data),
    ),
  );
});

export default klineRouter;
