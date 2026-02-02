# MathSolver

MathSolver 是一个基于前沿多模态大模型的智能解题系统，专为处理复杂的中文数学题目（含几何图形、函数图表）而设计。它采用了独特的 **"双引擎" (Double Engine)** 架构，将顶尖的视觉理解能力与逻辑推理能力解耦并重组，实现了远超单一模型的解题准确率。

> **核心理念**: 让视觉模型专攻"看"，让推理模型专攻"想"，通过精细的中间层处理（图表裁剪、OCR 矫正）连接两者。

---

## ✨ 核心特性

### 🧠 双引擎协同架构 (Double Engine Architecture)
- **Engine A (Vision)**: 基于 **Qwen2.5-VL-72B** (via SiliconFlow)，负责视觉感知的全流程。
  - **语义描述**: 生成对图片中几何形状、空间关系的自然语言描述。
  - **自适应 OCR**: 根据视觉描述动态调整提示词，精准提取公式（LaTeX）和文本。
- **Engine B (Reasoning)**: 基于 **DeepSeek V3** (DeepSeek-Chat)，负责纯文本的逻辑推理。
  - **三段式解答**: 严格遵循 "模型判断 -> 解题思路 -> 详细步骤" 的输出结构。

### 🎯 智能图表处理管线 (Multi-Layer Diagram Pipeline)
内置一套鲁棒的图表检测与提取系统，专门应对数理化题目中的插图：
1.  **Layer 0 (Cloud)**: 集成 **MinerU** PDF/文档解析服务（可选），用于处理复杂文档源。
2.  **Layer 1 (Grounding)**: 使用 **Qwen-VL** 进行 Grounding 检测，返回精确的 2D 边界框 (`bbox_2d`)。
3.  **Layer 4 (Fallback)**: 兜底视觉 API，在 Grounding 失败时通过常规视觉模型估算图形区域。
4.  **Pixel-Level Beautification**: 使用 `sharp` 进行像素级处理，自动检测背景色并进行“去噪白化”和“线条加深”，确保图表清晰。

### 💻 极简模块化前端
- **Zero-Dependency**: 摒弃 React/Vue 等重型框架，使用原生 ES6+ JavaScript 模块化开发 (`js/*.js`)。
- **Immersive UX**: 包含粒子背景引擎 (`ParticleEngine`)、光标跟随特效 (`CursorEffects`) 和 Markdown/LaTeX 实时渲染。
- **Robustness**: 内置全局错误捕获、TTS 语音播报、Toast 通知系统。

---

## 🛠 技术栈深度解析

### 后端 (Node.js)
- **核心框架**: Express.js (HTTP Server), Node.js Stream API.
- **图像处理**: `sharp` - 用于高性能图片缩放、裁剪、像素操作。
- **文件处理**: `multer` - 处理 `multipart/form-data` 图片上传。
- **服务集成**: `node-fetch` - 与 SiliconFlow、DeepSeek、MinerU API 通信。

### 前端 (Vanilla JS)
采用模块化设计模式 (Module Pattern)，代码位于 `public/js/`：
- `state_manager.js`: 集中管理应用状态 (LocalStorage 持久化)。
- `chat_system.js`: 管理对话上下文锚点 (Context Anchoring) 和历史记录。
- `math_renderer.js`: 封装 `marked` 和 `KaTeX` (或 MathJax) 用于渲染数学公式。
- `particle_engine.js`: 自定义 Canvas 粒子动画引擎，支持性能自适应。

---

## 🚀 快速开始

### 1. 环境准备
确保你的环境满足以下要求：
- **Node.js**: >= 18.0.0 (需要支持 fetch API 和 ES Modules)
- **npm**: >= 9.0.0

### 2. 安装项目

```bash
git clone https://github.com/ICeCreamChat/MathSolver.git
cd MathSolver
npm install
```

### 3. 配置环境变量

项目根目录包含 `.env.example`。复制一份并重命名为 `.env`：

```bash
cp .env.example .env
```

**关键配置项说明**:

