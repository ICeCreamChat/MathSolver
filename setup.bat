:: MathSolver
:: Copyright (c) 2026 ICeCreamChat
:: Licensed under the MIT License.

@echo off
chcp 65001 >nul
title MathSolver 一键配置

:: 切换到脚本所在目录（关键！）
cd /d "%~dp0"

echo.
echo ==================================================
echo   MathSolver - 一键配置脚本 (Windows)
echo ==================================================
echo.

:: 检查 Node.js
echo [1/4] 检查 Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] 错误: 未找到 Node.js
    echo     请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js 版本: %NODE_VER%

:: 检查 npm
echo.
echo [2/4] 检查 npm...
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] 错误: 未找到 npm
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
echo [OK] npm 版本: %NPM_VER%

:: 安装依赖
echo.
echo [3/4] 安装依赖...
echo     工作目录: %cd%
call npm install
if %errorlevel% neq 0 (
    echo [X] 依赖安装失败
    pause
    exit /b 1
)
echo [OK] 依赖安装完成

:: 检查/创建 .env
echo.
echo [4/4] 检查配置文件...
if not exist .env (
    if exist .env.example (
        copy .env.example .env >nul
        echo [OK] 已从 .env.example 创建 .env
        echo [!] 请编辑 .env 文件，填入你的 API Keys
    ) else (
        echo [!] 未找到 .env.example，请手动创建 .env
    )
) else (
    echo [OK] .env 配置文件已存在
)

echo.
echo ==================================================
echo   配置完成!
echo ==================================================
echo.
echo   启动服务: 双击 start.bat
echo   或运行: npm start
echo.
echo   访问地址: http://localhost:3003
echo.

pause
