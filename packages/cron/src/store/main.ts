import {
  map,
  from,
  takeLast,
  concatMap,
  delay,
  filter,
  Big,
  last,
  toArray,
  concatWith,
  defaultIfEmpty,
  catchError,
  of,
  retry,
  retryWhen,
  tap,
  timer,
  concatMapTo,
  pairwise,
} from '@data-analysis/core';
import {
  ShanghaiStockClient,
  ShenZhenStockClient,
} from '@data-analysis/china-stock';
import { autoSelectionOperator } from '@data-analysis/operators';
import { nowDate } from '@data-analysis/utils';

interface MapRInterface {
  sh: string[];
  sz: string[];
}

class MainStore {
  private shanghaiStockClient: ShanghaiStockClient;
  private shenZhenStockClient: ShenZhenStockClient;
  private map: Map<string, MapRInterface> = new Map<string, MapRInterface>();
  lastTime: string = '';

  constructor() {
    this.shanghaiStockClient = new ShanghaiStockClient();
    this.shenZhenStockClient = new ShenZhenStockClient();

    this.test();
  }

  test() {
    // this.fetchDaykLine('600000').subscribe((x) => console.log(x, '股票数据'));
    // this.fetchSHEquityData().subscribe((x) => console.log(x, '股票数据'));
    // this.fetchFwrData().subscribe((x) => console.log(x, '基金数据'));
    // this.fetchBondData().subscribe((x) => console.log(x, '债券数据'));
    // this.fetchIndexData().subscribe((x) => console.log(x, '指数数据'));
    // this.fetchSZDaykLine('123002').subscribe((x) => console.log(x, '股票数据'));
    // this.fetchSZEquityData().subscribe((x) => console.log(x, '股票 list 数据'));
    // this.fetchSZConvertibleBondData().subscribe((x) =>
    //   console.log(x, '可转债 list 数据'),
    // );
    // this.fetchSZFwrData().subscribe((x) => console.log(x, '基金 list 数据'));
    this.autoCompute();
  }

  autoCompute() {
    timer(5000, 24 * 60 * 60 * 1000)
      .pipe(
        concatMapTo(this.autoSHSelectionOperator()),
        tap((x) => {
          const now = nowDate();
          console.log(x, now, '上证数据');
          this.lastTime = now;
          const map = this.getMapValue(now);
          this.map.set(now, {
            ...map,
            sh: x,
          });
        }),
        pairwise(),
        concatMap(([x1, x2]) => {
          const set = new Set(x1);
          const result = [];

          for (const x of x2) {
            if (!set.has(x)) {
              result.push(x);
            }
          }

          return of(result);
        }),
      )
      .subscribe((x) => {
        const now = nowDate();
        console.log(x, now, '上证每日新增数据');
      });

    timer(5000, 24 * 60 * 60 * 1000)
      .pipe(
        concatMapTo(this.autoSZSelectionOperator()),
        tap((x) => {
          const now = nowDate();
          console.log(x, now, '深圳数据');
          this.lastTime = now;
          const map = this.getMapValue(now);
          this.map.set(now, {
            ...map,
            sz: x,
          });
        }),
        pairwise(),
        concatMap(([x1, x2]) => {
          const set = new Set(x1);
          const result = [];

          for (const x of x2) {
            if (!set.has(x)) {
              result.push(x);
            }
          }

          return of(result);
        }),
      )
      .subscribe((x) => {
        const now = nowDate();
        console.log(x, now, '深证每日新增数据');
      });
  }

  /**
   * 自动获取上海证券交易所的数据.
   */
  autoSHSelectionOperator() {
    return this.fetchSHEquityData().pipe(
      // take(1),
      concatWith(
        this.fetchFwrData(),
        this.fetchBondData(),
        this.fetchIndexData(),
      ),
      concatMap((code) =>
        this.fetchSHDaykLine(code).pipe(
          delay(20 * 1000),
          filter((x) => Array.isArray(x)),
          concatMap((x) =>
            from(x.kline).pipe(
              map((x: any) => ({
                symbol: code,
                id: x[0],
                open: x[1],
                high: x[2],
                low: x[3],
                close: x[4],
                volume: x[5],
              })),
              autoSelectionOperator(14, [12, 26, 9]),
              defaultIfEmpty([0, 0]),
              last(),
              tap((x) => console.log(x, 'debug 上海数据')),
              filter(([x1, x2]) => new Big(x1).gt(40) && new Big(x2).gt(0)),
              map(() => code),
            ),
          ),
        ),
      ),
      toArray(),
    );
  }

  /**
   * 自动获取深圳证券交易所的数据.
   */
  autoSZSelectionOperator() {
    return this.fetchSZEquityData().pipe(
      // take(1),
      concatWith(this.fetchSZFwrData(), this.fetchSZConvertibleBondData()),
      concatMap(({ code }) =>
        this.fetchSZDaykLine(code).pipe(
          delay(20 * 1000),
          filter((x) => Array.isArray(x)),
          concatMap((klines) =>
            from(klines).pipe(
              takeLast(50),
              map((x: any) => ({
                symbol: code,
                id: x[0],
                open: x[1],
                high: x[4],
                low: x[3],
                close: x[2],
                volume: x[7],
              })),
              autoSelectionOperator(14, [12, 26, 9]),
              defaultIfEmpty([0, 0]),
              last(),
              filter(([x1, x2]) => new Big(x1).gt(40) && new Big(x2).gt(0)),
              map(() => code),
            ),
          ),
        ),
      ),
      toArray(),
    );
  }

