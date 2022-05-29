import React, { useState, useCallback, useEffect, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

export const WebSocketDemo = () => {
  const didUnmount = useRef(false);

  //Public API that will echo messages sent to it back to the client
  const [socketUrl, setSocketUrl] = useState(
    'wss://api.hbdm.vn/linear-swap-ws',
  );
  const [messageHistory, setMessageHistory] = useState([]);

  const { sendMessage, lastMessage, readyState } = useWebSocket(socketUrl, {
    shouldReconnect: (closeEvent) => {
      /*
      useWebSocket will handle unmounting for you, but this is an example of a 
      case in which you would not want it to automatically reconnect
    */
      return didUnmount.current === false;
    },
    reconnectAttempts: 10,
    reconnectInterval: 3000,
  });

  useEffect(() => {
    return () => {
      didUnmount.current = true;
    };
  }, []);

  useEffect(() => {
    console.log(lastMessage, 'lastMessage -');
    if (lastMessage !== null) {
      setMessageHistory((prev) => prev.concat(lastMessage as any));
    }
  }, [lastMessage, setMessageHistory]);

  const handleClickChangeSocketUrl = useCallback(
    () => setSocketUrl('wss://api.hbdm.vn/linear-swap-ws'),
    [],
  );

  const handleClickSendMessage = useCallback(
    () =>
      sendMessage(
        JSON.stringify({
          sub: `market.BTC-USDT.kline.15min`,
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
      <button onClick={handleClickChangeSocketUrl}>
        Click Me to change Socket Url
      </button>
      <button
        onClick={handleClickSendMessage}
        disabled={readyState !== ReadyState.OPEN}
      >
        Click Me to send 'Hello'
      </button>
      {/* <span>The WebSocket is currently {connectionStatus}</span>
      {lastMessage ? <span>Last message: {lastMessage.data}</span> : null} */}
      {/* <ul>
        {messageHistory.map((message, idx) => (
          <span key={idx}>{message ? (message as any).data : null}</span>
        ))}
      </ul> */}
    </div>
  );
};
