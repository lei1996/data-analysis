export interface KLine {
  symbol: string; // 股票代码 比如： sz000001
  scale: number; // k线周期 比如： 一周 4 * 60 * 5 (一天开盘4小时 每小时60分钟 5天)
  ma?: number; // 均线
  datalen?: number; // k线长度
}

export interface KLineInterface {
  id: number; // 时间戳
  open: string; // 开盘价
  close: string; // 收盘价
  high: string; // 最高价
  low: string; // 最低价
  volume: string; // 成交量
}

export interface StockKLineInterface {
  code: string; // 股票代码
  lastTime: number; // 最新k线的 id
  day: KLineInterface[];
}

export interface StockCodeInterface {
  name: string; // 股票名称
  code: string; // 股票/交易对 代码
  time: number; // 股票/交易对 上市时间
}