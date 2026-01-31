#!/bin/bash

# MathSolver
# Copyright (c) 2026 ICeCreamChat
# Licensed under the MIT License.

# 切换到脚本所在目录（关键！）
cd "$(dirname "$0")"

echo ""
echo "=================================================="
echo "  MathSolver - 启动服务器"
echo "=================================================="
echo ""

# 检查 .env
if [ ! -f .env ]; then
    echo "[!] 未找到 .env 配置文件"
    echo "    请先运行 ./setup.sh 或手动创建 .env"
    exit 1
fi

# 检查 node_modules
if [ ! -d node_modules ]; then
    echo "[!] 未找到依赖，正在安装..."
    npm install
fi

echo "正在启动服务器..."
echo "工作目录: $(pwd)"
echo ""
node server.js
