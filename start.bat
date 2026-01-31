:: MathSolver
:: Copyright (c) 2026 ICeCreamChat
:: Licensed under the MIT License.

@echo off
chcp 65001 >nul
title MathSolver 服务器

:: 切换到脚本所在目录（关键！）
cd /d "%~dp0"

echo.
echo ==================================================
echo   MathSolver - 启动服务器
echo ==================================================
echo.

:: 检查 .env
if not exist .env (
    echo [!] 未找到 .env 配置文件
    echo     请先运行 setup.bat 或手动创建 .env
    pause
    exit /b 1
)

:: 检查 node_modules
if not exist node_modules (
    echo [!] 未找到依赖，正在安装...
    call npm install
)

echo 正在启动服务器...
echo 工作目录: %cd%
echo.
node server.js

pause
