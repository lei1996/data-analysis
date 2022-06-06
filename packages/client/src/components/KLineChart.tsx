import React, { useEffect } from 'react';
import { init, dispose, Chart } from 'klinecharts';

import { css } from 'linaria';

const generatedDataList = [
  {
    close: 4976.16,
    high: 4977.99,
    low: 4970.12,
    open: 4972.89,
    timestamp: 1587660000000,
    volume: 204,
  },
  {
    close: 4977.33,
    high: 4979.94,
    low: 4971.34,
    open: 4973.2,
    timestamp: 1587660060000,
    volume: 194,
  },
  {
    close: 4977.93,
    high: 4977.93,
    low: 4974.2,
    open: 4976.53,
    timestamp: 1587660120000,
    volume: 197,
  },
  {
    close: 4966.77,
    high: 4968.53,
    low: 4962.2,
    open: 4963.88,
    timestamp: 1587660180000,
    volume: 28,
  },
  {
    close: 4961.56,
    high: 4972.61,
    low: 4961.28,
    open: 4961.28,
    timestamp: 1587660240000,
    volume: 184,
  },
  {
    close: 4964.19,
    high: 4964.74,
    low: 4961.42,
    open: 4961.64,
    timestamp: 1587660300000,
    volume: 191,
  },
  {
    close: 4968.93,
    high: 4972.7,
    low: 4964.55,
    open: 4966.96,
    timestamp: 1587660360000,
    volume: 105,
  },
  {
    close: 4979.31,
    high: 4979.61,
    low: 4973.99,
    open: 4977.06,
    timestamp: 1587660420000,
    volume: 35,
  },
  {
    close: 4977.02,
    high: 4981.66,
    low: 4975.14,
    open: 4981.66,
    timestamp: 1587660480000,
    volume: 135,
  },
  {
    close: 4985.09,
    high: 4988.62,
    low: 4980.3,
    open: 4986.72,
    timestamp: 1587660540000,
    volume: 76,
  },
];

const styles = {
  fill: css`
    width: 100%;
    height: 100%;
  `,
};

// applyNewData 初始化默认数据
// applyMoreData 添加历史数据
// updateData 更新最后一条数据 / 添加一条数据在末尾

export function KLineChart({
  chartRef,
}: {
  chartRef: React.MutableRefObject<Chart | null>;
}) {
  useEffect(() => {
    // Init chart
    chartRef.current = init('simple_chart');

    if (chartRef.current) {
      // Create main technical indicator MA
      chartRef.current.createTechnicalIndicator('MA', false, {
        id: 'candle_pane',
      });
      // Create sub technical indicator VOL
      chartRef.current.createTechnicalIndicator('VOL');

      // Fill data
      chartRef.current.applyNewData(generatedDataList);

      chartRef.current.loadMore((timestamp) => {
        console.log(timestamp, '时间戳');
      });
    }

    return () => {
      dispose('simple_chart');
      chartRef.current = null;
    };
  }, []);

  return <div id="simple_chart" className={styles.fill} />;
}
