import {
  Direction,
  marginMode,
  Offset,
  OrderPriceType,
  OrderSource,
} from './common';

export interface TradeResultInterface {
  /**
   * 成交手续费
   */
  trade_fee: number;

  /**
   * 手续费币种 “USDT”
   */
  fee_asset: string;

  /**
   * 该笔成交的真实收益（使用开仓均价计算，包含仓位跨结算的已实现盈亏。）
   */
  real_profit: number;

  /**
   * 该笔成交的平仓盈亏（使用持仓均价计算，不包含仓位跨结算的已实现盈亏。）
   */
  profit: number;

  /**
   * 与linear-swap-api/v1/swap_cross_matchresults返回结果中的match_id一样，是撮合结果id，
   * 非唯一，可重复，注意：一个撮合结果代表一个taker单和N个maker单的成交记录的集合，
   * 如果一个taker单吃了N个maker单，那这N笔trade都是一样的撮合结果id
   */
  trade_id: number;

  /**
   * 全局唯一的交易标识
   */
  id: string;

  /**
   * 成交数量
   */
  trade_volume: number;

  /**
   * 成交价格
   */
  trade_price: number;

  /**
   * 成交金额（成交数量 * 合约面值 * 成交价格 ）
   */
  trade_turnover: number;

  /**
   * 成交创建时间
   */
  created_at: number;

  /**
   * taker或maker
   */
  role: string;
}

/**
 * 【全仓】订阅订单成交数据 返回参数
 */
export interface OrderCrossWebsocketResultInterface {
  /**
   * 操作名称，推送固定值为 notify;
   */
  op: string;

  /**
   * 推送的主题
   */
  topic: string;

  /**
   * 服务端应答时间戳
   */
  ts: number;

  /**
   * 品种代码 "BTC","ETH"...
   */
  symbol: string;

  /**
   * 合约代码
   */
  contract_code: string;

  /**
   * 委托数量
   */
  volume: number;

  /**
   * 委托价格
   */
  price: number;

  /**
   * 订单报价类型
   */
  order_price_type: OrderPriceType;

  /**
   * 买卖方向	"buy":买 "sell":卖
   */
  direction: Direction;

  /**
   * 开平方向	"open":开 "close":平
   */
  offset: Offset;

  /**
   * 订单状态	1准备提交 2准备提交 3已提交 4部分成交 5部分成交已撤单 6全部成交 7已撤单
   */
  status: number;

  /**
   * 杠杆倍数
   */
  lever_rate: number;

  /**
   * 订单ID
   */
  order_id: number | string;

  /**
   * string格式的订单ID
   */
  order_id_str: string;

  /**
   * 客户订单ID
   */
  client_order_id: number | string;

  /**
   * 订单来源
   */
  order_source: OrderSource;

  /**
   * 订单类型	1:报单 、 2:撤单 、 3:强平、4:交割
   */
  order_type: number;

  /**
   * 订单创建时间
   */
  created_at: number;

  /**
   * 成交总数量
   */
  trade_volume: number;

  /**
   * 成交总金额，即sum（每一笔成交张数 * 合约面值 * 成交价格）
   */
  trade_turnover: number;

  /**
   * 手续费
   */
  fee: number;

  /**
   * 成交均价
   */
  trade_avg_price: number;

  /**
   * 冻结保证金
   */
  margin_frozen: number;

  /**
   * 订单总平仓盈亏（使用持仓均价计算，不包含仓位跨结算的已实现盈亏。）
   */
  profit: number;

  /**
   * trade 相关信息
   */
  trade: TradeResultInterface[];

  /**
   * 撤单时间
   */
  canceled_at: number;

  /**
   * 手续费币种 “USDT”
   */
  fee_asset: string;

  /**
   * 保证金币种（计价币种）
   */
  margin_asset: string;

  /**
   * 用户uid
   */
  uid: string;

  /**
   * 强平类型 0:非强平类型，1：多空轧差， 2:部分接管，3：全部接管
   */
  liquidation_type: string;

  /**
   * 保证金模式 cross：全仓模式；
   */
  margin_mode: string;

  /**
   * 保证金账户 比如“USDT”
   */
  margin_account: string;

  /**
   * 是否设置止盈止损	1：是；0：否
   */
  is_tpsl: number;

  /**
   * 订单总真实收益（使用开仓均价计算，包含仓位跨结算的已实现盈亏。）
   */
  real_profit: number;
}

/**
 * 【全仓】持仓变动更新数据 返回参数
 */
export interface SwapCrossPositionsCrossResultInterface {
  /**
   * 品种代码	"BTC","ETH"...
   */
  symbol: string;

  /**
   * 合约代码
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
   * 收益
   */
  profit: number;

  /**
   * 保证金币种（计价币种）
   */
  margin_asset: string;

  /**
   * 持仓保证金
   */
  position_margin: number;

  /**
   * 杠杆倍数
   */
  lever_rate: number;

  /**
   * 仓位方向	"buy":买，即多仓 "sell":卖
   */
  direction: Direction;

  /**
   * 最新成交价
   */
  last_price: number;

  /**
   * 保证金模式	cross：全仓模式；
   */
  margin_mode: marginMode;

  /**
   * 	保证金账户	比如“USDT”
   */
  margin_account: string;
}

/**
 * 【全仓】合约订单撮合数据 返回参数
 */
export interface SwapCrossMatchOrdersCrossResultInterface {
  /**
   * 操作名称，推送固定值为 notify;
   */
  op: string;

  /**
   * 推送的主题
   */
  topic: string;

  /**
   * 服务端应答时间戳
   */
  ts: number;

  /**
   * 用户uid
   */
  uid: string;

  /**
   * 品种代码	"BTC","ETH"...
   */
  symbol: string;

  /**
   * 合约代码
   */
  contract_code: string;

  /**
   * 订单状态	(3未成交 4部分成交 5部分成交已撤单 6全部成交 7已撤单)
   */
  status: number;

  /**
   * 订单ID
   */
  order_id: number;

  /**
   * 订单ID ,字符串类型
   */
  order_id_str: string;

  /**
   * 客户订单id
   */
  client_order_id: number | string;

  /**
   * 订单类型	1:报单 、 2:撤单 、 3:强平、4:交割
   */
  order_type: number;

  /**
   * 持仓量（张）
   */
  volume: number;

  /**
   * 订单已成交数量
   */
  trade_volume: number;

  /**
   * 创建时间
   */
  created_at: number;

  /**
   * 仓位方向	"buy":买，即多仓 "sell":卖
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
   * 委托价格
   */
  price: number;

  /**
   * 订单来源
   */
  order_source: OrderSource;

  /**
   * 订单报价类型
   */
  order_price_type: OrderPriceType;

  /**
   * 订单报价类型
   */
  trade: TradeResultInterface[];

  /**
   * 保证金模式	cross：全仓模式；
   */
  margin_mode: marginMode;

  /**
   * 	保证金账户	比如“USDT”
   */
  margin_account: string;

  /**
   * 	是否设置止盈止损	1：是；0：否
   */
  is_tpsl: number;
}

export type topicEnum =
  | 'orders_cross'
  | 'accounts_cross'
  | 'positions_cross'
  | 'matchOrders_cross';

export interface NotificationIsOpenTopics {
  orders_cross: boolean;
  accounts_cross: boolean;
  positions_cross: boolean;
  matchOrders_cross: boolean;
  [key: string]: boolean;
}
