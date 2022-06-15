import { defer } from "@data-analysis/core";
import axios from "@data-analysis/utils/axios";
import { spliceURL } from "@data-analysis/utils/spliceURL";


interface KLineParamsInterface {
  symbol: string; // 交易对
  interval: string; // 时间间隔
  limit?: string; // k线长度
  startTime?: string; // 开始时间
  endTime?: string; // 结束时间
}

class MainStore {
  // 当前交易对的配置信息
  currTard: KLineParamsInterface = {
    symbol: 'BTC-USDT',
    interval: '15min',
    limit: '300'
  };

  constructor() {}

  onLoad() {
    
  }

  fetchKLine(kline: KLineParamsInterface) {
    return defer(() =>
      axios.get(`/api/kline/huobi${spliceURL(kline)}`).then((x) => x.data),
    );
  }

  sayHello() {
    return 'hello';
  }
}

export default new MainStore();
