import { fromToday } from "../time";

describe('utils/time.ts', () => {
    it('两个时间的差 单位: 天', () => {
        const day = fromToday(1632441600000, 1632742610363);

        expect(day).toBe(3);
    });
});
