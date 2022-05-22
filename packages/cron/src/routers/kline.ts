import KoaRouter from '@koa/router';
import { firstValueFrom, toArray } from '@data-analysis/core';

import mainStore from '../store/main';

const klineRouter = new KoaRouter({
  prefix: '/kline',
});

// 上海证券交易所 历史k线
klineRouter.get('/sh', async (ctx) => {
  const { code, begin, end }: any = ctx.request.query;

  ctx.body = await firstValueFrom(
    mainStore.fetchSHDaykLine(code, begin, end).pipe(toArray()), // 转成数组
  );
});

// 深圳证券交易所 历史k线
klineRouter.get('/sz', async (ctx) => {
  const { code }: any = ctx.request.query;

  ctx.body = await firstValueFrom(
    mainStore.fetchSZDaykLine(code).pipe(toArray()), // 转成数组
  );
});

export default klineRouter;
