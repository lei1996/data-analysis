import KoaRouter from '@koa/router';
import { firstValueFrom } from '@data-analysis/core';

import huobiStore from '../store/huobi';

const userRouter = new KoaRouter({
  prefix: '/user',
});

// 火币
userRouter.get('/', async (ctx) => {
  // 永续 合约 账户金额
  const result = await firstValueFrom(huobiStore.fetchSwapCrossAccountInfo());

  ctx.body = result;
});

export default userRouter;
