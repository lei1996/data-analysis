const { env } = process;

export default {
  /** 火币server config */
  huobi: {
    // api url
    apiBaseUrl: 'https://api.hbdm.vn',

    // ws url
    wsUrl: 'wss://api.hbdm.vn/linear-swap-ws',

    // 秘钥
    profileConfig: {
      accessKey: env.AccessKey || '',
      secretKey: env.SecretKey || '',
    },
  },
  /** 币安server config */
  bian: {
    development: {
      API_KEY: '',
      API_SECRET : '',
    },
    production: {
      API_KEY: '',
      API_SECRET : '',
    },
  } as const,
  // A股 获取历史k线url 第三方
  ashares: {
    url: 'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData',

    // mongodb address
    database: env.Database || 'mongodb://linairx:q1352468@127.0.0.1:37017/ashares?authSource=admin',
    // cronbase address
    cronbase: env.CronBase || 'http://localhost:4567',
  },
  ftx: {
    development: {
      API_KEY: '',
      API_SECRET : '',
    },
    production: {
      API_KEY: '',
      API_SECRET : '',
    },
  }
};
