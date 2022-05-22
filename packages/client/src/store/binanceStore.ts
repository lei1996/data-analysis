import {
  Big,
  concatMap,
  from,
  map,
  of,
  pipe,
  reduce,
  switchMap,
} from '@data-analysis/core';

import { AccountInfoInterface } from '@data-analysis/types/operator.type';
import { FuturesAccountBalance } from '@data-analysis/utils/binance';
import { getNowTime } from '@data-analysis/utils';

// 每次开仓时用户权益的数值，用于绘制图表
export function binanceAccountInfoDataPipe() {
  return pipe(
    concatMap((x: FuturesAccountBalance[]) =>
      from(x).pipe(
        reduce(
          (acc: AccountInfoInterface, curr) => ({
            xAxisTexts: [...acc.xAxisTexts, getNowTime(curr.updateTime)],
            balances: [...acc.balances, curr.balance.toString()],
            crossWalletfixBalance: [
              ...acc.crossWalletfixBalance,
              new Big(curr.crossWalletBalance).plus(curr.crossUnPnl).toString(),
            ],
            availableBalance: [
              ...acc.availableBalance,
              curr.availableBalance.toString(),
            ],
          }),
          {
            xAxisTexts: [],
            balances: [],
            crossWalletfixBalance: [],
            availableBalance: [],
          },
        ),
      ),
    ),
  );
}

// 用户权益
export function binanceUserDataPipe() {
  return pipe(
    switchMap((x: FuturesAccountBalance) =>
      of({
        margin_balance: new Big(x.crossWalletBalance)
          .plus(x.crossUnPnl)
          .toString(),
        withdraw_available: x.availableBalance.toString(),
      }),
    ),
  );
}
