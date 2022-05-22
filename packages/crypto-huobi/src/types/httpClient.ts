import { BigSource } from '@data-analysis/core';
import { Direction, kLinePeriod, marginMode, Offset, OrderPriceType, OrderSource } from './common';

// ------------------------------------------- 市场行情相关 -------------------------------------------

/**
 * 通用获取合约信息
 */
export interface SwapContractInfoInterface {
  /**
   * 合约代码，不填查询所有合约
   */
  contract_code?: string;

  /**
   * 合约支持的保证金模式
   */
  support_margin_mode?: marginMode;
}

/**
 * 通用获取合约信息 返回参数
 */
export interface SwapContractInfoResultInterface {
  /**
   * 品种代码: "BTC","ETH"...
   */
  symbol: string;

  /**
   * 合约代码: "BTC-USDT"...
   */
  contract_code: string;

  /**
   * 合约面值，即1张合约对应多少标的币种（如BTC-USDT合约则面值单位就是BTC）: 0.1，0.01...
   */
  contract_size: number;

  /**
   * 合约价格最小变动精度	: 0.001, 0.01...
   */
  price_tick: number;

  /**
   * 交割时间（合约无需交割时，该字段值为空字符串），单位：毫秒
   */
  delivery_time: string;

  /**
   * 合约上市日期: 如"20180706"
   */
  create_date: string;

  /**
   * 合约状态: 合约状态: 0:已下市、1:上市、2:待上市、3:停牌，4:待开盘、5:结算中、6:交割中、7:结算完成、8:交割完成
   */
  contract_status: number;

  /**
   * 合约下次结算时间: 时间戳，如"1490759594752"
   */
  settlement_date: string;

  /**
   * 合约支持的保证金模式: cross：全仓模式；isolated：逐仓模式；all：全逐仓都支持
   */
  support_margin_mode: marginMode;
}

/**
 * 通用获取合约指数信息 返回参数
 */
export interface SwapIndexResultInterface {
  /**
   * 指数价格
   */
  index_price: number;

  /**
   * 响应生成时间点，单位：毫秒
   */
  index_ts: number;

  /**
   * 合约代码： "BTC-USDT","ETH-USDT"...
   */
  contract_code: string;
}

/**
 * 获取合约最高限价和最低限价 返回参数
 */
export interface SwapPriceLimitResultInterface {
  /**
   * 品种代码: "BTC","ETH" ...
   */
  symbol: string;

  /**
   * 合约代码: 不填返回所有当前上市合约的限价数据
   */
  contract_code: string;

  /**
   * 最高买价
   */
  high_limit: number;

  /**
   * 最低卖价
   */
  low_limit: number;
}

/**
 * 获取K线数据
 */
export interface MarketHistoryKlineInterface {
  /**
   * 合约代码: "BTC-USDT" ...
   */
  contract_code: string;

  /**
   * K线类型: 1min, 5min, 15min, 30min, 60min,4hour,1day,1week,1mon
   */
  period: kLinePeriod;

  /**
   * 获取数量: 默认150. 取值范围 [1,2000]
   */
  size?: number;

  /**
   * 开始时间戳 10位 单位S
   */
  from?: string;

  /**
   * 结束时间戳 10位 单位S
   */
  to?: string;
}

/**
 * k线的数据 base
 */
export interface KLineBaseInterface {
  id: number; // 时间戳
  open: BigSource; // 开盘价
  close: BigSource; // 收盘价
  low: BigSource; // 最低价
  high: BigSource; // 最高价
}

/**
 * 火币k线的数据
 */
export interface HuoBiKLineInterface extends KLineBaseInterface {
  amount: BigSource; // 成交量(币), 即 (成交量(张) * 单张合约面值)。 值是买卖双边之和
  vol: BigSource; // 成交量(张)。 值是买卖双边之和
  trade_turnover: BigSource; // 成交额，即 sum（每一笔成交张数 * 合约面值 * 成交价格）。 值是买卖双边之和
  count: BigSource; // 成交笔数。 值是买卖双边之和
}

// ------------------------------------------- 资产相关 -------------------------------------------

/**
 * 支持全仓的所有合约的相关字段
 */
export interface ContractDetailResultInterface {
  /**
   * 品种代码: "BTC","ETH"...
   */
  symbol: string;

