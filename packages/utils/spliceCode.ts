import config from '@data-analysis/config/server';
import { get } from "./axios";
import { spliceURL } from './spliceURL';
import { getTimeStamp } from "./time";

const url = config.ashares.url;

// 用于拼接股票k线请求
export const spliceCode = (code: string | number) => {
  if (code.toString().length !== 6) return;

  const c = code.toString().slice(0, 2);

  if (c === '00' || c === '30') {
    return `sz${code}`;
  } else if (c === '60') {
    return `sh${code}`;
  }
};

export const fetchHistoryKLine = async (klineParam: any) => {
  const param = spliceURL(klineParam);

  return get(url + param);
};

export const fetchStockKLineData = async (code: string, scale: number, len: number) => {
  const symbol: string = spliceCode(code) ?? '';

  try {
    const res = await fetchHistoryKLine({
      symbol: symbol,
      scale: scale, // 单位分钟
      datalen: len, // k线长度
    });

    return res.data.map((kline: any) => {
      const { day, ...rest } = kline;
      return {
        id: getTimeStamp(day),
        ...rest,
      };
    });
  } catch (err) {
    console.error(err, '获取股票数据异常');
  }
}