  /**
   * 获取深圳交易所 股票 日k线
   */
  fetchSZDaykLine(code: string) {
    return this.shenZhenStockClient.fetchDaykData(code).pipe(
      retryWhen((err) =>
        err.pipe(
          tap((err) => console.error(err, '获取上海交易所 股票 日k线报错')),
          delay(20 * 1000),
        ),
      ),
    );
  }

  /**
   * 获取深圳交易所 股票 list 数据
   */
  fetchSZEquityData() {
    return this.shenZhenStockClient.fetchEquityData().pipe(
      concatMap((lists) =>
        from(lists).pipe(
          map((x: any) => ({ code: x['A股代码'], name: x['A股简称'] })),
        ),
      ),
      retryWhen((err) =>
        err.pipe(
          tap((err) => console.error(err, '获取深圳交易所 股票list 报错')),
          delay(20 * 1000),
        ),
      ),
    );
  }

  /**
   * 获取深圳交易所 可转债 list 数据
   */
  fetchSZConvertibleBondData() {
    return this.shenZhenStockClient.fetchConvertibleBondData().pipe(
      concatMap((lists) =>
        from(lists).pipe(
          map((x: any) => ({ code: x['证券代码'], name: x['证券简称'] })),
        ),
      ),
      retryWhen((err) =>
        err.pipe(
          tap((err) =>
            console.error(err, '获取深圳交易所 可转债 list 数据 报错'),
          ),
          delay(20 * 1000),
        ),
      ),
    );
  }

  /**
   * 获取深圳交易所 基金 list 数据
   */
  fetchSZFwrData(isStreamlined: boolean = true) {
    return this.shenZhenStockClient.fetchFwrData().pipe(
      concatMap((lists) =>
        from(lists).pipe(
          map((x: any) => {
            const simple = { code: x['基金代码'], name: x['基金简称'] };

            // 这里欠优化
            if (isStreamlined) {
              return simple;
            } else {
              return {
                ...simple,
                type: x['基金类别'],
                investmentType: x['投资类别'],
                listingDate: x['上市日期'],
                currentScale: x['当前规模'],
                fundManager: x['基金管理人'],
              };
            }
          }),
        ),
      ),
      retryWhen((err) =>
        err.pipe(
          tap((err) => console.error(err, '获取深圳交易所 基金 list 数据报错')),
          delay(20 * 1000),
        ),
      ),
    );
  }

  /**
   * 获取上海交易所 股票 日k线
   */
  fetchSHDaykLine(code: string, begin: number = -50, end: number = -1) {
    return this.shanghaiStockClient.fetchDaykData(code, begin, end).pipe(
      retryWhen((err) =>
        err.pipe(
          tap((err) => console.error(err, '获取上海交易所 股票 日k线报错')),
          delay(20 * 1000),
        ),
      ),
    );
  }

  /**
   * 获取上海交易所 股票 list 数据
   */
  fetchSHEquityData(begin: number = 0, end: number = 9999999) {
    return this.shanghaiStockClient.fetchEquityData(begin, end).pipe(
      concatMap((x) => from(x.list).pipe(map((x: any) => x[0]))),
      retryWhen((err) =>
        err.pipe(
          tap((err) =>
            console.error(err, '获取上海交易所 股票 list 数据 报错'),
          ),
          delay(20 * 1000),
        ),
      ),
    );
  }

  /**
   * 获取上海交易所 基金 list 数据
   */
  fetchFwrData(begin: number = 0, end: number = 9999999) {
    return this.shanghaiStockClient.fetchFwrData(begin, end).pipe(
      concatMap((x) => from(x.list).pipe(map((x: any) => x[0]))),
      retryWhen((err) =>
        err.pipe(
          tap((err) => console.error(err, '获取上海交易所 基金 list 报错')),
          delay(20 * 1000),
        ),
      ),
    );
  }

  /**
   * 获取上海交易所 债券 list 数据
   */
  fetchBondData(begin: number = 0, end: number = 9999999) {
    return this.shanghaiStockClient.fetchBondData(begin, end).pipe(
      concatMap((x) => from(x.list).pipe(map((x: any) => x[0]))),
      retryWhen((err) =>
        err.pipe(
          tap((err) => console.error(err, '获取上海交易所 债券 list 报错')),
          delay(20 * 1000),
        ),
      ),
    );
  }

  /**
   * 获取上海交易所 指数 list 数据
   */
  fetchIndexData(begin: number = 0, end: number = 9999999) {
    return this.shanghaiStockClient.fetchIndexData(begin, end).pipe(
      concatMap((x) => from(x.list).pipe(map((x: any) => x[0]))),
      retryWhen((err) =>
        err.pipe(
          tap((err) => console.error(err, '获取上海交易所 指数 list 报错')),
          delay(20 * 1000),
        ),
      ),
    );
  }

  /**
   * 获取map key里面的value值
   * @param date
   * @returns
   */
  getMapValue(date: string) {
    return (
      this.map.get(date) ?? {
        sh: [],
        sz: [],
      }
    );
  }
}

export default new MainStore();
