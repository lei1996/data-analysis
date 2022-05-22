import KoaRouter from '@koa/router';
import { firstValueFrom, toArray } from '@data-analysis/core';

import mainStore from '../store/main';

const exponentRouter = new KoaRouter({
  prefix: '/exponent',
});

// 指数信息
exponentRouter.get('/', async (ctx) => {
  const { begin, end }: any = ctx.request.query;

  ctx.body = await firstValueFrom(
    mainStore.fetchIndexData(begin, end).pipe(toArray()), // 转成数组
  );
});

export default exponentRouter;
