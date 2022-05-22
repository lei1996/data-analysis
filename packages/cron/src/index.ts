import app from './app';

console.log(process.env.NODE_ENV, '1 ');

const portEnum: any = {
  development: 5678,
  production: 8888
};

const port = portEnum[process.env.NODE_ENV as string] ?? 8888;

app.listen(port, () => {
  console.log('==> Start Server Success <==', port);
});
