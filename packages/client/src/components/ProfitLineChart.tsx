import React from 'react';
import ReactECharts from 'echarts-for-react';
import { observer } from 'mobx-react';

import { css } from 'linaria';
import { getBalanceOption, getProfitOption } from '../utils/getOption';
import {
  AccountInfoInterface,
  ProfitInterface,
  ProfitObjectInterface,
} from '@data-analysis/types/operator.type';

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
  box: css`
    width: 450px;
    height: 300px;
  `,
};

function ProfitLineChart(data: ProfitObjectInterface) {
  const { symbol, profit } = data;
  return (
    <div className={styles.box}>
      <div className={styles.center}>{symbol}</div>
      <ReactECharts option={getProfitOption(profit)} />
    </div>
  );
}

export default observer(ProfitLineChart);
