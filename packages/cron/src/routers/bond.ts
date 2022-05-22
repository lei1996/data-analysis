import KoaRouter from '@koa/router';
import { firstValueFrom, toArray } from '@data-analysis/core';

import mainStore from '../store/main';

const bondRouter = new KoaRouter({
  prefix: '/bond',
});

// 获取上海交易所 债券 list 数据
bondRouter.get('/sh', async (ctx) => {
  const { begin, end }: any = ctx.request.query;

  ctx.body = await firstValueFrom(
    mainStore.fetchBondData(begin, end).pipe(toArray()), // 转成数组
  );
});

// 获取深圳交易所 可转债 list 数据
bondRouter.get('/sz', async (ctx) => {
  ctx.body = await firstValueFrom(
    mainStore.fetchSZConvertibleBondData().pipe(toArray()), // 转成数组
  );
});

export default bondRouter;
