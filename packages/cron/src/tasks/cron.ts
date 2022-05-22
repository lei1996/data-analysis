import { CronJob } from 'cron';

import MainStore from '../store/main';

// cron 参数范围 * * * * * *
// Seconds: 0-59
// Minutes: 0-59
// Hours: 0-23
// Day of Month: 1-31
// Months: 0-11 (Jan-Dec)
// Day of Week: 0-6 (Sun-Sat)

// start

// 周一到周五 每天收盘后定时请求任务
export const cron = new CronJob('0 46 7 * * 1-5', async () => {
  console.log('周一到周五 每天收盘后 15点46 启动定时请求任务', new Date().getTime());
  // autoSelectionOperator
  // MainStore.autoSHSelectionOperator();
  // MainStore.autoSZSelectionOperator();
});
