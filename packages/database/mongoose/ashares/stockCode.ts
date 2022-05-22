import { Schema, model, Document } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2'

const StockCodeSchema = new Schema({
  createTime: { type: Date, default: Date.now },

  name: String,

  code: {
    type: String,
    trim: true,
    unique: true,
    index: true,
  },

  time: Number,
});

export interface StockCodeDocument extends Document {
  /** 股票/交易对 名称 */
  name: string;

  /** 股票/交易对 代码 */
  code: string;

  /** 股票/交易对 上市时间 */
  time: number;
}

// 分页器
StockCodeSchema.plugin(mongoosePaginate);

/**
 * StockCode Model
 * k线数据
 */
const StockCode = model<StockCodeDocument>('StockCode', StockCodeSchema);

export default StockCode;
