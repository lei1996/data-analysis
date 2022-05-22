import KoaRouter from '@koa/router';
import { firstValueFrom, toArray } from '@data-analysis/core';

import binanceStore from '../store/binance';
import huobiStore from '../store/huobi';

const klineRouter = new KoaRouter({
  prefix: '/kline',
});

// 火币
klineRouter.get('/huobi', async (ctx) => {
  const { contract_code, period, size, from, to }: any = ctx.request.query;

  // 转成promise
  ctx.body = await firstValueFrom(
    huobiStore
      .fetchHistoryKline({
        contract_code,
        period,
        size,
        from,
        to,
      })
      .pipe(toArray()), // 转成数组
  );
});

// 币安
klineRouter.get('/binance', async (ctx) => {
  const { symbol, interval, limit, startTime, endTime }: any =
    ctx.request.query;

  // 转成promise
  ctx.body = await firstValueFrom(
    binanceStore
      .historyKLine(symbol, interval, limit, startTime, endTime)
      .pipe(toArray()), // 转成数组
  );
});

export default klineRouter;
