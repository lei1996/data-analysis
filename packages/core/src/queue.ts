import Big, { BigSource } from 'big.js';

// 队列，存储里面的 泛型值
export class Queue<T> {
  queue: Array<T> = [];

  constructor(readonly maxLength: number) {}

  // 往队列推入一个 泛型数据
  push(item: T) {
    if (this.queue.length >= this.maxLength) {
      this.shift();
    }
    this.queue.push(item);
  }

  // 从第一个位置弹出元素
  shift() {
    if (!this.queue.length) {
      return;
    }
    const val = this.queue.shift();

    return val;
  }

  // 返回队列数据 limit 最新的数据
  getItems(limit = 5) {
    if (limit > this.queue.length) {
      return this.queue;
    }

    return this.queue.slice(this.queue.length - limit);
  }
}

export class BigSourceQueue extends Queue<BigSource> {
  sum: Big = new Big(0);

  constructor(readonly maxLength: number) {
    super(maxLength);
  }

  // 往队列推入一个 k线对象
  push(price: BigSource) {
    super.push(price);
    this.sum = this.sum.plus(price);
  }

  // 从第一个位置弹出元素
  shift() {
    if (!this.queue.length) {
      return;
    }
    const val = super.shift();
    this.sum = this.sum.minus(val ?? 0);

    return val;
  }

  // 返回队列最后一个元素
  get last() {
    return super.getItems(1)[0] ?? new Big(0);
  }
}

// 最大最小值
export class MaxMinQueue extends Queue<BigSource> {
  private max: Big[] = [];
  private min: Big[] = [];

  constructor(readonly maxLength: number) {
    super(maxLength);
  }

  getItems(limit = 5) {
    return super.getItems(limit);
  }

  get maxValue() {
    if (this.max.length) {
      return this.max[0].round(8).toNumber();
    }
    return 0;
  }

  get minValue() {
    if (this.min.length) {
      return this.min[0].round(8).toNumber();
    }
    return 0;
  }

  // 往队列推入一个 k线对象
  push(price: BigSource) {
    super.push(price);
    while (this.max.length && this.max[this.max.length - 1].lt(price)) {
      this.max.pop();
    }
    this.max.push(new Big(price));

    while (this.min.length && this.min[this.min.length - 1].gt(price)) {
      this.min.pop();
    }
    this.min.push(new Big(price));
  }

  // 从第一个位置弹出元素
  shift() {
    const val = super.shift();
    if (new Big(val ?? 0).eq(this.max[0])) {
      this.max.shift();
    }
    if (new Big(val ?? 0).eq(this.min[0])) {
      this.min.shift();
    }

    return val;
  }
}

export class StringQueue extends Queue<string> {
  constructor(readonly maxLength: number) {
    super(maxLength);
  }

  // 返回队列最后一个元素
  get last() {
    return super.getItems(1)[0] ?? '';
  }
}
