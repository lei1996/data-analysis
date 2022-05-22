import {
  WebsocketClient,
  isWsTradesEvent,
  WsTopic,
  WsChannel,
  WsEventTrades,
} from 'ftx-api';
import {
  filter,
  map,
  Observable,
  QueueingSubject,
  share,
  Subject,
  Subscription,
  switchMap,
  throttleTime,
} from '@data-analysis/core';
import {
  FtxSubscribeMsgInterface,
  FtxTickerResultInterface,
} from './types/wsClient';

function makeWebsocketObservable(accessKey: string, secretKey: string) {
  return new Observable<any>((observer) => {
    // 这里初始化的变量只会执行一次， 所以可以外部传参初始化构造函数
    const socket = new WebsocketClient({ key: accessKey, secret: secretKey });
    let inputSubscription: Subscription;
    const messages = new Subject<string | WsEventTrades>();

    const getWebSocketResponses = (
      input: Observable<FtxSubscribeMsgInterface>,
    ) => {
      inputSubscription = input.subscribe((data) => {
        // 这里外部传递 input$ 进来, 如果有值传入 就会触发
        const { type, msg } = data;

        if (type === 'sub') {
          socket.subscribe(msg);
        } else if (type === 'unsub') {
          socket.unsubscribe(msg);
        }
      });
      // 只有第一次会返回 messages
      return messages;
    };

    observer.next(getWebSocketResponses);

    socket.on('response', (msg) => {
      messages.next(msg);
    });

    socket.on('update', (msg) => {
      // use a type guard to narrow down types
      // if (isWsTradesEvent(msg)) {
      //   // msg now is WsEventTrades
      //   messages.next(msg);
      // } else {
      //   messages.next({ type: 'update', msg });
      // }
      messages.next(msg);
    });

    socket.on('error', (msg) => {
      console.log('err: ', msg);
      observer.error(new Error(msg));
    });

    return () => {
      if (inputSubscription) inputSubscription.unsubscribe();
    };
  });
}

export class FtxWebsocketClient {
  private client;
  private input$: QueueingSubject<FtxSubscribeMsgInterface> =
    new QueueingSubject<FtxSubscribeMsgInterface>();

  constructor(accessKey: string, secretKey: string) {
    this.client = makeWebsocketObservable(accessKey, secretKey).pipe(
      // 这里监听到那边传递过来的 func , 相当于交换了 Subject, 实现双向通讯
      switchMap((getResponses) => getResponses(this.input$)),
      share(),
    );
  }

  /**
   * 订阅ws消息
   * @param msg
   */
  subscribe(msg: WsTopic[] | WsTopic | WsChannel[] | WsChannel) {
    this.input$.next({ type: 'sub', msg });
  }

  /**
   * 取消订阅ws消息
   * @param msg
   */
  unsubscribe(msg: WsTopic[] | WsTopic | WsChannel[] | WsChannel) {
    this.input$.next({ type: 'unsub', msg });
  }

  orderbook(msg: WsTopic[] | WsTopic | WsChannel[] | WsChannel) {
    this.subscribe(msg);
    return this.client.pipe(
      filter((x: any) => x.channel === 'orderbook'),
      // map((x) => x.data),
    );
  }

  ticker(
    msg: WsTopic[] | WsTopic | WsChannel[] | WsChannel,
  ): Observable<FtxTickerResultInterface> {
    this.subscribe(msg);
    return this.client.pipe(
      throttleTime(1 * 1000),
      filter(
        (x: any) =>
          x.channel === 'ticker' &&
          x.type === 'update' &&
          x.market === (msg as WsTopic).market,
      ),
      map((x) => x.data),
    );
  }

  markets(msg: WsTopic[] | WsTopic | WsChannel[] | WsChannel) {
    this.subscribe(msg);
    return this.client.pipe(
      filter((x: any) => x.channel === 'markets' && x.type === 'partial'),
      // map((x) => x.data),
    );
  }

  orders(msg: WsTopic[] | WsTopic | WsChannel[] | WsChannel) {
    this.subscribe(msg);
    return this.client.pipe(
      // filter((x: any) => x.channel === 'orders' && x.type === 'partial'),
      // map((x) => x.data),
    );
  }
}
