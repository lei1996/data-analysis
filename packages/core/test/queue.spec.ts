import Big from 'big.js';
import { HuoBiKLineInterface } from '@data-analysis/types/kline.type';

import { Queue, BigSourceQueue, StringQueue, MaxMinQueue } from '../src/queue';
import { kLine } from './kLine.mock';

describe('operators/queue.ts', () => {
  it('最大长度为5的队列', () => {
    const queue = new Queue<HuoBiKLineInterface>(5);
    for (const line of kLine) {
      queue.push(line);
    }

    expect(queue.queue).toEqual(kLine.slice(-5));
    expect(queue.queue.length).toBe(5);
  });

  it('最大长度为5的队列 push2次 弹出一次', () => {
    const queue = new Queue<HuoBiKLineInterface>(5);
    for (const line of kLine.slice(0, 2)) {
      queue.push(line);
    }

    expect(queue.queue).toEqual(kLine.slice(0, 2));
    expect(queue.queue.length).toBe(2);
    queue.shift();
    expect(queue.queue).toEqual(kLine.slice(1, 2));
    expect(queue.queue.length).toBe(1);
    queue.shift();
    expect(queue.queue).toEqual([]);
    expect(queue.queue.length).toBe(0);
    queue.shift();
    expect(queue.queue).toEqual([]);
    expect(queue.queue.length).toBe(0);
  });

  it('最大长度为5的队列 获取最后的4个元素', () => {
    const queue = new Queue<HuoBiKLineInterface>(5);
    for (const line of kLine) {
      queue.push(line);
    }

    expect(queue.queue).toEqual(kLine.slice(-5));
    expect(queue.getItems(7)).toEqual(kLine.slice(-5));
    expect(queue.queue.length).toBe(5);
    queue.shift();
    expect(queue.getItems(4)).toEqual(kLine.slice(-4));
    expect(queue.queue.length).toBe(4);
  });

  it('BigSourceQueue 计算sum值', () => {
    const queue = new BigSourceQueue(5);
    for (const line of kLine) {
      queue.push(line.close);
    }

    expect(queue.queue).toEqual(kLine.slice(-5).map((a) => a.close));
    expect(queue.queue.length).toBe(5);
    expect(queue.sum).toEqual(
      kLine.slice(-5).reduce((a, b) => a.plus(b.close), new Big(0)),
    );
    const num = queue.shift();
    expect(num).toBe(46806.2);
    expect(queue.getItems(4)).toEqual(kLine.slice(-4).map((a) => a.close));
    expect(queue.queue.length).toBe(4);
    expect(queue.sum).toEqual(
      kLine.slice(-4).reduce((a, b) => a.plus(b.close), new Big(0)),
    );
    expect(queue.last).toEqual(kLine.slice(-1)[0].close);
  });

  it('StringQueue 队列', () => {
    const queue = new StringQueue(5);
    for (const line of kLine) {
      queue.push(line.close.toString());
    }

    expect(queue.queue).toEqual(kLine.slice(-5).map((a) => a.close.toString()));
    expect(queue.queue.length).toBe(5);
    queue.shift();
    expect(queue.getItems(4)).toEqual(
      kLine.slice(-4).map((a) => a.close.toString()),
    );
    expect(queue.queue.length).toBe(4);
    expect(queue.last).toEqual('46843.3');
  });

  it('MaxMinQueue 队列', () => {
    const queue = new MaxMinQueue(5);
    const arrs = [199, 22, 3, 4, 5, 65, 77];
    for (const arr of arrs) {
      queue.push(arr);
    }

    // expect(queue.maxValue).toBe(199); // error: 199 not in queue
    expect(queue.maxValue).toBe(77);
    expect(queue.minValue).toBe(3);
  });
});
