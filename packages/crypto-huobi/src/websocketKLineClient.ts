import {
  delay,
  filter,
  from,
  interval,
  map,
  Observable,
  pairwise,
  pipe,
  QueueingSubject,
  retryWhen,
  share,
  take,
  concatMapTo,
  switchMapTo,
  tap,
  throttleTime,
  timer,
  zip,
} from '@data-analysis/core';
import { makeSourcePipe, makeWebsocket } from './core/websocket';
import {
  MarketDepthResultInterface,
  SubKlineListInterface,
  SubDepthListInterface,
} from './types/websocketKLineClient';

export class WebsocketKLineClient {
  private socket$: Observable<any>;
  private input$ = new QueueingSubject<string>();
  private subKlineList: SubKlineListInterface[] = [];
  private subDepthList: SubDepthListInterface[] = [];

  private isRetry: boolean = false;

  constructor(private readonly wsUrl: string) {
    this.socket$ = makeWebsocket(this.wsUrl).pipe(this.source());
    this.heartBeat();
  }

  /**
   * k线消息
   */
  private get kLine$() {
    return this.socket$.pipe(
      filter((item) => !!item.ch && (item.ch as string).includes('kline')),
    );
  }

  /**
   * sub k线消息
   */
  subKline(symbol: string, interval: string) {
    this.input$.next(
      JSON.stringify({
        sub: `market.${symbol}.kline.${interval}`,
      }),
    );
  }

  /**
   * 获取k线数据
   * @param symbol
   * @param interval
   * @returns
   */
  wsKline$(symbol: string, interval: string) {
    this.subKline(symbol, interval);
    // 记录有哪些合约订阅了，断线重连的时候需要重新发送消息
    this.subKlineList.push({
      symbol,
      interval,
    });

    return this.kLine$.pipe(
      filter(
        (item) =>
          (item.ch as string).includes(symbol) &&
          (item.ch as string).includes(interval),
      ),
      pairwise(),
      filter((items) => items[0].tick.id !== items[1].tick.id),
      map((x) => ({ ...x[0].tick, symbol })),
    );
  }

  /**
   * 市场深度信息
   */
  private get depth$() {
    return this.socket$.pipe(
      filter((item) => !!item.ch && (item.ch as string).includes('depth')),
    );
  }

  /**
   * sub 市场深度消息
   */
  subDepth(symbol: string, type: string) {
    this.input$.next(
      JSON.stringify({
        sub: `market.${symbol}.depth.${type}`,
      }),
    );
  }

  /**
   * 获取市场深度
   * @param symbol
   * @param type
   * @returns
   */
  marketDepth$(
    symbol: string,
    type: string,
  ): Observable<MarketDepthResultInterface> {
    this.subDepth(symbol, type);
    this.subDepthList.push({
      symbol,
      type,
    });

    return this.depth$.pipe(
      filter(
        (item) =>
          (item.ch as string).includes(symbol) &&
          (item.ch as string).includes(type),
      ),
      throttleTime(1500),
      map((x) => ({
        symbol,
        bids: x.tick.bids,
        asks: x.tick.asks,
      })),
    );
  }

  /**
   * 合约站行情 数据源
   */
  private source() {
    return pipe(
      makeSourcePipe(this.input$),
      retryWhen((errors) =>
        errors.pipe(
          tap((val) => {
            console.log(`rxjs websocket error: ${val}`);
            interval(10 * 1000)
              .pipe(
                take(1),
                concatMapTo(from(this.subKlineList).pipe(delay(60))),
              )
              .subscribe((x) => {
                console.log(x, 'KLine重连ing');
                this.subKline(x.symbol, x.interval);
              });

            interval(10 * 1000)
              .pipe(
                take(1),
                concatMapTo(from(this.subDepthList).pipe(delay(60))),
              )
              .subscribe((x) => {
                console.log(x, '深度重连ing');
                this.subDepth(x.symbol, x.type);
              });
          }),
          delay(5000),
        ),
      ), // 5s后重连
      share(), // 热的 observable
    );
  }

  /**
   * 心跳包
   */
  private heartBeat() {
    this.socket$
      .pipe(
        filter((item) => item.ping),
        switchMapTo(timer(0, 6000)),
      )
      .subscribe(() =>
        this.input$.next(
          JSON.stringify({
            pong: new Date().getTime(),
          }),
        ),
      );
  }
}
