# MathSolver 📐

AI 数学解题助手 - 三引擎智能架构

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ 功能特点

- 📸 **图片识别** - 拍照上传数学题，自动识别题目内容
- 🔍 **OCR 提取** - 高精度文字识别，支持数学公式
- 📊 **图形检测** - 自动提取几何图形、函数图像
- 🧠 **智能解答** - AI 分步骤详细讲解解题过程
- 📱 **响应式设计** - 支持手机、平板、电脑

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                      MathSolver                         │
├─────────────────────────────────────────────────────────┤
│  引擎 A: SiliconFlow API                                │
│  ├── Qwen2.5-VL-72B (视觉理解 + OCR)                    │
│  └── 图形描述、文字识别                                  │
├─────────────────────────────────────────────────────────┤
│  引擎 B: DeepSeek API                                   │
│  ├── DeepSeek Chat (逻辑推理)                           │
│  └── 三段式解题：模型判断 → 解题思路 → 详细步骤          │
├─────────────────────────────────────────────────────────┤
│  引擎 D: MinerU + Qwen Grounding                        │
│  ├── MinerU 云 API (最高精度图形提取)                   │
│  └── Qwen Grounding (边界框检测)                        │
└─────────────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 8+

### 一键配置

**Windows:**
```batch
setup.bat
```

**Linux/macOS:**
```bash
chmod +x setup.sh
./setup.sh
```

### 手动配置

```bash
# 克隆项目
git clone https://github.com/ICeCreamChat/MathSolver.git
cd MathSolver

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入 API Keys

# 启动服务
npm start
```

### 启动服务

**Windows:**
```batch
start.bat
```

**Linux/macOS:**
```bash
./start.sh
```

访问 http://localhost:3003

## ⚙️ 配置说明

编辑 `.env` 文件：

```env
# SiliconFlow API (视觉模型)
SILICONFLOW_API_KEY=sk-xxx

# DeepSeek API (推理模型)  
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions

# MinerU 云 API (文档解析，可选)
MINERU_ENABLED=true
MINERU_API_KEY=eyJxxx...
MINERU_URL=https://mineru.net

# 服务器端口
PORT=3003
```

### API 获取方式

| API | 获取地址 |
|-----|----------|
| SiliconFlow | https://cloud.siliconflow.cn |
| DeepSeek | https://platform.deepseek.com |
| MinerU | https://mineru.net |

## 📁 项目结构

```
MathSolver/
├── server.js        # 主服务 (1080 行)
├── package.json     # 依赖配置
├── .env.example     # 环境变量模板
├── .gitignore       # Git 忽略规则
├── setup.bat/sh     # 一键配置脚本
├── start.bat/sh     # 启动脚本
└── public/          # 前端静态文件
    ├── index.html   # 主页面
    ├── script.js    # 前端逻辑
    └── style.css    # 样式文件
```

## 🔌 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/solve` | POST | 上传图片，返回解题结果 |
| `/api/chat` | POST | 文字对话 |
| `/api/health` | GET | 健康检查 |

## 📄 许可证

[MIT License](LICENSE)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系

- GitHub: [@ICeCreamChat](https://github.com/ICeCreamChat)
