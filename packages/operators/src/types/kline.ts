import { MACDResult } from '@data-analysis/core';
import { KLineBaseInterface } from '@data-analysis/types/kline.type';

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
