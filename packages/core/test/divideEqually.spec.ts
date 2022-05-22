import Big from 'big.js';

import { divideEqually } from '../src/divideEqually';

describe('operators/divideEqually.ts', () => {
    it('传入一个数，平分成n等分的数组.', () => {
        const r1 = divideEqually(new Big(-2.553));
        const r2 = divideEqually(new Big(-2));
        const r3 = divideEqually(new Big(0.9), 4);

        expect(r1).toEqual([
            -2.553, -2.2977,
            -2.0424, -1.7871,
            -1.5318, -1.2765,
            -1.0212, -0.7659,
            -0.5106, -0.2553,
            0
        ]);
        expect(r2).toEqual([
            -2, -1.8, -1.6, -1.4,
            -1.2, -1, -0.8, -0.6,
            -0.4, -0.2, 0
        ]);
        expect(r3).toEqual([
            0.9, 0.675, 0.45, 0.225, 0
        ]);
    });
});
