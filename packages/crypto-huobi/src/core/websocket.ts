import WebSocket from 'ws';
import pako from 'pako';
import CryptoJS from 'crypto-js';
import { HmacSHA256 } from 'crypto-js';
import qs from 'qs';

import {
  share,
  switchMap,
  map,
  pipe,
} from '@data-analysis/core';
import {
  makeWebSocketObservable,
  GetWebSocketResponses,
  QueueingSubject,
  WebSocketOptions,
} from '@data-analysis/core';
import { moment } from '@data-analysis/utils';

const options: WebSocketOptions = {
  // this is used to create the websocket compatible object,
  // the default is shown here
  makeWebSocket: (url: string, protocols?: string | string[]) =>
    new WebSocket(url, protocols),

  // optional argument, passed to `makeWebSocket`
  protocols: [],
};

/**
 * 创建一个 Websocket 的实例
 * @param {*} WS_URL: string
 */
export const makeWebsocket = (WS_URL: string) =>
  makeWebSocketObservable<string>(WS_URL, options);

/**
 * 通用的 websocket 管道
 * @param {*} input$: QueueingSubject<string>
 */
export const makeSourcePipe = (input$: QueueingSubject<string>) => {
  return pipe(
    // 这里监听到那边传递过来的 func , 相当于交换了 Subject, 实现双向通讯
    switchMap((getResponses: GetWebSocketResponses<string>) =>
      getResponses(input$),
    ),
    map((x) =>
      JSON.parse(
        pako.inflate(x, {
          to: 'string',
        }),
      ),
    ), // 将原始的 buff 数据转成字符串
  );
};

/**
 * Build signed query string
 * @param {*} method
 * @param {*} baseurl
 * @param {*} path
 * @param {*} data
 */
export function buildQueryStringWithSignedSHA({
  method,
  baseUrl,
  path,
  signPayload,
  secretKey,
}: {
  method: string;
  baseUrl: string;
  path: string;
  signPayload: Record<string, string | number | boolean | unknown>;
  secretKey: string;
}): string {
  const params = Object.entries(signPayload).map((_) => _);
  params.sort((a, b) => {
    if (a[0] === b[0]) {
      return 0;
    }
    return a[0] < b[0] ? -1 : 1;
  });

  const query: Record<string, string | number | boolean | unknown> = {};
  params.forEach(([k, v]) => {
    query[k] = v;
  });

  const queryString = qs.stringify(query);

  const meta = [method, baseUrl, path, queryString].join('\n');
  const hash = HmacSHA256(meta, secretKey);
  const signature = CryptoJS.enc.Base64.stringify(hash);

  return signature;
}

/**
 * Default payload for sign
 */
export function getDefaultSignPayload(
  accessKey: string,
): Record<string, string | number | boolean> {
  return {
    AccessKeyId: accessKey,
    SignatureMethod: 'HmacSHA256',
    SignatureVersion: 2,
    Timestamp: moment.utc().format('YYYY-MM-DDTHH:mm:ss'),
  };
}
