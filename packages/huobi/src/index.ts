import server from '@data-analysis/config/server';
import app from './app';

console.log(server.huobi.port, 'port ->');

const port = server.huobi.port;

app.listen(port, () => {
  console.log('==> Start Server Success <==', port);
});
