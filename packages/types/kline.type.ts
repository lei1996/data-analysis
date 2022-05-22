import type Big from 'big.js';

export type Period =
  | '1min'
  | '5min'
  | '15min'
  | '30min'
  | '60min'
  | '4hour'
  | '1day'
  | '1week'
  | '1mon';

export interface HuobikLine {
  contract_code: string;
  period: Period;
  size?: string;
  from?: string;
  to?: string;
}

export type Interval =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '6h'
  | '8h'
  | '12h'
  | '1d'
  | '3d'
  | '1w'
  | '1M';

export interface BinancekLine {
  symbol: string;
  interval: Period | Interval | number;
  startTime?: string;
  endTime?: string;
  limit?: string;
}

// k线的数据modal base
export interface KLineBaseInterface {
  symbol: string; // 交易对名称
  id: number; // 时间戳
  open: Big | string | number; // 开盘价
  close: Big | string | number; // 收盘价
  low: Big | string | number; // 最低价
  high: Big | string | number; // 最高价
  volume: Big | string | number; // 成交量
}

// 火币k线的数据modal
export interface HuoBiKLineInterface extends KLineBaseInterface {
  amount: Big | string | number; // 成交量(币), 即 (成交量(张) * 单张合约面值)。 值是买卖双边之和
  vol: Big | string | number; // 成交量(张)。 值是买卖双边之和
  trade_turnover: Big | string | number; // 成交额，即 sum（每一笔成交张数 * 合约面值 * 成交价格）。 值是买卖双边之和
  count: Big | string | number; // 成交笔数。 值是买卖双边之和
}

// 币安k线的数据modal
export interface BinanceKLineInterface extends KLineBaseInterface {
  symbol: string; // 'BTCUSDT'
}
