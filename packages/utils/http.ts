import { HbApi } from 'huobi-api-js';
import serverConfig from '@data-analysis/config/server';

const options = {
  apiBaseUrl: serverConfig.huobi.apiBaseUrl,
  profileConfig: serverConfig.huobi.profileConfig,
};

export default new HbApi(options);
