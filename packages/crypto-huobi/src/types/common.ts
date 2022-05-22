/**
 * 保证金模式 cross：全仓模式 isolated：逐仓模式 all 全逐仓都支持
 */
export type marginMode = 'cross' | 'isolated' | 'all';

/**
 * k线 枚举
 */
export type kLinePeriod =
  | '1min'
  | '5min'
  | '15min'
  | '30min'
  | '60min'
  | '4hour'
  | '1day'
  | '1week'
  | '1mon';

/**
 * "buy":买 "sell":卖
 */
export type Direction = 'buy' | 'sell';

/**
 * "open":开 "close":平
 */
export type Offset = 'open' | 'close';

/**
 * 订单报价类型
 * "limit":限价，"opponent":对手价 ，"post_only":只做maker单,post only下单只受用户持仓数量限制,
 * "optimal_5"：最优5档，"optimal_10"：最优10档，"optimal_20"：最优20档，"ioc":IOC订单，"fok"：FOK订单,
 * "opponent_ioc": 对手价-IOC下单，"optimal_5_ioc": 最优5档-IOC下单，"optimal_10_ioc": 最优10档-IOC下单，
 * "optimal_20_ioc"：最优20档-IOC下单，"opponent_fok"： 对手价-FOK下单，"optimal_5_fok"：最优5档-FOK下单，
 * "optimal_10_fok"：最优10档-FOK下单，"optimal_20_fok"：最优20档-FOK下单
 */
export type OrderPriceType =
  | 'limit'
  | 'opponent'
  | 'post_only'
  | 'optimal_5'
  | 'optimal_10'
  | 'optimal_20'
  | 'ioc'
  | 'fok'
  | 'opponent_ioc'
  | 'optimal_5_ioc'
  | 'optimal_10_ioc'
  | 'optimal_20_ioc'
  | 'opponent_fok'
  | 'optimal_5_fok'
  | 'optimal_10_fok'
  | 'optimal_20_fok';

/**
 * 订单来源
 * system:系统
 *
 * web:用户网页
 *
 * api:用户API
 *
 * m:用户M站
 *
 * risk:风控系统
 *
 * settlement:交割结算
 *
 * ios：ios客户端
 *
 * android：安卓客户端
 *
 * windows：windows客户端
 *
 * mac：mac客户端
 *
 * trigger：计划委托触发
 *
 * tpsl:止盈止损触发
 */
export type OrderSource =
  | 'system'
  | 'web'
  | 'api'
  | 'm'
  | 'risk'
  | 'settlement'
  | 'ios'
  | 'android'
  | 'windows'
  | 'mac'
  | 'trigger'
  | 'tpsl';