  /**
   * 合约代码: "BTC-USDT" ...
   */
  contract_code: string;

  /**
   * 持仓保证金（当前持有仓位所占用的保证金）
   */
  margin_position: number;

  /**
   * 冻结保证金
   */
  margin_frozen: number;

  /**
   * 可用保证金
   */
  margin_available: number;

  /**
   * 未实现盈亏
   */
  profit_unreal: number;

  /**
   * 预估强平价
   */
  liquidation_price: any;

  /**
   * 杠杠倍数
   */
  lever_rate: number;

  /**
   * 调整系数
   */
  adjust_factor: number;
}

/**
 * 【全仓】获取用户账户信息 返回参数
 */
export interface SwapCrossAccountInfoResultInterface {
  /**
   * 保证金模式: cross：全仓模式
   */
  margin_mode: string;

  /**
   * 保证金账户: 比如“USDT”
   */
  margin_account: string;

  /**
   * 保证金币种（计价币种）
   */
  margin_asset: string;

  /**
   * 账户权益
   */
  margin_balance: number;

  /**
   * 静态权益
   */
  margin_static: number;

  /**
   * 持仓保证金（所有全仓仓位汇总）
   */
  margin_position: number;

  /**
   * 冻结保证金（所有全仓仓位汇总）
   */
  margin_frozen: number;

  /**
   * 已实现盈亏
   */
  profit_real: number;

  /**
   * 未实现盈亏（所有全仓仓位汇总）
   */
  profit_unreal: number;

  /**
   * 可划转数量
   */
  withdraw_available: number;

  /**
   * 保证金率
   */
  risk_rate: any;

  /**
   * 支持全仓的所有合约的相关字段
   */
  contract_detail: ContractDetailResultInterface[];
}

/**
 * 【全仓】获取用户持仓信息 返回参数
 */
export interface SwapCrossPositionInfoResultInterface {
  /**
   * 品种代码: "BTC","ETH"...
   */
  symbol: string;

  /**
   * 合约代码: "BTC-USDT" ...
   */
  contract_code: string;

  /**
   * 持仓量（张）
   */
  volume: number;

  /**
   * 可平仓数量（张）
   */
  available: number;

  /**
   * 冻结数量（张）
   */
  frozen: number;

  /**
   * 开仓均价
   */
  cost_open: number;

  /**
   * 持仓均价
   */
  cost_hold: number;

  /**
   * 未实现盈亏
   */
  profit_unreal: number;

  /**
   * 收益率
   */
  profit_rate: number;

  /**
   * 杠杠倍数
   */
  lever_rate: number;

  /**
   * 持仓保证金
   */
  position_margin: number;

  /**
   * 仓位方向
   */
  direction: Direction;

  /**
   * 收益
   */
  profit: number;

  /**
   * 最新价
   */
  last_price: number;

  /**
   * 保证金币种（计价币种）
   */
  margin_asset: string;

  /**
   * 保证金模式: cross：全仓模式
   */
  margin_mode: string;

  /**
   * 保证金账户: 比如“USDT”
   */
  margin_account: string;
}

/**
 * 【全仓】查询用户可用杠杆倍数 返回参数
 */
export interface SwapCrossAvailableLevelRateResultInterface {
  /**
   * 合约代码: "BTC-USDT" ...
   */
  contract_code: string;

  /**
   * 实际可用杠杆倍数，多个以英文逗号隔开 比如："1,5,10"
   */
  available_level_rate: string;

  /**
   * 保证金模式: cross：全仓模式
   */
  margin_mode: string;
}

/**
 * 【全仓】合约下单
 */
export interface SwapCrossOrderInterface {
  /**
   * 合约代码: "BTC-USDT" ...
   */
  contract_code: string;

  /**
   * 客户自己填写和维护，必须为数字,请注意必须小于等于9223372036854775807
   */
  client_order_id?: string;

  /**
   * 价格
   */
  price?: string;

  /**
   * 委托数量(张)
   */
  volume: number;

  /**
   * 仓位方向  "buy":买 "sell":卖
   */
  direction: Direction;

  /**
   * 仓位方向  "open":开 "close":平
   */
  offset: Offset;

