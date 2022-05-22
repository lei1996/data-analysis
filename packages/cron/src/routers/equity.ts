import KoaRouter from '@koa/router';
import { firstValueFrom, toArray } from '@data-analysis/core';

import mainStore from '../store/main';

const equityRouter = new KoaRouter({
  prefix: '/equity',
});

// 获取上海交易所 股票 list 数据
equityRouter.get('/sh', async (ctx) => {
  const { begin, end }: any = ctx.request.query;

  ctx.body = await firstValueFrom(
    mainStore.fetchSHEquityData(begin, end).pipe(toArray()), // 转成数组
  );
});

// 获取深圳交易所 股票 list 数据
equityRouter.get('/sz', async (ctx) => {
  ctx.body = await firstValueFrom(
    mainStore.fetchSZEquityData().pipe(toArray()), // 转成数组
  );
});

export default equityRouter;
