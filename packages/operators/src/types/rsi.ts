import { BigSource } from '@data-analysis/core';
import { KLineBaseInterface } from '@data-analysis/types/kline.type';

export interface OperatorInterface {
  rsiResult: BigSource;
  adxResult?: BigSource;
  best: number[];
  item: KLineBaseInterface;
}

export interface OperatorResultInterface {
  item: KLineBaseInterface;
  info: string;
  stop?: string;
}
