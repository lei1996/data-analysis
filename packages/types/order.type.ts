import type Big from 'big.js';
import { BigSource } from 'big.js';

export interface OrderInfoInterface {
  contractCode: string; // 合约代码
  orderId?: string; // 订单ID
  clientOrderId?: string; // 客户订单ID
}

export interface OrderInterface {
  info: string;
  contractCode?: string;
  clientOrderId?: string;
  volume?: number;
  level_rate?: number;
  sl_trigger_price?: string;
  sl_order_price?: string;
  sl_order_price_type?: string;
}

export interface OrderDetailInterface {
  contract_code: string; // 合约代码  "BTC-USDT"
  order_id: string; // 订单id
  created_at?: string; // 下单时间戳
  order_type?: string; // 订单类型   1:报单 、 2:撤单 、 3:强平、4:交割
  page_index?: string; // 第几页,不填第一页
  page_size?: string; // 不填默认20，不得多于50
}

export interface OrderElementInterface {
  _price: Big | string | number;
  info: string;
}

interface OpenInfoInterface {
  qty: BigSource;
  stopPrice: BigSource;
}

export interface DirectionVolumnInterface {
  buy: BigSource; // 总持仓
  sell: BigSource; // 总持仓
  buy0: OpenInfoInterface;
  sell0: OpenInfoInterface;
  buy1: OpenInfoInterface;
  sell1: OpenInfoInterface;
  autoMacdBuyReverse: OpenInfoInterface;
  autoMacdSellReverse: OpenInfoInterface;
  autoRsiBuy: OpenInfoInterface;
  autoRsiSell: OpenInfoInterface;
  autoRsiReverseBuy: OpenInfoInterface;
  autoRsiReverseSell: OpenInfoInterface;
}
export interface DirectionMarginInterface {
  buy: BigSource;
  sell: BigSource;
}

export interface Depth {
  price: string;
  quantity: string;
}

export interface DepthInterface {
  bids: Depth[];
  asks: Depth[];
}

export interface OrderMapInterface {
  openVolumn: DirectionVolumnInterface;
  leverRate: number;
  depth: DepthInterface;
  lastPrice: BigSource;
  openMargin: DirectionMarginInterface;
}
