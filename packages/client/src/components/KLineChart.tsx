import React, { useEffect } from 'react';
import { init, dispose, Chart } from 'klinecharts';

import { css } from 'linaria';

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
    }

    return () => {
      dispose('simple_chart');
      chartRef.current = null;
    };
  }, []);

  return <div id="simple_chart" className={styles.fill} />;
}
