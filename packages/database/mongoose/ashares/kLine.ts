import { Schema, model, Document } from 'mongoose';

const kLineSchema = new Schema({
  createTime: { type: Date, default: Date.now },

  id: Number,
  open: String,
  close: String,
  high: String,
  low: String,
  volume: String,
});

export interface kLineDocument {
  /** k线 时间戳 */
  id: number;
  /** 开盘价 */
  open: string;
  /** 收盘价 */
  close: string;
  /** 最高价 */
  high: string;
  /** 最低价 */
  low: string;
  /** 成交量 */
  volume: string;
}

const KLineSchema = new Schema({
  createTime: { type: Date, default: Date.now },

  code: {
    type: String,
    trim: true,
    unique: true,
    index: true,
  },

  lastTime: Number,

  day: [kLineSchema],
});

export interface KLineDocument extends Document {
  /** 股票/交易对 代码 */
  code: string;

  /** 最新k线的 id */
  lastTime: number;

  /** 一天的k线 */
  day: kLineDocument[];
}

/**
 * KLine Model
 * k线数据
 */
const KLine = model<KLineDocument>('KLine', KLineSchema);

export default KLine;
