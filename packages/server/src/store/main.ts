import { mergeKLine } from 'rxjs-trading-signals/dist/utils/mergeKLine';
import {
  FetchProfit,
  fetchSum,
  Offset,
} from 'rxjs-trading-signals/dist/utils/FetchSum';
import { tradeRx } from 'rxjs-trading-signals/dist/utils/trade';
import { RSI } from 'rxjs-trading-signals';
import { OperatorsResult } from '@data-analysis/operators/src/types/core';
import { makeCuObservable } from '@data-analysis/operators/src/macd';
import {
  defer,
  concatMap,
  of,
  BigSource,
  Observable,
  Big,
  from,
  reduce,
  map,
  delay,
  tap,
  groupBy,
  mergeMap,
  take,
  filter,
  share,
  scan,
  last,
  max,
  zip,
} from '@data-analysis/core';
import axios from '@data-analysis/utils/axios';
import { correctionTime } from '@data-analysis/utils';
import { spliceURL } from '@data-analysis/utils/spliceURL';
import { timeHuobi } from '@data-analysis/utils/time';
// import { makeCuObservable } from '@data-analysis/operators';

interface KLineParamsInterface {
  symbol: string; // 交易对
  interval: string; // 时间间隔
  limit?: string; // k线长度
  startTime?: string; // 开始时间
  endTime?: string; // 结束时间
}

interface KLineInterface {
  id: number; // 时间戳
  open: BigSource; // 开盘价
  close: BigSource; // 收盘价
  low: BigSource; // 最低价
  high: BigSource; // 最高价
  volume: BigSource; // 成交量
}

class MainStore {
  // 当前交易对的配置信息
  currTard: KLineParamsInterface = {
    symbol: 'LINK-USDT',
    interval: '1min',
    limit: '300',
  };

  constructor() {
    this.onLoad();
  }

  onLoad() {
    console.log('hello');

    const { symbol, interval, limit = '' } = this.currTard;
    this.fetchExchangeInfo()
      .pipe(
        concatMap((items) =>
          from(items).pipe(map((x: any) => x.contract_code)),
        ),
        take(1),
        // map(() => 'ETH-USDT'),
        concatMap((symbol) => {
          return this.fetchKLine({
            symbol,
            interval,
            // startTime: '1636449600',
            // endTime: '1636467600',
            limit,
          }).pipe(
            concatMap((item) => {
              const result = [];
              let rightTimestamp = new Big(item[0].id)
                .times(1000)
                .minus(new Big(1).times(timeHuobi[interval]).times(1000))
                .toString();

              for (let i = 0; i < 80; i++) {
                const startTime = new Big(rightTimestamp)
                  .minus(new Big(limit).times(timeHuobi[interval]).times(1000))
                  .toString();

                result.push({
                  startTime: startTime,
                  endTime: rightTimestamp,
                });

                rightTimestamp = new Big(startTime)
                  .minus(new Big(1).times(timeHuobi[interval]).times(1000))
                  .toString();
              }

              console.log(result, '请求时间戳数组 ->');

              return from(result).pipe(
                concatMap(({ startTime, endTime }) =>
                  this.fetchKLine({
                    symbol: symbol,
                    interval: interval,
                    startTime: (+startTime / 1000).toString(),
                    endTime: (+endTime / 1000).toString(),
                  }),
                ),
                reduce(
                  (curr, next) => [...next, ...curr],
                  [] as KLineInterface[],
                ),
                map((curr) => [...curr, ...item]),
              );
            }),
            concatMap((items) => {
              const start = correctionTime(items[0].id * 1000) + 7 * 60;

              const result = [];

              for (let i = 4; i < 34; i++) {
                result.push(i);
              }

              const source$ = from(items).pipe(
                delay(5),
                filter(({ id }) => id >= start),
                map(({ id, open, close, high, low, vol }: any) => ({
                  id: id * 1000,
                  open,
                  close,
                  high,
                  low,
                  volume: vol,
                })),
                mergeKLine(15),
                share(),
              );

              return from(result).pipe(
                // take(1),
                concatMap((interval) => {
                  let price: BigSource = 0;
                  let buyIsOpen = false;
                  let sellIsOpen = false;

                  const share$ = source$.pipe(
                    map((x) => new Big(x.close)),
                    tap((x) => (price = x)),
                    RSI(interval),
                    share(),
                  );

                  return zip(
                    share$.pipe(
                      tradeRx(70, 50),
                      concatMap((x) => {
                        if (x === 3 && !buyIsOpen) {
                          buyIsOpen = true;
                          return of('open' as Offset);
                        } else if (x === 4 && buyIsOpen) {
                          buyIsOpen = false;
                          return of('close' as Offset);
                        } else if (x === 2 && buyIsOpen) {
                          buyIsOpen = false;
                          return of('close' as Offset);
                        }
                        return of();
                      }),
                      map((x) => ({ offset: x, price })),
                      FetchProfit('buy'),
                      fetchSum(),
                      map((x) => ({
                        result: x,
                        sum: !!x.length ? x[x.length - 1] : 0,
                      })),
                    ),
                    share$.pipe(
                      tradeRx(50, 30),
                      concatMap((x) => {
                        if (x === 3 && !sellIsOpen) {
                          sellIsOpen = true;
                          return of('open' as Offset);
                        } else if (x === 4 && sellIsOpen) {
                          sellIsOpen = false;
                          return of('close' as Offset);
                        } else if (x === 2 && sellIsOpen) {
                          sellIsOpen = false;
                          return of('close' as Offset);
                        }
                        return of();
                      }),
                      map((x) => ({ offset: x, price })),
                      FetchProfit('sell'),
                      fetchSum(),
                      map((x) => ({
                        result: x,
                        sum: !!x.length ? x[x.length - 1] : 0,
                      })),
                    ),
                  ).pipe(
                    map(([x1, x2]) => ({
                      x1,
                      x2,
                      interval,
                      sum: new Big(x1.sum).plus(x2.sum).toNumber(),
                    })),
                  );
                }),
                max((a, b) => (a.sum < b.sum ? -1 : 1)),
              );
            }),
          );
        }),
      )
      .subscribe((x) => console.log(x, 'x -> 最终数据'));
  }

  fetchKLine(kline: KLineParamsInterface): Observable<KLineInterface[]> {
    return defer(() =>
      axios
        .get(`https://vsweb.linairx.top/api/kline/huobi${spliceURL(kline)}`)
        .then((x) => x.data),
    );
  }

  fetchExchangeInfo(): Observable<any[]> {
    return defer(() =>
      axios
        .get(`https://vsweb.linairx.top/api/exchangeInfo/huobi`)
        .then((x) => x.data),
    );
  }

  sayHello() {
    return 'hello';
  }
}

export default new MainStore();
