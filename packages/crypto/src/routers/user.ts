import KoaRouter from '@koa/router';
import { firstValueFrom } from '@data-analysis/core';

import binanceStore from '../store/binance';
import huobiStore from '../store/huobi';
import ftxStore from '../store/ftx';

const userRouter = new KoaRouter({
  prefix: '/user',
});

// 火币
userRouter.get('/huobi', async (ctx) => {
  // 永续 合约 账户金额
  const result = await firstValueFrom(huobiStore.fetchSwapCrossAccountInfo());

  ctx.body = result;
});

// 币安
userRouter.get('/binance', async (ctx) => {
  // 永续 合约 账户金额
  const result = await firstValueFrom(binanceStore.futuresUsdtBalance());

  ctx.body = result;
});

// ftx
userRouter.get('/ftx', async (ctx) => {
  // 永续 合约 账户金额
  const result = await firstValueFrom(ftxStore.fetchMainBalances());

  ctx.body = result;
});

export default userRouter;
