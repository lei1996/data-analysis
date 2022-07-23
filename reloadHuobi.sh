pm2 stop huobi
echo '' > ~/.pm2/logs/huobi-out.log
echo '' > ~/.pm2/logs/huobi-error.log
pm2 restart huobi --cron-restart="4 6 */2 * *"