| 变量名 | 必填 | 默认值 | 描述 |
|--------|:---:|-------|------|
| `SILICONFLOW_API_KEY` | ✅ | - | 用于 Qwen2.5-VL (OCR & 描述)。注册: [SiliconFlow](https://siliconflow.cn/) |
| `DEEPSEEK_API_KEY` | ✅ | - | 用于 DeepSeek V3 (推理)。注册: [DeepSeek](https://platform.deepseek.com/) |
| `PORT` | ❌ | 3003 | 服务器监听端口 |
| `DEEPSEEK_API_URL` | ❌ | 官方API | 可配置为第三方中转 API 地址 |
| `MINERU_API_KEY` | ❌ | - | (可选) MinerU 文档解析服务 Key |
| `MINERU_ENABLED` | ❌ | false | 是否启用 MinerU (设为 `true` 开启 Layer 0 检测) |

### 4. 启动服务

**生产/开发启动**:
```bash
npm start
# 或
node server.js
```

**Mock 模式 (无 Key 体验)**:
如果未配置 API Key，系统会自动进入 **Mock Mode**。
- 这里会使用预置的响应数据 (`services/config.js` 中的 `MOCK_DATA`)。
- 此时无论上传什么图片，都会返回一道关于"等腰三角形全等证明"的示例题。

访问浏览器: [http://localhost:3003](http://localhost:3003)

### 5. 便捷脚本
- **Windows**: 双击 `run_one_click.bat` 可一键安装依赖并启动。
- **Linux/Mac**: 运行 `./run_one_click.sh`。

---

## 📂 详细架构流程

当一个 `POST /api/solve` 请求到达时，系统按以下流转处理：

```mermaid
graph TD
    A[Client Upload Image] --> B(Server Uploads Dir)
    B --> C{API Keys Set?}
    C -- No --> D[Return Mock Data]
    C -- Yes --> E[Parallel Execution]
    
    E --> F[Vision Service]
    E --> G[Diagram Service]
    
    subgraph "Engine A (Vision)"
    F --> F1[Qwen2.5-VL Describe]
    F1 --> F2[Adaptive Prompt Gen]
    F2 --> F3[Qwen2.5-VL OCR]
    end
    
    subgraph "Diagram Pipeline"
    G --> G1{MinerU Enabled?}
    G1 -- Yes --> G2[MinerU Integration]
    G1 -- No --> G3[Qwen Grounding (Layer 1)]
    G3 -- Fail --> G4[Fallback API (Layer 4)]
    G3 -- Success --> G5[Beautify & Crop]
    G4 --> G5
    end
    
    F3 --> H[Combine Context]
    G5 --> H
    F1 --> H
    
    subgraph "Engine B (Reasoning)"
    H --> I[DeepSeek V3 Inference]
    I --> J[Generate Structured Solution]
    end
    
    J --> K[JSON Response]
```

---

## 🔌 API 接口文档

### 1. 核心解题接口 (Core Solver)

**POST** `/api/solve`

处理图片上传并返回完整的解题分析。

- **Header**: `Content-Type: multipart/form-data`
- **Body**:
  - `image`: 文件二进制流 (优先)
  - `imageBase64`: Base64 字符串 (可选，用于剪贴板粘贴场景)

**Response (Success)**:
```json
{
  "success": true,
  "isMockMode": false,
  "timing": {
    "total": 4512
  },
  "data": {
    "extractedText": "求解方程 x^2 - 4 = 0...",
    "imageDescription": "图片显示了一个二次方程...",
    "diagramBase64": "data:image/png;base64,iVBORw0KGgo...",
    "solution": "**第一步：模型判断**\n这是二次方程...\n\n**第二步：解题思路**\n使用因式分解..."
  }
}
```

### 2. 多轮对话接口 (Chat)

**POST** `/api/chat`

纯文本对话接口，用于对题目进行追问。系统会将之前的"题目上下文" (Context Anchoring) 注入到 System Prompt 中。

- **Header**: `Content-Type: application/json`
- **Body**:
```json
{
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "为什么这里要舍去负根？" }
  ],
  "model": "deepseek-chat",
  "temperature": 0.7
}
```

---

## 🎨 前端模块说明

位于 `public/js/` 的核心模块：

| 模块 | 说明 |
|------|------|
| `ApiClient` (`api_client.js`) | 封装 fetch 请求，处理 FormData 和 JSON 通信 |
| `CropperHandler` (`cropper_handler.js`) | 处理图片上传前的裁剪交互 |
| `UiManager` (`ui_manager.js`) | 负责侧边栏、Loading 状态、DOM 更新 |
| `ThemeManager` (`theme_manager.js`) | 亮色/暗色模式切换，控制 CSS 变量 |
| `TTSHandler` (`tts_handler.js`) | 浏览器原生 `speechSynthesis` 封装 |
| `Constants` (`constants.js`) | 存储全局常量 (如最大历史记录数) |

---

## 📝 开发指南

### Mock 开发
在 `services/config.js` 中可以修改 `MOCK_DATA` 对象，用于测试前端在不同数据返回下的渲染表现（例如测试极长公式的 LaTeX 渲染）。

### 部署建议
推荐使用 PM2 进行进程管理：
```bash
npm install -g pm2
pm2 start server.js --name "math-solver"
```

对于生产环境，建议在 Nginx 反向代理层开启 gzip 压缩，以加速大段 Science/Math 文本和 Base64 图片的传输。

---

## 📄 License
Copyright (c) 2026 **ICeCreamChat**.
Licensed under the [MIT License](LICENSE).
