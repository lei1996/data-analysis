import Big, { BigSource } from 'big.js';

interface OrderInterface {
  quantity: BigSource;
  price: BigSource;
}

export class Order {
  private _orderList: OrderInterface[] = [];

  constructor(private readonly maxOpen: number) {}

  get orderList() {
    return this._orderList;
  }

  open(order: OrderInterface) {
    if (this._orderList.length >= this.maxOpen) return;
    this._orderList.push(order);
  }

  close() {
    if (this._orderList.length === 0) return;
    this._orderList = [];
  }

  avgPrice() {
    if (this._orderList.length === 0) return new Big(0);
    
    const totalPrice = this._orderList.reduce(
      (curr, next) => curr.plus(new Big(next.price).times(next.quantity)),
      new Big(0),
    );
    const sum = this._orderList
      .map((o) => o.quantity)
      .reduce((curr, next) => new Big(curr).plus(next), new Big(0));

    return totalPrice.div(sum);
  }
}
