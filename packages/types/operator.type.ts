// 均衡器返回接口
export interface EqualizerResult {
  xAxisTexts: string[];
  original: string[];
  before: string[];
  after: string[];
  ma5: string[];
}

// 账户信息图表
export interface AccountInfoInterface {
  xAxisTexts: string[];
  balances: string[];
  crossWalletfixBalance: string[];
  availableBalance: string[];
}

// 账户信息图表
export interface ProfitObjectInterface {
  symbol: string;
  profit: ProfitInterface;
}

// 账户信息图表
export interface ProfitInterface {
  xAxisTexts: string[];
  autoMacdBuy: string[];
  autoMacdSell: string[];
  autoMomBuy: string[];
  autoMomSell: string[];
  autoRsiBuy: string[];
  autoRsiSell: string[];
}
