import app from './app';

console.log(process.env.NODE_ENV, '1 ');

const portEnum: any = {
  development: 4567,
  production: 7777
};

const port = portEnum[process.env.NODE_ENV as string] ?? 7777;

app.listen(port, () => {
  console.log('==> Start Server Success <==', port);
});
