import KoaRouter from '@koa/router';
import { firstValueFrom, toArray } from '@data-analysis/core';

import mainStore from '../store/main';

const listRouter = new KoaRouter({
  prefix: '/list',
});

// // 所有数据最新数据
// listRouter.get('/', async (ctx) => {
//   ctx.body = mainStore.getMapValue(mainStore.lastTime);
// });

// 上海证券交易所
listRouter.get('/sh', async (ctx) => {
  ctx.body = mainStore.getMapValue(mainStore.lastTime).sh;
});

// 上海证券交易所
listRouter.get('/sh:date', async (ctx) => {
  ctx.body = mainStore.getMapValue(ctx.params.date);
});

// 深圳证券交易所
listRouter.get('/sz', async (ctx) => {
  ctx.body = mainStore.getMapValue(mainStore.lastTime).sz;
});

// 深圳证券交易所
listRouter.get('/sz:date', async (ctx) => {
  ctx.body = mainStore.getMapValue(ctx.params.date);
});

export default listRouter;
