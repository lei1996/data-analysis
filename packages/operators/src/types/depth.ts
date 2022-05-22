import { BigSource } from '@data-analysis/core';

export interface BuyOperatorInterface {
  histogram: BigSource;
  best: number[];
  item: FtxTickerResultInterface;
}

type infoType = '开多' | '开空' | '平多' | '平空';

export interface OperatorResultInterface {
  item: FtxTickerResultInterface;
  info: string;
}

export interface FtxTickerResultInterface {
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  last: number;
  time: number;
}