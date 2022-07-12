import { BigSource, MACDResult } from '@data-analysis/core';

export interface BuyOperatorInterface {
  macdResult: MACDResult;
  best: number[];
  item: KLineBaseInterface;
}

export interface OperatorResultInterface {
  item: KLineBaseInterface;
  info: string;
  stop?: string;
}

export interface KLineBaseInterface {
  id: number; // 时间戳
  open: BigSource; // 开盘价
  close: BigSource; // 收盘价
  low: BigSource; // 最低价
  high: BigSource; // 最高价
  volume: BigSource; // 成交量
}