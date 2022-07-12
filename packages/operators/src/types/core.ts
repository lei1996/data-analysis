export type Direction = 'buy' | 'sell';
export type Offset = 'open' | 'close';

export type OperatorsResult = {
  direction: Direction;
  offset: Offset;
};
