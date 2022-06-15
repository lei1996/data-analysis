import {
  Big,
  concatMap,
  delay,
  filter,
  from,
  map,
  of,
  share,
  switchMapTo,
  tap,
  timer,
  toArray,
} from '@data-analysis/core';
import React, { useCallback, useEffect, useRef } from 'react';
import { Chart } from 'klinecharts';
import { observer } from 'mobx-react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

import { css } from 'linaria';

import { makeSuObservable } from '@data-analysis/operators';
import { timeHuobi } from '@data-analysis/utils';

import { blobInflate } from '../utils/blobInflate';
import { KLineChart } from './KLineChart';

import huobiStore from '../store/huobiStore';
import kLineStore from '../store/kLineStore';

const styles = {
  klineChartContainer: css`
    height: 600px;
  `,
};

const isBuy = (info: string) =>
  info === '开多' || info === '平空' ? 'buy' : 'sell';

function annotationDrawExtend(
  ctx: any,
  coordinate: any,
  text: any,
  direction: 'buy' | 'sell',
) {
  ctx.font = '12px Roboto';
  ctx.fillStyle = '#2d6187';
  ctx.strokeStyle = '#2d6187';
  const textWidth = ctx.measureText(text).width; // 计算文本宽度
  const startX = coordinate.x; // 默认 x轴 起始点
  let startY = direction === 'buy' ? coordinate.y + 6 : coordinate.y - 6; // 默认 y轴 起始点
  ctx.setLineDash([3, 3]); // 设置成虚线
  ctx.beginPath(); // 开始绘制线
  ctx.moveTo(startX, startY); // 起始点
  ctx.lineTo(startX, direction === 'buy' ? startY + 50 : startY - 50); // 终止点
  ctx.closePath(); // 结束绘制
  ctx.stroke(); // 在 canvas 上绘图
  direction === 'buy' ? (startY += 50) : (startY -= 50);
  ctx.beginPath(); // 开始绘制三角形
  ctx.moveTo(startX, startY); // 起始点
  ctx.lineTo(startX - 4, direction === 'buy' ? startY + 5 : startY - 5); // 左上角 的点
  ctx.lineTo(startX + 4, direction === 'buy' ? startY + 5 : startY - 5); // 右上角 的点
  ctx.closePath(); // 合并选区成一个三角形
  ctx.fill(); // 在 canvas 上绘图

  const rectX = startX - textWidth / 2 - 6; // 矩形左上角 x轴 的点
  const rectY = direction === 'buy' ? startY + 5 : startY - 5 - 28; // 矩形左上角 y轴 的点
  const rectWidth = textWidth + 12; // 矩形宽度
  const rectHeight = 28; // 矩形高度
  const r = 2; // 圆角
  ctx.beginPath();
  ctx.moveTo(rectX + r, rectY);
  ctx.arcTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + rectHeight, r);
  ctx.arcTo(
    rectX + rectWidth,
    rectY + rectHeight,
    rectX,
    rectY + rectHeight,
    r,
  );
  ctx.arcTo(rectX, rectY + rectHeight, rectX, rectY, r);
  ctx.arcTo(rectX, rectY, rectX + rectWidth, rectY, r);
  ctx.closePath();
  ctx.fill();

  // 绘制文字
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(
    text,
    startX,
    direction === 'buy' ? startY + 5 + 14 : startY - 5 - 14,
  );
}

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
          // chartRef.current.createAnnotation([
          //   {
          //     point: {
          //       timestamp: x[x.length - 3].timestamp,
          //       value: x[x.length - 3].low,
          //     },
          //     styles: {
          //       position: 'point',
          //       offset: [2, 0],
          //       symbol: {
          //         type: 'custom',
          //       },
          //     },
          //     drawExtend: (params: any) => {
          //       const { ctx, coordinate } = params;
          //       annotationDrawExtend(ctx, coordinate, `test 数据`, 'sell');
          //     },
          //   },
          // ]);
        }
      });

    main$.pipe(toArray()).subscribe((x) => {
      console.log(x, '处理过的k线数据');
      const { symbol } = huobiStore.currTard;

      kLineStore.addItem(symbol, x);
    });

    if (chartRef.current) {
      chartRef.current.loadMore((timestamp) => {
        console.log(timestamp, '历史时间戳');
        const { symbol, interval, limit = '' } = huobiStore.currTard;

        const startTime = new Big(timestamp)
          .minus(new Big(limit).times(timeHuobi[interval]).times(1000))
          .toString();

        console.log(startTime, 'leftTimestamp 左侧时间戳');

        const main$ = huobiStore
          .fetchKLine({
            symbol: symbol,
            interval: interval,
            startTime: (+startTime / 1000).toString(),
            endTime: (timestamp / 1000).toString(),
          })
          .pipe(
            concatMap((x) =>
              from(x).pipe(
                filter(({ id }: any) => id * 1000 !== timestamp),
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
            console.log(x, '图标需要的历史k线数据');
            if (chartRef.current) {
              // 初始化 k线数据
              chartRef.current.applyMoreData(x);
            }
          });

        main$.pipe(toArray()).subscribe((x) => {
          console.log(x, '历史k线数据');
          const { symbol } = huobiStore.currTard;

          const klines = kLineStore.getKLineValue(symbol);

          kLineStore.addItem(symbol, [...x, ...klines]);
        });
      });
    }

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
            const { symbol } = huobiStore.currTard;

            // websocket 数据
            chartRef.current.updateData({
              timestamp: id,
              ...rest,
            });

            kLineStore.update(symbol, { id, ...rest });
          }
        });

      return () => {
        console.log('清空状态');
        pingSubscription.unsubscribe();
        kLineSubscription.unsubscribe();
      };
    }
  }, [lastMessage]);

  const handleClickSendMessage = useCallback(() => {
    const { symbol, interval, limit } = huobiStore.currTard;

    sendMessage(
      JSON.stringify({
        sub: `market.${symbol}.kline.${interval}`,
      }),
    );
  }, []);

  const runStrategy = () => {
    let kline: any = {};

    from(kLineStore.getKLineValue(huobiStore.currTard.symbol))
      .pipe(
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
        map(({ id, info, close, high, low }) => ({
          point: {
            timestamp: id,
            value: isBuy(info) === 'buy' ? low : high,
          },
          styles: {
            position: 'point',
            offset: [2, 0],
            symbol: {
              type: 'custom',
            },
          },
          drawExtend: (params: any) => {
            const { ctx, coordinate } = params;
            annotationDrawExtend(
              ctx,
              coordinate,
              `${info}, 价位:${close}`,
              isBuy(info),
            );
          },
        })),
        toArray(),
      )
      .subscribe((x) => {
        if (chartRef.current) {
          chartRef.current.removeAnnotation();
          chartRef.current.createAnnotation(x);
        }
      });
  };

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
      <button onClick={runStrategy}>runStrategy</button>
      <span>The WebSocket is currently {connectionStatus}</span>
      <div className={styles.klineChartContainer}>
        <KLineChart chartRef={chartRef} />
      </div>
    </div>
  );
}

export default observer(WebSocketDemo);
