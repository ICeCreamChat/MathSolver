#!/bin/bash

# MathSolver
# Copyright (c) 2026 ICeCreamChat
# Licensed under the MIT License.

# 切换到脚本所在目录（关键！）
cd "$(dirname "$0")"

echo ""
echo "=================================================="
echo "  MathSolver - 一键配置脚本 (Linux/macOS)"
echo "=================================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Node.js
echo "[1/4] 检查 Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}[X] 错误: 未找到 Node.js${NC}"
    echo "    请先安装 Node.js: https://nodejs.org/"
    echo "    或使用: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    exit 1
fi
NODE_VER=$(node -v)
echo -e "${GREEN}[OK] Node.js 版本: $NODE_VER${NC}"

# 检查 npm
echo ""
echo "[2/4] 检查 npm..."
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[X] 错误: 未找到 npm${NC}"
    exit 1
fi
NPM_VER=$(npm -v)
echo -e "${GREEN}[OK] npm 版本: $NPM_VER${NC}"

# 安装依赖
echo ""
echo "[3/4] 安装依赖..."
echo "    工作目录: $(pwd)"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}[X] 依赖安装失败${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] 依赖安装完成${NC}"

# 检查/创建 .env
echo ""
echo "[4/4] 检查配置文件..."
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}[OK] 已从 .env.example 创建 .env${NC}"
        echo -e "${YELLOW}[!] 请编辑 .env 文件，填入你的 API Keys${NC}"
    else
        echo -e "${YELLOW}[!] 未找到 .env.example，请手动创建 .env${NC}"
    fi
else
    echo -e "${GREEN}[OK] .env 配置文件已存在${NC}"
fi

echo ""
echo "=================================================="
echo -e "  ${GREEN}配置完成!${NC}"
echo "=================================================="
echo ""
echo "  启动服务: ./start.sh"
echo "  或运行: npm start"
echo ""
echo "  访问地址: http://localhost:3003"
echo ""
