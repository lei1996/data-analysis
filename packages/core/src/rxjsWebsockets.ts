import { Observable, Subscription, Subject } from 'rxjs';

interface EventWithCodeAndReason {
  code: number;
  reason: string;
}

interface EventWithMessage {
  message?: string;
}

type WebSocketPayload = string | ArrayBuffer | Blob;

export interface WebSocketLike {
  close(): any;
  send(data: WebSocketPayload): any;

  // TypeScript doesn't seem to apply function bivariance on each property when
  // comparing an object to an interface so the argument types have to be `any` :(
  // Ideally would be able to use the EventWith... interfaces
  onopen: ((event: any) => any) | null;
  onclose: ((event: any) => any) | null;
  onmessage: ((event: any) => any) | null;
  onerror: ((event: any) => any) | null;
}

export type WebSocketFactory = (
  url: string,
  protocols: string | string[],
) => WebSocketLike;

export type GetWebSocketResponses<T = WebSocketPayload> = (
  input: Observable<WebSocketPayload>,
) => Observable<T>;

const defaultProtocols: string[] = [];

const defaultWebsocketFactory: WebSocketFactory = (
  url: string,
  protocols: string | string[],
): WebSocketLike => new WebSocket(url, protocols);

export interface WebSocketOptions {
  protocols: string | string[];
  makeWebSocket: WebSocketFactory;
}

export const normalClosureMessage = 'Normal closure';

export function makeWebSocketObservable<
  T extends WebSocketPayload = WebSocketPayload,
>(
  url: string,
  {
    protocols = defaultProtocols,
    makeWebSocket = defaultWebsocketFactory,
  }: WebSocketOptions = {
    protocols: defaultProtocols,
    makeWebSocket: defaultWebsocketFactory,
  },
): Observable<GetWebSocketResponses<T>> {
  return new Observable<GetWebSocketResponses<T>>((observer) => {
    // 这里初始化的变量只会执行一次， 所以可以外部传参初始化构造函数
    let inputSubscription: Subscription;
    const messages = new Subject<T>();

    const socket = makeWebSocket(url, protocols);

    let isSocketClosed = false;
    let forcedClose = false;

    const setClosedStatus = (): void => {
      isSocketClosed = true;
    };

    const getWebSocketResponses: GetWebSocketResponses<T> = (
      input: Observable<WebSocketPayload>,
    ) => {
      if (inputSubscription) {
        setClosedStatus();
        const error = new Error(
          'Web socket message factory function called more than once',
        );
        observer.error(error);
        throw error;
      } else {
        inputSubscription = input.subscribe((data) => {
          // 这里外部传递 input$ 进来, 如果有值传入 就会触发
          socket.send(data);
        });
        // 只有第一次会返回 messages
        return messages;
      }
    };

    socket.onopen = (): void => {
      if (forcedClose) {
        isSocketClosed = true;
        socket.close();
      } else {
        observer.next(getWebSocketResponses);
      }
    };

    socket.onmessage = (message: { data: T }): void => {
      // 这里有消息就会执行
      messages.next(message.data);
    };

    socket.onerror = (error: EventWithMessage): void => {
      // 只有报错的时候会触发
      console.log(error, 'rxjs websocket error 报错');
      setClosedStatus();
      observer.error(new Error(error.message));
    };

    socket.onclose = (event: EventWithCodeAndReason): void => {
      // prevent observer.complete() being called after observer.error(...)
      if (isSocketClosed) return;

      console.log(event, 'rxjs websocket 关闭');

      setClosedStatus();
      if (forcedClose) {
        observer.complete();
        messages.complete();
      } else {
        observer.error(
          new Error(event.code === 1000 ? normalClosureMessage : event.reason),
        );
      }
    };

    return (): void => {
      forcedClose = true;
      if (inputSubscription) inputSubscription.unsubscribe();

      if (!isSocketClosed) {
        setClosedStatus();
        socket.close();
      }
    };
  });
}
