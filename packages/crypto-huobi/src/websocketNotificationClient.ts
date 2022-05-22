import {
  concatMapTo,
  delay,
  filter,
  from,
  interval,
  map,
  Observable,
  pipe,
  QueueingSubject,
  retryWhen,
  share,
  switchMapTo,
  take,
  tap,
  throttleTime,
  timer,
  zip,
} from '@data-analysis/core';
import {
  buildQueryStringWithSignedSHA,
  getDefaultSignPayload,
  makeSourcePipe,
  makeWebsocket,
} from './core/websocket';
import { SwapCrossAccountInfoResultInterface } from './types/httpClient';
import {
  OrderCrossWebsocketResultInterface,
  SwapCrossMatchOrdersCrossResultInterface,
  SwapCrossPositionsCrossResultInterface,
  NotificationIsOpenTopics,
  topicEnum,
} from './types/websocketNotificationClient';

export class WebsocketNotificationClient {
  private socket$: Observable<any>;
  private input$ = new QueueingSubject<string>();
  private isOpen: NotificationIsOpenTopics = {
    orders_cross: false,
    accounts_cross: false,
    positions_cross: false,
    matchOrders_cross: false,
  };

  private isRetry: boolean = false;

  constructor(
    private readonly baseUrl: string = 'api.hbdm.vn',
    private readonly path: string = '/linear-swap-notification',
    private readonly accessKey: string,
    private readonly secretKey: string,
  ) {
    const WS_URL: string = `wss://${baseUrl}${path}`;
    this.socket$ = makeWebsocket(WS_URL).pipe(this.source());
    this.auth({
      accessKey: this.accessKey,
      secretKey: this.secretKey,
    });
    this.heartBeat();
  }

  /**
   * 数据源
   */
  private get source$() {
    return this.socket$.pipe(filter((item) => item.op === 'notify'));
  }

  /**
   * sub 用户数据
   */
  private subTopic(topic: topicEnum) {
    this.input$.next(
      JSON.stringify({
        op: 'sub',
        topic: `${topic}.*`,
      }),
    );
  }

  /**
   * 订阅订单成交数据
   */
  orders$(): Observable<OrderCrossWebsocketResultInterface> {
    this.subTopic('orders_cross');
    this.isOpen = {
      ...this.isOpen,
      orders_cross: true,
    };

    return this.source$.pipe(
      filter((item) => (item.topic as string).includes('orders_cross')),
    );
  }

  /**
   * [全仓] 资产变动数据
   */
  accounts$(): Observable<SwapCrossAccountInfoResultInterface[]> {
    this.subTopic('accounts_cross');
    this.isOpen = {
      ...this.isOpen,
      accounts_cross: true,
    };

    return this.source$.pipe(
      filter((item) => (item.topic as string).includes('accounts_cross')),
      map((x) => x.data),
    );
  }

  /**
   * [全仓] 持仓变动更新数据
   */
  positions$(): Observable<SwapCrossPositionsCrossResultInterface[]> {
    this.subTopic('positions_cross');
    this.isOpen = {
      ...this.isOpen,
      positions_cross: true,
    };

    return this.source$.pipe(
      filter((item) => (item.topic as string).includes('positions_cross')),
      map((x) => x.data),
    );
  }

  /**
   * [全仓] 合约订单撮合数据
   */
  matchOrders$(): Observable<SwapCrossMatchOrdersCrossResultInterface> {
    this.subTopic('matchOrders_cross');
    this.isOpen = {
      ...this.isOpen,
      matchOrders_cross: true,
    };

    return this.source$.pipe(
      filter((item) => (item.topic as string).includes('matchOrders_cross')),
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
              .pipe(take(1))
              .subscribe(() => {
                console.log('auth 重连ing');
                this.auth({
                  accessKey: this.accessKey,
                  secretKey: this.secretKey,
                });
              });

            interval(10 * 1000)
              .pipe(
                take(1),
                concatMapTo(from(this.getSubList(this.isOpen)).pipe(delay(60))),
              )
              .subscribe((x) => {
                console.log(x, '用户信息重连ing');
                this.subTopic(x as topicEnum);
              });
          }),
          delay(5000),
        ),
      ), // 5s后重连
      share(), // 热的 observable
    );
  }

  /**
   * 身份鉴权
   * @param param
   */
  private auth = ({
    accessKey,
    secretKey,
  }: {
    accessKey: string;
    secretKey: string;
  }) => {
    const signature = buildQueryStringWithSignedSHA({
      baseUrl: this.baseUrl,
      method: 'GET',
      path: this.path,
      signPayload: getDefaultSignPayload(accessKey),
      secretKey: secretKey,
    });

    const data = {
      op: 'auth',
      type: 'api',
      AccessKeyId: accessKey,
      SignatureMethod: 'HmacSHA256',
      SignatureVersion: '2',
      Timestamp: new Date().toISOString().slice(0, 19),
      Signature: signature,
    };

    this.input$.next(JSON.stringify(data));
  };

  /**
   * 心跳包
   */
  private heartBeat() {
    this.socket$
      .pipe(
        filter((item) => item.op === 'ping'),
        switchMapTo(timer(0, 6000)),
      )
      .subscribe(() =>
        this.input$.next(
          JSON.stringify({
            op: 'pong',
            ts: new Date().getTime(),
          }),
        ),
      );
  }

  /**
   * 获取订阅列表
   * @param obj
   * @returns
   */
  private getSubList(obj: NotificationIsOpenTopics) {
    return Object.keys(obj).filter((x: string) => obj[x] === true);
  }
}
