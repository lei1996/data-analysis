export interface MarketDepthResultInterface {
  /**
   * 品种代码
   */
  symbol: string;

  /**
   * 买盘
   */
  bids: [number, number][];

  /**
   * 卖盘
   */
  asks: [number, number][];
}

export interface SubKlineListInterface {
  /**
   * 合约代码
   */
  symbol: string;

  /**
   * k线长度
   */
  interval: string;
}

export interface SubDepthListInterface {
  /**
   * 合约代码
   */
  symbol: string;

  /**
   * 类型
   */
  type: string;
}
