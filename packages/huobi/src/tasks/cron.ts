import { CronJob } from 'cron';

// cron 参数范围 * * * * * *
// Seconds: 0-59
// Minutes: 0-59
// Hours: 0-23
// Day of Month: 1-31
// Months: 0-11 (Jan-Dec)
// Day of Week: 0-6 (Sun-Sat)

// start

// 避开15分钟这个坎 因为执行一次需要6-7分钟
export const cron = new CronJob('0 47 */2 * * *', async () => {
  // 这个程序运行时会自动运行一次
  console.log('每隔2小时执行一次任务调度', new Date().getTime());
});
