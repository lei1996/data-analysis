import Koa from 'koa';
import KoaLogger from 'koa-logger';
import cors from '@koa/cors';
import routers from './routers';

import { cron } from './tasks/cron';

const app = new Koa();

app.use(KoaLogger());
app.use(cors());

routers.forEach((router) => {
  app.use(router.routes());
  app.use(router.allowedMethods());
});

app.use((ctx) => {
  ctx.body = 'hello';
});

// 启动任务调度
cron.start();

export default app;