  /**
   * 杠杆倍数,“开仓”若有10倍多单，就不能再下20倍多单;
   * 首次使用高倍杠杆(>20倍)，请使用主账号登录web端同意高倍杠杆协议后，才能使用接口下高倍杠杆(>20倍)]
   */
  lever_rate: number;

  /**
   * 订单报价类型:
   *
   * "limit": 限价
   *
   * "opponent": 对手价
   *
   * "post_only": 只做maker单,post only下单只受用户持仓数量限制.
   *
   * "optimal_5"：最优5档
   *
   * "optimal_10"：最优10档
   *
   * "optimal_20"：最优20档
   *
   * "ioc": IOC订单
   *
   * "fok"：FOK订单
   *
   * "opponent_ioc": 对手价-IOC下单
   *
   * "optimal_5_ioc": 最优5档-IOC下单
   *
   * "optimal_10_ioc": 最优10档-IOC下单
   *
   * "optimal_20_ioc"：最优20档-IOC下单
   *
   * "opponent_fok"：对手价-FOK下单
   *
   * "optimal_5_fok"：最优5档-FOK下单
   *
   * "optimal_10_fok"：最优10档-FOK下单
   *
   * "optimal_20_fok"：最优20档-FOK下单
   */
  order_price_type: OrderPriceType;

  /**
   * 止盈触发价格
   */
  tp_trigger_price?: string;

  /**
   * 止盈委托价格（最优N档委托类型时无需填写价格）
   */
  tp_order_price?: string;

  /**
   * 止盈委托类型 不填默认为limit; 限价：limit ，最优5档：optimal_5，最优10档：optimal_10，最优20档：optimal_20
   */
  tp_order_price_type?: string;

  /**
   * 止损触发价格
   */
  sl_trigger_price?: string;

  /**
   * 止损委托价格（最优N档委托类型时无需填写价格）
   */
  sl_order_price?: string;

  /**
   * 止损委托类型 不填默认为limit; 限价：limit ，最优5档：optimal_5，最优10档：optimal_10，最优20档：optimal_20
   */
  sl_order_price_type?: string;
}

/**
 * 【全仓】合约下单 返回参数
 */
export interface SwapCrossOrderResultInterface {
  /**
   * 订单ID
   */
  order_id: number | string;

  /**
   * String类型订单ID
   */
  order_id_str: string;

  /**
   * 用户下单时填写的客户端订单ID，没填则不返回
   */
  client_order_id?: number | string;
}

/**
 * 【全仓】撤销订单
 */
export interface SwapCrossCancelInterface {
  /**
   * 订单ID(多个订单ID中间以","分隔,一次最多允许撤消10个订单)
   */
  order_id?: string;

  /**
   * 客户订单ID(多个订单ID中间以","分隔,一次最多允许撤消10个订单)
   */
  client_order_id?: string;

  /**
   * 合约代码 "BTC-USDT" ...
   */
  contract_code: string;
}

/**
 * 【全仓】撤销订单错误信息 返回参数
 */
export interface SwapCrossCancelErrorResult {
  /**
   * 订单ID
   */
  order_id: string;

  /**
   * 错误码
   */
  err_code: number;

  /**
   * 错误信息
   */
  err_msg: string;
}

/**
 * 【全仓】撤销订单 返回参数
 */
export interface SwapCrossCancelResultInterface {
  /**
   * 错误列表
   */
  errors: SwapCrossCancelErrorResult[];

  /**
   * 撤销成功的订单的order_id或client_order_id列表
   */
  successes: string;
}

/**
 * 【全仓】全部撤单
 */
export interface SwapCrossCancelAllInterface {
  /**
   * 买卖方向（不填默认全部）	"buy":买 "sell":卖
   */
  direction?: Direction;

  /**
   * 	开平方向（不填默认全部）	"open":开 "close":平
   */
  offset?: Offset;

  /**
   * 合约代码 "BTC-USDT" ...
   */
  contract_code: string;
}

/**
 * 【全仓】切换杠杆
 */
export interface SwapCrossSwitchLeverRateInterface {
  /**
   * 合约代码 "BTC-USDT" ...
   */
  contract_code: string;

