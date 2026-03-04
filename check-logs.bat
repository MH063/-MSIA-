@echo off
chcp 65001 >nul
echo 正在检查服务器日志...

ssh -i C:\Users\MH\.ssh\MSIA root@47.86.23.16 "sudo pm2 status"

echo.
echo === 错误日志 ===
ssh -i C:\Users\MH\.ssh\MSIA root@47.86.23.16 "sudo cat /root/.pm2/logs/msia-backend-error.log | tail -30"

echo.
echo === 输出日志 ===
ssh -i C:\Users\MH\.ssh\MSIA root@47.86.23.16 "sudo cat /root/.pm2/logs/msia-backend-out.log | tail -30"

echo.
echo 检查完成
