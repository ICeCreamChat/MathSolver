# MathSolver - AI 识题解题助手

这是一个基于 **SiliconFlow/Qwen2.5-VL** (视觉理解/OCR) 和 **DeepSeek** (逻辑推理) 的 AI 数学解题工具。

## 🚀 快速开始 (小白专用)

### 第一步：准备环境
确保你的电脑上安装了 **Node.js**。
- [点击下载 Node.js (长期支持版)](https://nodejs.org/)
- 下载后一路点击 "Next" 安装即可。

### 第二步：运行项目
1.  找到文件夹中的 **`start.bat`** 文件。
2.  双击运行它。
3.  **首次运行**时：
    - 它会自动下载需要的组件（需要等待几分钟）。
    - 它会自动打开一个记事本文件 (`.env`)。
    - 请将你的 API Key 填入其中（见下文配置说明），然后保存关闭记事本。
    - 回到黑色窗口按任意键继续。

### 第三步：使用
1.  看到 "MathSolver - AI 识题解题服务" 字样后，服务就启动成功了。
2.  打开浏览器，访问：[http://localhost:3003](http://localhost:3003)
3.  点击上传按钮上传题目图片即可。

---

## 🔑 配置说明
在打开的 `.env` 文件中，你需要关注以下几项：

| 配置项 | 说明 | 获取方式 |
| :--- | :--- | :--- |
| **SILICONFLOW_API_KEY** | 用于 OCR 识别 + 看图 | [SiliconFlow官网](https://cloud.siliconflow.cn) 申请 Key |
| **DEEPSEEK_API_KEY** | 用于 AI 解题 | [DeepSeek官网](https://platform.deepseek.com) 申请 Key |

**⚠️ 注意：**
- 只有配置了 Key，AI 才能正常工作，否则会显示 "Mock 模式" (模拟数据)。

---

## 🛠️ 开发者指南
如果你是开发者，也可以通过命令行运行：
```bash
npm install
node server.js
```
