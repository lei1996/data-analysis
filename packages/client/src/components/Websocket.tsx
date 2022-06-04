import { filter, from, share, switchMapTo, timer } from '@data-analysis/core';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

import { blobInflate } from '../utils/blobInflate';

export const WebSocketDemo = () => {
  const didUnmount = useRef(false);

  //Public API that will echo messages sent to it back to the client
  const [socketUrl, setSocketUrl] = useState(
    'wss://api.hbdm.vn/linear-swap-ws',
  );
  const [messageHistory, setMessageHistory] = useState([]);

  const { sendMessage, lastMessage, readyState, getWebSocket } = useWebSocket(
    socketUrl,
    {
      shouldReconnect: (closeEvent) => {
        /*
      useWebSocket will handle unmounting for you, but this is an example of a 
      case in which you would not want it to automatically reconnect
    */
        return didUnmount.current === false;
      },
      reconnectAttempts: 10,
      reconnectInterval: 3000,
    },
  );

  useEffect(() => {
    return () => {
      didUnmount.current = true;
    };
  }, []);

  useEffect(() => {
    if (lastMessage !== null) {
      const main$ = from(blobInflate(lastMessage.data)).pipe(share());

      // 间隔 5s 发送
      const pingSubscription = main$
        .pipe(
          filter((item: any) => item.ping),
          switchMapTo(timer(0, 6000)),
        )
        .subscribe(() =>
          sendMessage(
            JSON.stringify({
              pong: new Date().getTime(),
            }),
          ),
        );

      const kLineSubscription = main$
        .pipe(
          filter(
            (item: any) => !!item.ch && (item.ch as string).includes('kline'),
          ),
        )
        .subscribe((x) => {
          console.log(x, 'k线数据 -');
        });

      return () => {
        console.log('清空状态');
        pingSubscription.unsubscribe();
        kLineSubscription.unsubscribe();
      };
    }
  }, [lastMessage, setMessageHistory]);

  const handleClickSendMessage = useCallback(
    () =>
      sendMessage(
        JSON.stringify({
          sub: `market.BTC-USDT.kline.1min`,
        }),
      ),
    [],
  );

  const connectionStatus = {
    [ReadyState.CONNECTING]: 'Connecting',
    [ReadyState.OPEN]: 'Open',
    [ReadyState.CLOSING]: 'Closing',
    [ReadyState.CLOSED]: 'Closed',
    [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
  }[readyState];

  return (
    <div>
      {/* <button onClick={handleClickChangeSocketUrl}>
        Click Me to change Socket Url
      </button> */}
      <button
        onClick={handleClickSendMessage}
        disabled={readyState !== ReadyState.OPEN}
      >
        Click Me to send 'Hello'
      </button>
      <span>The WebSocket is currently {connectionStatus}</span>
    </div>
  );
};
