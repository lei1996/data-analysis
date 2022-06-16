import { makeSuObservable } from './../../../operators/src/macd';
import {
  defer,
  concatMap,
  of,
  BigSource,
  Observable,
  Big,
  from,
  toArray,
  zip,
  reduce,
  map,
  delay,
  tap,
  groupBy,
  mergeMap,
} from '@data-analysis/core';
import axios from '@data-analysis/utils/axios';
import { spliceURL } from '@data-analysis/utils/spliceURL';
import { timeHuobi } from '@data-analysis/utils/time';

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
    symbol: 'BTC-USDT',
    interval: '15min',
    limit: '300',
  };

  constructor() {
    this.onLoad();
  }

  onLoad() {
    console.log('hello');
    let kline: any = {};
    const { symbol, interval, limit = '' } = this.currTard;
    this.fetchKLine({
      symbol,
      interval,
      limit,
    })
      .pipe(
        concatMap((item) => {
          const result = [];
          let rightTimestamp = new Big(item[0].id)
            .times(1000)
            .minus(new Big(1).times(timeHuobi[interval]).times(1000))
            .toString();

          for (let i = 0; i < 2; i++) {
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
            reduce((curr, next) => [...next, ...curr], [] as KLineInterface[]),
            map((curr) => [...curr, ...item]),
          );
        }),
        concatMap((item) =>
          from(item).pipe(
            delay(20),
            tap((x) => (kline = x)),
            makeSuObservable(14),
            concatMap((info: string) =>
              of({
                id: kline.id,
                info,
                close: kline.close,
                high: kline.high,
                low: kline.low,
              }),
            ),
          ),
        ),
        groupBy(({ info }) => info === '开多' || info === '平空'),
        mergeMap((group$) =>
          group$.pipe(
            reduce(
              (acc, cur) => [...acc, cur],
              [] as {
                id: any;
                info: string;
                close: any;
                high: any;
                low: any;
              }[],
            ),
          ),
        ),
        // tap(x => console.log(x, '分组数据')),
        concatMap((items) => {
          const obj = {
            sum: new Big(0),
            prev: new Big(0),
          };

          let dir = '';

          for (const item of items) {
            const { info, close } = item;

            if (info.includes('开')) {
              obj.prev = new Big(close);
            } else if (info.includes('平')) {
              dir = info.includes('空') ? 'buy' : 'sell';

              obj.sum = obj.sum.plus(
                info.includes('空')
                  ? new Big(close).minus(obj.prev)
                  : new Big(obj.prev).minus(close),
              );
            }
          }

          return of({ sum: obj.sum, info: dir });
        }),
      )
      .subscribe(({ info, sum }) =>
        console.log(info, sum.toString(), 'x -> 分组数据'),
      );
  }

  fetchKLine(kline: KLineParamsInterface): Observable<KLineInterface[]> {
    return defer(() =>
      axios
        .get(`https://suweb.linairx.top/api/kline/huobi${spliceURL(kline)}`)
        .then((x) => x.data),
    );
  }

  sayHello() {
    return 'hello';
  }
}

export default new MainStore();
