# data-analysis
Data Analysis server and client

## Hot to run

1. Install dependency. `yarn install`
2. Run development server. `yarn dev:server`
3. Open `http://localhost:7777` to view server response
4. Run development client. `yarn dev:client`,
5. Open `http://localhost:8080` to view client page

## Avaliable Scripts

- `yarn dev:server` start dev server
- `yarn start:server` start prod server
- `yarn dev:client` start dev client
- `yarn build:client` build prod client
- `npx lerna add [--scope xxx] [--dev] yyy` 为 scope=xxx 包添加 dev 依赖 yyy, 不加 scope 则给所有包添加依赖, 不加 dev 则添加非 dev 依赖

功能特性：
  1. 满足多合约监控和开平仓
  2. 封装了火币。币安的业务库
  3. 理论上支持同时监控并且交易所有交易对(内存允许的话)
  4. 95%+ 业务流通过rxjs重写，上手有难度，二开需谨慎。
  5. 全自动化开仓/平仓，只需要写好自己的策略即可应用于所有合约。
  6. 业务库抽离成单个的lib，与主体项目分离。
  7. 策略库可以server。client端同时引用，无需编写两套代码。

