import { mergeKLine } from 'rxjs-trading-signals/dist/utils/mergeKLine';
import {
  FetchProfit,
  fetchSum,
  Offset,
} from 'rxjs-trading-signals/dist/utils/FetchSum';
import { tradeRx } from 'rxjs-trading-signals/dist/utils/trade';
import { RSI, MACD, EMA, ADX, SMA, MOM, ATR } from 'rxjs-trading-signals';
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
  combineLatest,
  pairwise,
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
    this.onChina();
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
        map(() => 'ETH-USDT'),
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

              for (let i = 0; i < 200; i++) {
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
              const start = correctionTime(items[0].id * 1000) + 14 * 60;

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
                take(1),
                map(() => 5),
                concatMap((interval) => {
                  let last: any = {};
                  let buyIsOpen = false;
                  let sellIsOpen = false;

                  const macd$ = source$.pipe(
                    mergeKLine(4 * 24),
                    map(({ close }) => close),
                    tap((x) => (last = x)),
                    MACD({
                      indicator: EMA,
                      shortInterval: 14,
                      longInterval: 16,
                      signalInterval: 9,
                    }),
                    map(({ histogram }) => histogram),
                    // share(),
                  );

                  const adx$ = source$.pipe(
                    map(({ high, low, close }) => ({ high, low, close })),
                    tap((x) => (last = x)),
                    ADX(interval),
                  );

                  const atr$ = source$.pipe(
                    map(({ high, low, close }) => ({ high, low, close })),
                    tap((x) => (last = x)),
                    ATR(14),
                  );

                  const prev$ = source$.pipe(
                    tap((x) => (last = x)),
                    map(({ close }) =>
                      new Big(
                        new Big(close)
                          .times(10000000)
                          .round(0)
                          .toString()
                          .slice(0, 3),
                      )
                        .div(1)
                        .round(0),
                    ),
                    tap((x) => console.log(x.toString(), 'debug sss -> ')),
                    pairwise(),
                    filter(([x1, x2]) => !x1.eq(x2)),
                    map(([x1, x2]) => x2.gt(x1)),
                  );

                  const mom$ = source$.pipe(
                    map(({ close }) => close),
                    MOM(30),
                  );
                  const sma$ = source$.pipe(
                    map(({ close }) => close),
                    SMA(5),
                  );

                  const share$ = combineLatest([
                    // adx$.pipe(tradeRx(50, 25)),
                    prev$,
                    // atr$.pipe(),
                    // macd$,
                    // mom$,
                    // sma$,
                  ]).pipe(share());

                  return zip(
                    share$.pipe(
                      concatMap(([x]) => {
                        console.log(last.close, x.toString(), 'debug ->');
                        if (x && !buyIsOpen) {
                          buyIsOpen = true;
                          return of('open' as Offset);
                        } else if (!x && buyIsOpen) {
                          buyIsOpen = false;
                          return of('close' as Offset);
                        }
                        return of();
                      }),
                      map((x) => ({ offset: x, price: last.close })),
                      FetchProfit('buy'),
                      fetchSum(),
                      map((x) => ({
                        result: x,
                        sum: x.at(-1) || 0,
                      })),
                    ),
                    share$.pipe(
                      concatMap(([x]) => {
                        if (!x && !sellIsOpen) {
                          sellIsOpen = true;
                          return of('open' as Offset);
                        } else if (x && sellIsOpen) {
                          sellIsOpen = false;
                          return of('close' as Offset);
                        }
                        return of();
                      }),
                      map((x) => ({ offset: x, price: last.close })),
                      FetchProfit('sell'),
                      fetchSum(),
                      map((x) => ({
                        result: x,
                        sum: x.at(-1) || 0,
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

  onChina() {
    // https://vsweb.linairx.top/api/kline/china?symbol=000957&interval=240&limit=300
    this.fetchChina('600585', 15, 1200)
      .pipe(
        concatMap((items) => {
          let last: any = {};
          let buyIsOpen: boolean = false;

          console.log(items, 'items ->');
          

          return from(items).pipe(
            tap((x) => (last = x)),
            map(({ close }) =>
              new Big(
                new Big(close).times(10000000).round(0).toString().slice(0, 3),
              )
                .div(1)
                .round(0),
            ),
            // tap((x) => console.log(x.toString(), 'debug sss -> ')),
            pairwise(),
            filter(([x1, x2]) => !x1.eq(x2)),
            map(([x1, x2]) => x2.gt(x1)),
            concatMap((x) => {
              if (x && !buyIsOpen) {
                buyIsOpen = true;
                console.log(last.day, last.close, x.toString(), 'open ->');
                return of('open' as Offset);
              } else if (!x && buyIsOpen) {
                buyIsOpen = false;
                console.log(last.day, last.close, x.toString(), 'close ->');
                return of('close' as Offset);
              }
              return of();
            }),
            map((x) => ({ offset: x, price: last.close })),
            FetchProfit('buy'),
            fetchSum(),
            map((x) => ({
              result: x,
              sum: x.at(-1) || 0,
            })),
          );
        }),
      )
      .subscribe((x) => console.log(x, '股票结果'));
  }

  fetchKLine(kline: KLineParamsInterface): Observable<KLineInterface[]> {
    return defer(() =>
      axios
        .get(`https://vsweb.linairx.top/api/kline/huobi${spliceURL(kline)}`)
        .then((x) => x.data),
    );
  }

  fetchChina(
    symbol: string,
    interval: number,
    limit: number,
  ): Observable<any[]> {
    return defer(() =>
      axios
        .get(
          `https://vsweb.linairx.top/api/kline/china?symbol=${symbol}&interval=${interval}&limit=${limit}`,
        )
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
