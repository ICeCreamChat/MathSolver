$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 配置
$PORT = 3003
$URL = "http://localhost:$PORT"
$MaxRetries = 30
$RetryDelay = 1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   MathSolver - 智能启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 Node.js 环境
try {
    $nodeVersion = node -v
    Write-Host "[√] 检测到 Node.js: $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "[X] 未检测到 Node.js，请先安装: https://nodejs.org/" -ForegroundColor Red
    Read-Host "按回车键退出..."
    exit
}

# 2. 检查依赖
if (-not (Test-Path "node_modules")) {
    Write-Host "[!] 检测到首次运行，正在安装依赖..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] 依赖安装失败" -ForegroundColor Red
        Read-Host "按回车键退出..."
        exit
    }
}

# 3. 端口检查与自动清理
$portInUse = Get-NetTCPConnection -LocalPort $PORT -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "[!] 检测到端口 $PORT 被占用，正在尝试关闭旧进程..." -ForegroundColor Yellow
    
    foreach ($conn in $portInUse) {
        $pidToKill = $conn.OwningProcess
        # 跳过系统进程 (PID 0 和 4)
        if ($pidToKill -le 4) { continue }

        try {
            $process = Get-Process -Id $pidToKill -ErrorAction Stop
            Stop-Process -Id $pidToKill -Force -ErrorAction Stop
            Write-Host "    [√] 已结束进程 PID: $pidToKill ($($process.ProcessName))" -ForegroundColor Green
        }
        catch {
            Write-Host "    [!] 无法结束进程 PID ${pidToKill}: $_" -ForegroundColor Red
        }
    }
    
    Start-Sleep -Seconds 1
}

# 4. 启动服务器
Write-Host "[*] 正在启动服务器..." -ForegroundColor Cyan

$job = Start-Job -ScriptBlock {
    param($url, $retries, $delay)
    for ($i = 0; $i -lt $retries; $i++) {
        try {
            $res = Invoke-RestMethod -Uri "$url/api/health" -Method Get -ErrorAction Stop
            if ($res.status -eq 'ok') { return $true }
        }
        catch {
            Start-Sleep -Seconds $delay
        }
    }
    return $false
} -ArgumentList $URL, $MaxRetries, $RetryDelay

# 启动浏览器检测进程
Start-Process powershell -ArgumentList "-NoProfile -Command `
    `$i=0; `
    Write-Host '等待服务器就绪...' -ForegroundColor Cyan; `
    while(`$i -lt 30) { `
        try { `
            Request-AsJob $URL/api/health | Out-Null; `
            `$res = Invoke-WebRequest -Uri '$URL/api/health' -UseBasicParsing -ErrorAction Stop; `
            if (`$res.StatusCode -eq 200) { `
                Write-Host '服务器已就绪! 正在打开浏览器...' -ForegroundColor Green; `
                Start-Process '$URL'; `
                exit; `
            } `
        } catch { Start-Sleep -Seconds 1 } `
        `$i++; `
    } `
" -WindowStyle Hidden

# 5. 启动主进程 (阻塞显示日志)
Write-Host "[LOG] 服务器日志将显示在下方:" -ForegroundColor Gray
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    node server.js
}
catch {
    Write-Host "服务器异常退出: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "服务器已停止" -ForegroundColor Yellow
Pause
