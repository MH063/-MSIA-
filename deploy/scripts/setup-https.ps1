param(
  [string]$Domain = "121-196-232-211.sslip.io",
  [string]$Email = "",
  [switch]$Renew = $false,
  [switch]$SetupRenew = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info {
  param([string]$Message)
  Write-Host "[INFO] $Message"
}

function Write-ErrorMsg {
  param([string]$Message)
  Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# 函数：创建所需目录（client/certs、client/.well-known、certbot）
function Ensure-Directories {
  <#
    .SYNOPSIS
    创建证书与挑战文件所需目录
    .DESCRIPTION
    在项目根目录下创建 client\certs、client\.well-known 与 certbot 文件夹，
    用于 Nginx 挂载证书与 Let’s Encrypt HTTP-01 挑战文件以及证书持久化。
  #>
  $root = (Get-Location).Path
  $paths = @(
    Join-Path $root "client\certs",
    Join-Path $root "client\.well-known",
    Join-Path $root "certbot"
  )
  foreach ($p in $paths) {
    if (-not (Test-Path $p)) {
      New-Item -ItemType Directory -Path $p | Out-Null
      Write-Info "已创建目录：$p"
    }
  }
}

# 函数：使用 Docker 运行 certbot 进行首次签发或续期
function Invoke-Certbot {
  <#
    .SYNOPSIS
    调用 certbot 容器执行签发或续期
    .DESCRIPTION
    通过 webroot 模式使用 client\.well-known 作为挑战目录，certbot 配置存储在项目根 certbot 目录。
    首次签发使用 certonly；续期使用 renew。
  #>
  $root = (Get-Location).Path
  $webroot = Join-Path $root "client\.well-known"
  $letsencrypt = Join-Path $root "certbot"

  $emailArgs = @()
  if ([string]::IsNullOrWhiteSpace($Email)) {
    $emailArgs = @("--register-unsafely-without-email")
  } else {
    $emailArgs = @("-m", $Email)
  }

  if ($Renew) {
    Write-Info "开始执行证书续期：$Domain"
    $cmd = @(
      "docker", "run", "--rm", "--name", "msia-certbot-renew",
      "-v", "${webroot}:/var/www/certbot",
      "-v", "${letsencrypt}:/etc/letsencrypt",
      "certbot/certbot", "renew",
      "--webroot-path", "/var/www/certbot",
      "-n"
    )
  } else {
    Write-Info "开始执行首次签发：$Domain"
    $cmd = @(
      "docker", "run", "--rm", "--name", "msia-certbot-issue",
      "-v", "${webroot}:/var/www/certbot",
      "-v", "${letsencrypt}:/etc/letsencrypt",
      "certbot/certbot", "certonly",
      "--webroot", "-w", "/var/www/certbot",
      "-d", $Domain,
      "--agree-tos",
      "-n"
    ) + $emailArgs
  }

  Write-Info ("执行命令：" + ($cmd -join " "))
  $p = Start-Process -FilePath $cmd[0] -ArgumentList ($cmd[1..($cmd.Length-1)]) -NoNewWindow -PassThru -Wait
  if ($p.ExitCode -ne 0) {
    throw "certbot 执行失败，退出码：$($p.ExitCode)"
  }
  Write-Info "certbot 执行完成"
}

# 函数：拷贝证书到 Nginx 挂载目录并触发热重载
function Publish-Certs {
  <#
    .SYNOPSIS
    拷贝证书到 client\certs 并重载 Nginx
    .DESCRIPTION
    从 certbot\live\<domain>\ 复制 fullchain.pem 与 privkey.pem 到 client\certs，
    然后在 msia_client 容器中执行 Nginx 热重载。
  #>
  $root = (Get-Location).Path
  $srcDir = Join-Path $root ("certbot\live\" + $Domain)
  $dstDir = Join-Path $root "client\certs"

  $fullchain = Join-Path $srcDir "fullchain.pem"
  $privkey   = Join-Path $srcDir "privkey.pem"

  if (-not (Test-Path $fullchain)) { throw "未找到文件：$fullchain" }
  if (-not (Test-Path $privkey))   { throw "未找到文件：$privkey" }

  Copy-Item -Force $fullchain (Join-Path $dstDir "fullchain.pem")
  Copy-Item -Force $privkey   (Join-Path $dstDir "privkey.pem")
  Write-Info "证书已发布到：$dstDir"

  # Reload Nginx inside client container if running
  $container = "msia_client"
  $running = (& docker ps --format "{{.Names}}" | Where-Object { $_ -eq $container })
  if ($running) {
    Write-Info "检测到容器运行中，开始执行 Nginx 重载"
    $p = Start-Process -FilePath "docker" -ArgumentList @("exec", $container, "nginx", "-s", "reload") -NoNewWindow -PassThru -Wait
    if ($p.ExitCode -ne 0) {
      Write-ErrorMsg "Nginx 重载失败（容器仍会使用已更新证书文件，但建议手动重启容器）"
    } else {
      Write-Info "Nginx 重载完成"
    }
  } else {
    Write-Info "容器未运行，证书将在下次启动时生效"
  }
}

# 函数：创建 Windows 计划任务以自动续期
function Setup-RenewSchedule {
  <#
    .SYNOPSIS
    创建证书自动续期计划任务
    .DESCRIPTION
    使用 schtasks 每周日凌晨执行续期脚本，续期后自动发布并重载 Nginx。
    若需调整频率，可手动修改计划任务。
  #>
  $scriptPath = (Join-Path (Get-Location).Path "deploy\scripts\setup-https.ps1")
  $taskName = "MSIA-SSL-Renew"
  $args = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Domain `"$Domain`" -Renew"
  Write-Info "创建计划任务：$taskName"
  $createCmd = @(
    "schtasks.exe", "/Create",
    "/SC", "WEEKLY",
    "/D", "SUN",
    "/ST", "03:00",
    "/RL", "HIGHEST",
    "/TN", $taskName,
    "/TR", "powershell.exe $args",
    "/F"
  )
  $p = Start-Process -FilePath $createCmd[0] -ArgumentList ($createCmd[1..($createCmd.Length-1)]) -NoNewWindow -PassThru -Wait
  if ($p.ExitCode -ne 0) {
    Write-ErrorMsg "计划任务创建失败，请以管理员权限运行或手动创建"
  } else {
    Write-Info "计划任务创建完成：$taskName"
  }
}

# 主流程
try {
  Ensure-Directories
  Invoke-Certbot
  Publish-Certs
  if ($SetupRenew) {
    Setup-RenewSchedule
  }
  Write-Info "全部完成"
} catch {
  Write-ErrorMsg $_.Exception.Message
  exit 1
}
