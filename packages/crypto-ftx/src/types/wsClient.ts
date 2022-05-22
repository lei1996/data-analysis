import { WsChannel, WsEventTrades, WsTopic } from 'ftx-api';

export interface FtxSubscribeMsgInterface {
  type: 'sub' | 'unsub';
  msg: WsTopic[] | WsTopic | WsChannel[] | WsChannel;
}

export interface FtxSubscribeResultInterface {
  type: 'response' | 'trades' | 'update';
  msg: string | WsEventTrades;
}

export interface FtxTickerResultInterface {
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  last: number;
  time: number;
}

export { WsEventTrades };
