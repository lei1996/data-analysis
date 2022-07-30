pm2 stop server
echo '' > ~/.pm2/logs/server-out.log
echo '' > ~/.pm2/logs/server-error.log
pm2 restart server --cron-restart=0