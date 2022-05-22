import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

import { css } from 'linaria';

const mt = (x: number) => {
  return `
    margin-top: ${x}px;
  `;
};

const styles = {
  title: css`
    color: blue;
  `,
  container: css`
    margin-bottom: 15px;
    ${mt(15)}
  `,
};

export const ChinaLineChart = (param: { data: any[] }) => {
  return (
    <div className={styles.container}>
      <AreaChart
        width={500}
        height={400}
        data={param.data}
        margin={{
          top: 10,
          right: 30,
          left: 0,
          bottom: 0,
        }}
      >
        <Tooltip />
        <Area
          type="monotone"
          dataKey="uv"
          stackId="1"
          stroke="#8884d8"
          fill="#8884d8"
        />
        <Area
          type="monotone"
          dataKey="pv"
          stackId="1"
          stroke="#82ca9d"
          fill="#82ca9d"
        />
        <Area
          type="monotone"
          dataKey="amt"
          stackId="1"
          stroke="#ffc658"
          fill="#ffc658"
        />
      </AreaChart>
    </div>
  );
};
