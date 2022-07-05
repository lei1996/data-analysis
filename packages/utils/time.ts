import moment, { unitOfTime } from 'moment';
import { Big } from '@data-analysis/core';

// k线的时间戳 10位
export const getTime = () => (new Date().getTime() / 1000) | 0;

// 输出时间
export const getNowTime = (id?: any) =>
  `${moment(!!id ? Number(id) : new Date())
    .utcOffset(8 * 60)
    .format('YYYY/MM/DD HH:mm:ss')}`;

// 当前时间
export const nowTime = () =>
  moment(new Date())
    .utcOffset(8 * 60)
    .format('YYYY/MM/DD HH:mm:ss');

export const nowDate = () =>
  moment(new Date())
    .utcOffset(8 * 60)
    .format('YYYY/MM/DD');

// 判断时间是否超出限制
export const isOverFlowTime = (id: any, minute: number) => {
  const diffTime = ((new Date().getTime() / 1000) | 0) - +id;
  return diffTime > minute * 60;
};

// 返回当前时间最近的整数时间戳 比如 14：30
export const correctionTime = (timestamp: number, fator = 15) => {
  const start = moment(+timestamp);
  const remainder = fator - (start.minute() % fator);

  const dateTime = moment(start).add(remainder, 'minutes').unix();

  return dateTime;
};

// 获取时间戳
export const getTimeStamp = (time: string, length: number = 10) => {
  if (length === 10) {
    return (new Date(time).getTime() / 1000) | 0;
  }
  return new Date(time).getTime();
};

// 两个时间的差 单位: 天 时间戳一定要13位的
export const fromToday = (
  oldTime: number,
  newTime: number,
  unitOfTime: unitOfTime.Diff = 'day',
) => {
  return moment(newTime).diff(moment(oldTime), unitOfTime);
};

// 本周第一天
export const firstDayOnWeek = () => {
  return new Date(
    moment().startOf('week').add(1, 'day').format('YYYY-MM-DD HH:mm'),
  ).getTime();
};

interface timeObjInterface {
  [key: string]: number;
}

// 时间转换工具 - 火币
export const timeHuobi: timeObjInterface = {
  '1min': 60,
  '5min': 60 * 5,
  '15min': 60 * 15,
  '30min': 60 * 30,
  '60min': 60 * 60,
  '4hour': 60 * 60 * 4,
  '1day': 60 * 60 * 24,
  '1week': 60 * 60 * 24 * 7,
  '1mon': 60 * 60 * 24 * 31, // 30 28 29 31天都有可能 但是这个可能用不上
};

// 时间转换工具 - 币安
export const timeBinance: timeObjInterface = {
  '1m': 60 * 1000,
  '3m': 60 * 3 * 1000,
  '5m': 60 * 5 * 1000,
  '15m': 60 * 15 * 1000,
  '30m': 60 * 30 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 60 * 60 * 2 * 1000,
  '4h': 60 * 60 * 4 * 1000,
  '6h': 60 * 60 * 6 * 1000,
  '8h': 60 * 60 * 8 * 1000,
  '12h': 60 * 60 * 12 * 1000,
  '1d': 60 * 60 * 24 * 1000,
  '3d': 60 * 60 * 24 * 3 * 1000,
  '1w': 60 * 60 * 24 * 7 * 1000,
  '1M': 60 * 60 * 24 * 31 * 1000, // 30 28 29 31天都有可能 但是这个一般用不上
};

/**
 * 生成一个于开始/结束时间中的 随机时间
 * @param start 开始时间
 * @param end 结束时间
 * @returns
 */
export const randomDate = (start: Date, end: Date) => {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
};

/**
 * 生成一个
 * @param baseTime 基准时间
 * @param interval 时间间隔
 */
export const randomStartEndTime = (
  baseTime: string,
  interval: number,
  limit: number,
) => {
  // 这里要随机定义150条数据的起始/终止时间 然后递归 每5秒推入一根k线看变化.
  // 随机15分钟偏移量
  const timeRandomOffset = interval * ((Math.random() * 100) | 0);
  // 起始时间  基准时间 - 15分钟偏移量 得到一个随机值
  const start = new Big(
    correctionTime(new Big(baseTime).minus(timeRandomOffset).toNumber()),
  );
  // 终止时间
  const end = start.plus(((interval / 1000) | 0) * (limit + 13));

  return {
    timeRandomOffset,
    start: start.div(100).round(0).times(100),
    end: end.div(100).round(0).times(100),
  };
};
