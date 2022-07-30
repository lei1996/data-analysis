pm2 stop eth
echo '' > ~/.pm2/logs/eth-out.log
echo '' > ~/.pm2/logs/eth-error.log
pm2 restart eth --cron-restart="7 0 */2 * *"