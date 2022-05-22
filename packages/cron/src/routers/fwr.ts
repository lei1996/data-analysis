import KoaRouter from '@koa/router';
import { filter, firstValueFrom, toArray } from '@data-analysis/core';

import mainStore from '../store/main';

const fwrRouter = new KoaRouter({
  prefix: '/fwr',
});

// 获取上海交易所 基金 list 数据
fwrRouter.get('/sh', async (ctx) => {
  const { begin, end }: any = ctx.request.query;

  ctx.body = await firstValueFrom(
    mainStore.fetchFwrData(begin, end).pipe(toArray()), // 转成数组
  );
});

// 获取深圳交易所 基金 详细 数据
fwrRouter.get('/sz/:id', async (ctx) => {
  ctx.body = await firstValueFrom(
    mainStore
      .fetchSZFwrData(false)
      .pipe(filter((x) => x.code === ctx.params.id)), // 转成数组
  );
});

// 获取深圳交易所 基金 list 数据
fwrRouter.get('/sz', async (ctx) => {
  ctx.body = await firstValueFrom(
    mainStore.fetchSZFwrData().pipe(toArray()), // 转成数组
  );
});

export default fwrRouter;
