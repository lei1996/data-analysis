import app from './app';

console.log(process.env.NODE_ENV, '1 ');

const portEnum: any = {
  development: 8800,
  production: 8811
};

const port = portEnum[process.env.NODE_ENV as string] ?? 8811;

app.listen(port, () => {
  console.log('==> Start Server Success <==', port);
});
