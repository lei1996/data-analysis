import React from 'react';
import ReactECharts from 'echarts-for-react';
import { observer } from 'mobx-react';

import { css } from 'linaria';
import { getBalanceOption } from '../utils/getOption';
import { AccountInfoInterface } from '@data-analysis/types/operator.type';

const styles = {
  title: css`
    color: blue;
  `,
  center: css`
    display: flex;
    justify-content: center;
    align-items: center;
  `,
  row: css`
    display: flex;
    align-items: center;
  `,
};

function ChartComponent(data: {
  margin_balance: string;
  withdraw_available: string;
  accountInfoInterface: AccountInfoInterface;
}) {
  return (
    <div>
      <div className={styles.center}>
        <div>当前权益： {data.margin_balance}</div>
        <div>可用权益: {data.withdraw_available}</div>
      </div>

      <ReactECharts option={getBalanceOption(data.accountInfoInterface)} />
    </div>
  );
}

export default observer(ChartComponent);
