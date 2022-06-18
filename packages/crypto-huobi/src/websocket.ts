import Pako from 'pako';
import WebSocket from 'ws';
import { create } from 'observable-socket';

import {
  buildQueryStringWithSignedSHA,
  getDefaultSignPayload,
} from './core/websocket';

export const websocketClient = (url: string) => create(new WebSocket(url));

export const inflateData = (x: Pako.Data) =>
  JSON.parse(
    Pako.inflate(x, {
      to: 'string',
    }),
  );

/**
 * 火币 用户数据签名
 * @param baseUrl
 * @param path
 * @param accessKey
 * @param secretKey
 * @returns
 */
export const authData = (
  baseUrl: string,
  path: string,
  accessKey: string,
  secretKey: string,
) => {
  const signature = buildQueryStringWithSignedSHA({
    baseUrl: baseUrl,
    method: 'GET',
    path: path,
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

  return data;
};

export const makeWebsocketInstance = (
  wsUrl: string,
  msg: string,
  authData?: string,
) => {
  const echoSocket = websocketClient(wsUrl);

  if (authData) {
    // 鉴权
    echoSocket.up(authData);
  }
  // 上传
  echoSocket.up(msg);

  // 下载
  return echoSocket.down;
};
