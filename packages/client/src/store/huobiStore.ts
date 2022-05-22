import { map, of, pipe, switchMap } from '@data-analysis/core';
import { SwapCrossAccountInfoResultInterface } from '@data-analysis/crypto-huobi/src/types';

// 用户权益
export function huobiUserDataPipe() {
  return pipe(
    switchMap((x: SwapCrossAccountInfoResultInterface) =>
      of({
        margin_balance: x.margin_balance,
        withdraw_available: x.withdraw_available,
      }),
    ),
  );
}