  /**
   * 	要切换的杠杆倍数；首次使用高倍杠杆(>20倍)，请使用主账号登录web端同意高倍杠杆协议后，才能使用接口下高倍杠杆(>20倍)
   */
  lever_rate: number;
}

/**
 * 【全仓】切换杠杆 返回参数
 */
export interface SwapCrossSwitchLeverRateResultInterface {
  /**
   * 合约代码 "BTC-USDT" ...
   */
  contract_code: string;

  /**
   * 	要切换的杠杆倍数；首次使用高倍杠杆(>20倍)，请使用主账号登录web端同意高倍杠杆协议后，才能使用接口下高倍杠杆(>20倍)
   */
  lever_rate: number;

  /**
   * 	保证金模式	cross：全仓模式；
   */
  margin_mode: string;
}

/**
 * 【全仓】获取合约订单信息
 */
export interface SwapCrossOrderInfoInterface {
  /**
   * 订单ID(多个订单ID中间以","分隔,一次最多允许查询50个订单)
   */
  order_id?: string;

  /**
   * 客户订单ID(多个订单ID中间以","分隔,一次最多允许查询50个订单)
   */
  client_order_id?: string;

  /**
   * 合约代码	"BTC-USDT"...
   */
  contract_code: string;
}

/**
 * 【全仓】获取合约订单信息 返回参数
 */
export interface SwapCrossOrderInfoResultInterface {
  /**
   * 品种代码
   */
  symbol: string;

  /**
   * 合约代码	"BTC-USDT"...
   */
  contract_code: string;

  /**
   * 委托数量
   */
  volume: number | string;

  /**
   * 委托价格
   */
  price: number | string;

  /**
   * 订单报价类型
   */
  order_price_type: OrderPriceType;

  /**
   * 订单类型	1:报单 、 2:撤单 、 3:强平、4:交割
   */
  order_type: number;

  /**
   * 买卖方向	"buy":买 "sell":卖
   */
  direction: Direction;

  /**
   * 开平方向	"open":开 "close":平
   */
  offset: Offset;

  /**
   * 杠杆倍数
   */
  lever_rate: number;

  /**
   * 订单ID
   */
  order_id: number | string;

  /**
   * 客户订单ID
   */
  client_order_id: number | string;

  /**
   * 创建时间
   */
  created_at: number | string;

  /**
   * 成交数量
   */
  trade_volume: number;

  /**
   * 成交总金额 ，即sum（每一笔成交张数 * 合约面值 * 成交价格）
   */
  trade_turnover: number;

  /**
   * 手续费
   */
  fee: number;

  /**
   * 成交均价
   */
  trade_avg_price: number | string;

  /**
   * 冻结保证金
   */
  margin_frozen: number;

  /**
   * 平仓盈亏（使用持仓均价计算，不包含仓位跨结算的已实现盈亏。）
   */
  profit: number;

  /**
   * 订单状态	(1准备提交 2准备提交 3已提交 4部分成交 5部分成交已撤单 6全部成交 7已撤单 11撤单中)
   */
  status: number;

  /**
   * 订单来源	（system:系统、web:用户网页、api:用户API、m:用户M站、risk:风控系统、settlement:交割结算、
   * ios：ios客户端、android：安卓客户端、windows：windows客户端、mac：mac客户端、trigger：计划委托触发、tpsl:止盈止损触发）
   */
  order_source: OrderSource;

  /**
   * String类型订单ID
   */
  order_id_str: string;

  /**
   * 手续费币种	（"USDT"...）
   */
  fee_asset: string;

  /**
   * 结算类型 0:非强平类型，1：多空轧差， 2:部分接管，3：全部接管
   */
  liquidation_type: string;

  /**
   * 撤单时间
   */
  canceled_at: number;

  /**
   * 保证金币种（计价币种）
   */
  margin_asset: string;

  /**
   * 保证金账户	比如“USDT”
   */
  margin_account: string;

  /**
   * 保证金模式	cross：全仓模式；
   */
  margin_mode: string;

  /**
   * 是否设置止盈止损	1：是；0：否
   */
  is_tpsl: number;

  /**
   * 真实收益（使用开仓均价计算，包含仓位跨结算的已实现盈亏。）
   */
  real_profit: number;

  /**
   * 更新时间
   */
  update_time: any;
}
