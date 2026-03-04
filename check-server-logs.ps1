# 检查服务器日志的 PowerShell 脚本
$server = "47.86.23.16"
$keyPath = "C:\Users\MH\.ssh\MSIA"

Write-Host "正在连接服务器检查日志..." -ForegroundColor Green

# 检查后端错误日志
$checkErrorLogs = @"
sudo cat /root/.pm2/logs/msia-backend-error.log | tail -50
"@

# 检查后端输出日志
$checkOutputLogs = @"
sudo cat /root/.pm2/logs/msia-backend-out.log | tail -50
"@

# 检查 PM2 状态
$checkPm2Status = @"
sudo pm2 status
"@

Write-Host "`n=== PM2 状态 ===" -ForegroundColor Yellow
ssh -i $keyPath root@$server $checkPm2Status

Write-Host "`n=== 后端错误日志（最近50行）===" -ForegroundColor Red
ssh -i $keyPath root@$server $checkErrorLogs

Write-Host "`n=== 后端输出日志（最近50行）===" -ForegroundColor Cyan
ssh -i $keyPath root@$server $checkOutputLogs

Write-Host "`n日志检查完成" -ForegroundColor Green
