// 均分数组

import Big, { BigSource } from 'big.js';
import { map, Observable, of, range, toArray } from 'rxjs';

// 切分数字 将数字从 0 -> num 切分成 unit 份 返回一个数组
// unit: 切分的个数
export const divideEqually = (num: Big, unit: number = 10) => {
  if (unit <= 0) return [0];

  const result = [];
  const coefficient = new Big(100).div(unit).div(100); // 百分比 4份 就是 25%. 5份就是 20%
  const accuracy = 4; // 保留精度

  for (let i = 0; i <= unit; i++) {
    // x - ((x * 0.1) * i);
    result.push(
      num.minus(num.times(coefficient).times(i)).round(accuracy).toNumber(),
    );
  }

  return result;
};

// rxjs 版本
export const divideEquallyRx = (min: BigSource, max: BigSource, unit: number = 10) => {
  const num = new Big(max).minus(min); // 线段长度
  const coefficient = new Big(100).div(unit).div(100); // 百分比 4份 就是 25%. 5份就是 20%
  const accuracy = 4; // 保留精度

  return range(0, unit + 1).pipe(
    map((i) =>
      // x - ((x * 0.1) * i); plus(min) 修正偏移量 因为是以 0为开始单位计算的.
      num.minus(num.times(coefficient).times(i)).plus(min).round(accuracy).toNumber(),
    ),
    toArray(),
  );
};
