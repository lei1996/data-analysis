import KoaRouter from '@koa/router';

import mainStore from '../store/main';

const klineRouter = new KoaRouter({
  prefix: '/kline',
});

// 火币
klineRouter.get('/huobi', async (ctx) => {
  ctx.body = mainStore.sayHello();
});

export default klineRouter;
