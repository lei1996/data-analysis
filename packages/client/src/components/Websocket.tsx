import {
  concatMap,
  filter,
  from,
  map,
  of,
  share,
  switchMapTo,
  timer,
  toArray,
} from '@data-analysis/core';
import React, { useCallback, useEffect, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

import { css } from 'linaria';

import { blobInflate } from '../utils/blobInflate';
import { KLineChart } from './KLineChart';
import { Chart } from 'klinecharts';

import huobiStore from '../store/huobiStore';
import { observer } from 'mobx-react';

const styles = {
  klineChartContainer: css`
    height: 600px;
  `,
};

function WebSocketDemo() {
  const didUnmount = useRef(false);
  const chartRef = useRef<Chart | null>(null);

  const { sendMessage, lastMessage, readyState } = useWebSocket(
    huobiStore.socketUrl,
    {
      shouldReconnect: (closeEvent) => {
        /*
      useWebSocket will handle unmounting for you, but this is an example of a 
      case in which you would not want it to automatically reconnect
    */
        return didUnmount.current === false;
      },
      reconnectAttempts: 10,
      reconnectInterval: 5 * 1000,
    },
  );

  useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      handleClickSendMessage();
    }
  }, [readyState]);

  useEffect(() => {
    const { symbol, interval, limit } = huobiStore.currTard;

    const main$ = huobiStore
      .fetchKLine({
        symbol: symbol,
        interval: interval,
        limit: limit,
      })
      .pipe(
        concatMap((x) =>
          from(x).pipe(
            map(({ close, high, id, low, open, vol }: any) => ({
              close,
              high,
              id: id * 1000,
              low,
              open,
              volume: vol,
            })),
          ),
        ),
      );

    main$
      .pipe(
        map(({ id, ...rest }) => ({
          timestamp: id,
          ...rest,
        })),
        toArray(),
      )
      .subscribe((x) => {
        console.log(x, '图标需要的k线数据');
        if (chartRef.current) {
          // 初始化 k线数据
          chartRef.current.applyNewData(x);
        }
      });

    main$.pipe(toArray()).subscribe((x) => {
      console.log(x, '处理过的k线数据');
    });

    handleClickSendMessage();

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
          // switchMapTo(timer(0, 6000)),
        )
        .subscribe(({ ping }) => {
          console.log(ping, 'ping ->');

          sendMessage(
            JSON.stringify({
              pong: ping,
            }),
          );
        });

      const kLineSubscription = main$
        .pipe(
          filter(
            (item: any) => !!item.ch && (item.ch as string).includes('kline'),
          ),
          map(({ tick: { close, high, id, low, open, vol } }) => ({
            close,
            high,
            id: id * 1000,
            low,
            open,
            volume: vol,
          })),
        )
        .subscribe(({ id, ...rest }) => {
          console.log(id, rest, 'k线数据 -');
          if (chartRef.current) {
            // websocket 数据
            chartRef.current.updateData({
              timestamp: id,
              ...rest,
            });
          }
        });

      return () => {
        console.log('清空状态');
        pingSubscription.unsubscribe();
        kLineSubscription.unsubscribe();
      };
    }
  }, [lastMessage]);

  const handleClickSendMessage = useCallback(
    () =>
      sendMessage(
        JSON.stringify({
          sub: `market.${huobiStore.currTard.symbol}.kline.${huobiStore.currTard.interval}`,
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
      <div className={styles.klineChartContainer}>
        <KLineChart chartRef={chartRef} />
      </div>
    </div>
  );
}

export default observer(WebSocketDemo);
