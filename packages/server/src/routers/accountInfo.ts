import KoaRouter from '@koa/router';

import binanceStore from '../store/binance';
import huobiStore from '../store/huobi';
import ftxStore from '../store/ftx';

const accountInfoRouter = new KoaRouter({
  prefix: '/accountInfo',
});

// 火币
accountInfoRouter.get('/huobi', async (ctx) => {
  ctx.body = huobiStore.accountInfoLists;
});

// 币安
accountInfoRouter.get('/binance', async (ctx) => {
  ctx.body = binanceStore.accountInfoLists;
});

// ftx
accountInfoRouter.get('/ftx', async (ctx) => {
  ctx.body = ftxStore.userLists;
});

export default accountInfoRouter;
