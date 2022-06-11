import React, { useRef } from 'react';
import { observer } from 'mobx-react';

import WebSocketDemo from './components/Websocket';
import ProfitLineChart from './components/ProfitLineChart';
import { ChinaLineChart } from './components/ChinaLineChart';
import store from './store/store';

import { css } from 'linaria';
import { Chart } from 'klinecharts';

const styles = {
  title: css`
    color: blue;
  `,
  chartLists: css`
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    padding: 20px;
  `,
  gridCl: css`
    display: flex;
  `,
};

const data = [
  {
    name: 'Page A',
    uv: 4000,
    pv: 2400,
    amt: 2400,
  },
  {
    name: 'Page B',
    uv: 3000,
    pv: 1398,
    amt: 2210,
  },
  {
    name: 'Page C',
    uv: 2000,
    pv: 9800,
    amt: 2290,
  },
  {
    name: 'Page D',
    uv: 2780,
    pv: 3908,
    amt: 2000,
  },
  {
    name: 'Page E',
    uv: 1890,
    pv: 4800,
    amt: 2181,
  },
  {
    name: 'Page F',
    uv: 2390,
    pv: 3800,
    amt: 2500,
  },
  {
    name: 'Page G',
    uv: 3490,
    pv: 4300,
    amt: 2100,
  },
];

function App() {
  const chartRef = useRef<Chart | null>(null);
  const maxOpenLimitChangeHandle = (e: any) => {
    store.maxOpenLimit = e.target.value;
  };

  const symbolLengthChangeHandle = (e: any) => {
    store.symbolLength = +e.target.value;
  };

  return (
    <div>
      <h1 className={styles.title}>App</h1>
      <div>
        <WebSocketDemo />
      </div>
      <div>
        code:
        <input
          value={store.chinaSymbol}
          onChange={(evt) => (store.chinaSymbol = evt.target.value)}
        />
        interval:
        <select
          value={store.chinaStockIndex}
          onChange={(evt) => store.changeChinaStockIndex(+evt.target.value)}
        >
          {store.chinaStock.map((iter, i) => {
            return (
              <option key={i} value={i}>
                {iter}
              </option>
            );
          })}
        </select>
        length:
        <input
          value={store.chinaKLineLength}
          onChange={(evt) => (store.chinaKLineLength = evt.target.value)}
        />
        <div>
          macdParams:
          <div>
            short:
            <input
              value={store.chinaMacdParams[0]}
              onChange={(evt) =>
                store.changeChinaMacdParams(+evt.target.value, 0)
              }
            />
            long:
            <input
              value={store.chinaMacdParams[1]}
              onChange={(evt) =>
                store.changeChinaMacdParams(+evt.target.value, 1)
              }
            />
            sign:
            <input
              value={store.chinaMacdParams[2]}
              onChange={(evt) =>
                store.changeChinaMacdParams(+evt.target.value, 2)
              }
            />
          </div>
          <button>submit</button>
        </div>
        <div>
          {store.chinaMList.map((iter, i) => {
            return (
              <div className={styles.gridCl} key={iter.id}>
                <div>{iter.date}</div>
                <div>{iter.info}</div>
                <div>{iter._price}</div>
                <div>{iter.stop}</div>
              </div>
            );
          })}
          <div>{store.chinaSum}</div>
        </div>
        <ChinaLineChart data={data} />
      </div>
      data Source:
      <select
        value={store.operatorTouchIndex}
        onChange={(evt) => store.changeoperatorTouchIndex(+evt.target.value)}
      >
        {store.key.map((iter, i) => {
          return (
            <option key={i} value={i}>
              {iter}
            </option>
          );
        })}
      </select>
      interval:
      <select
        value={store.periodSelectId}
        onChange={(evt) => store.changeIntervalTouchIndex(+evt.target.value)}
      >
        {store.periodLists.map((iter, i) => {
          return (
            <option key={i} value={i}>
              {iter}
            </option>
          );
        })}
      </select>
      symbol number:
      <input value={store.maxOpenLimit} onChange={maxOpenLimitChangeHandle} />
      k length:
      <input value={store.symbolLength} onChange={symbolLengthChangeHandle} />
      <button
        onClick={() => {
          store.isRandom = false;
          store.fetchExchangeInfoData();
        }}
      >
        最新
      </button>
      <button
        onClick={() => {
          store.isRandom = true;
          store.fetchExchangeInfoData();
        }}
      >
        随机
      </button>
      <div className={styles.chartLists}>
        {store.profitLists.map((item) => {
          return (
            <div key={item.symbol}>
              <ProfitLineChart symbol={item.symbol} profit={item.profit} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default observer(App);
