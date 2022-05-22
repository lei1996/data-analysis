import { Schema, model, Document } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2'

const SelectedCodeSchema = new Schema({
  createTime: { type: Date, default: Date.now },

  time: {
    type: Number,
    unique: true,
    index: true,
  },

  code: [{ type: String }],
});

export interface SelectedCodeDocument extends Document {
  /** 当前时间精选出来的股票 */
  time: number;

  /** 股票/交易对 代码 */
  code: string[];
}

// 分页器
SelectedCodeSchema.plugin(mongoosePaginate);

/**
 * SelectedCode Model
 * 某个时间段 股票池
 */
const SelectedCode = model<SelectedCodeDocument>('SelectedCode', SelectedCodeSchema);

export default SelectedCode;
