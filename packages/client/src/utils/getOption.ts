import {
  AccountInfoInterface,
  ProfitInterface,
} from '@data-analysis/types/operator.type';

export const getOption = ({
  xAxisTexts = [],
  original = [],
  before = [],
  after = [],
  ma5 = [],
}: any) => {
  return {
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: ['原始数据', '修正前数据', '修正后数据', 'ma5数据'],
    },
    toolbox: {
      feature: {
        saveAsImage: {},
      },
    },
    xAxis: {
      type: 'category',
      data: xAxisTexts,
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: '原始数据',
        type: 'line',
        smooth: true,
        data: original,
      },
      {
        name: '修正前数据',
        type: 'line',
        smooth: true,
        data: before,
      },
      {
        name: '修正后数据',
        type: 'line',
        smooth: true,
        data: after,
      },
      {
        name: 'ma5数据',
        type: 'line',
        smooth: true,
        data: ma5,
      },
    ],
  };
};

export const getBalanceOption = ({
  xAxisTexts = [],
  balances = [],
  crossWalletfixBalance = [],
  availableBalance = [],
}: AccountInfoInterface) => {
  return {
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: ['总余额', 'usdt真实权益', '可用权益'],
    },
    toolbox: {
      feature: {
        saveAsImage: {},
      },
    },
    xAxis: {
      type: 'category',
      data: xAxisTexts,
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: '总余额',
        type: 'line',
        smooth: true,
        data: balances,
      },
      {
        name: 'usdt真实权益',
        type: 'line',
        smooth: true,
        data: crossWalletfixBalance,
      },
      {
        name: '可用权益',
        type: 'line',
        smooth: true,
        data: availableBalance,
      },
    ],
  };
};

export const getProfitOption = ({
  xAxisTexts = [],
  autoMacdBuy = [],
  autoMacdSell = [],
  autoMomBuy = [],
  autoMomSell = [],
  autoRsiBuy = [],
  autoRsiSell = [],
}: ProfitInterface) => {
  return {
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: [
        'autoMacdBuy',
        'autoMacdSell',
        'autoMomBuy',
        'autoMomSell',
        'autoRsiBuy',
        'autoRsiSell',
      ],
    },
    toolbox: {
      feature: {
        saveAsImage: {},
      },
    },
    xAxis: {
      type: 'category',
      data: xAxisTexts,
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'autoMacdBuy',
        type: 'line',
        smooth: true,
        data: autoMacdBuy,
      },
      {
        name: 'autoMacdSell',
        type: 'line',
        smooth: true,
        data: autoMacdSell,
      },
      {
        name: 'autoMomBuy',
        type: 'line',
        smooth: true,
        data: autoMomBuy,
      },
      {
        name: 'autoMomSell',
        type: 'line',
        smooth: true,
        data: autoMomSell,
      },
      {
        name: 'autoRsiBuy',
        type: 'line',
        smooth: true,
        data: autoRsiBuy,
      },
      {
        name: 'autoRsiSell',
        type: 'line',
        smooth: true,
        data: autoRsiSell,
      },
    ],
  };
};
