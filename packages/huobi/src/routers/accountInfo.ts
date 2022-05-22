import KoaRouter from '@koa/router';

import huobiStore from '../store/huobi';

const accountInfoRouter = new KoaRouter({
  prefix: '/accountInfo',
});

// 火币
accountInfoRouter.get('/', async (ctx) => {
  ctx.body = huobiStore.accountInfoLists;
});

export default accountInfoRouter;
