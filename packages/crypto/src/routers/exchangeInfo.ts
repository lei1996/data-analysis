import KoaRouter from '@koa/router';
import { firstValueFrom, toArray } from '@data-analysis/core';

import binanceStore from '../store/binance';
import huobiStore from '../store/huobi';
import ftxStore from '../store/ftx';

// 交易对列表
const exchangeInfoRouter = new KoaRouter({
  prefix: '/exchangeInfo',
});

// 火币
exchangeInfoRouter.get('/huobi', async (ctx) => {
  ctx.body = await firstValueFrom(
    huobiStore.fetchSwapContractInfo({}).pipe(toArray()),
  );
});

// 币安
exchangeInfoRouter.get('/binance', async (ctx) => {
  ctx.body = await firstValueFrom(
    binanceStore.futuresExchangeInfo().pipe(toArray()),
  );
});

// ftx
exchangeInfoRouter.get('/ftx', async (ctx) => {
  ctx.body = await firstValueFrom(
    ftxStore.fetchAllFutures('PERP').pipe(toArray()),
  );
});

export default exchangeInfoRouter;
