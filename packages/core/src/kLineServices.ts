import { Queue } from './queue';

export class KLineServices<T> {
  map: Map<string, Queue<T>> = new Map(); // 股票存储k线
  maxLength: number;

  constructor(maxLength: number) {
    this.maxLength = maxLength;
  }

  has(code: string) {
    return this.map.has(code);
  }

  // 新增一个交易对
  addItem(code: string, items: T[]) {
    if (!this.has(code)) {
      const queue = new Queue<T>(this.maxLength);
      for (const item of items) {
        queue.push(item);
      }
      this.map.set(code, queue);
    } else {
      const queue = this.map.get(code) ?? new Queue<T>(this.maxLength);
      for (const item of items) {
        queue.push(item);
      }
      this.map.set(code, queue);
    }
  }

  // 移除某一个交易对
  remove(code: string) {
    if (!this.has(code)) return;

    this.map.delete(code);
  }

  // 修改某个交易对里面的所有k线
  update(code: string, items: T[]) {
    if (!this.has(code)) return;

    const queue = this.map.get(code) ?? new Queue<T>(this.maxLength);
    for (const item of items) {
      queue.push(item);
    }
    this.map.set(code, queue);
  }

  // 查找交易对里面的k线
  find(code: string) {
    if (!this.has(code)) return;
    const queue = this.map.get(code) ?? new Queue<T>(this.maxLength);
    return queue.queue;
  }
}
