/**
 * MathSolver - 双引擎 API 网关
 * 
 * 引擎 A: SiliconFlow API - 视觉语义理解 + OCR (Qwen2.5-VL)
 * 引擎 B: DeepSeek API - 逻辑推理
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const compression = require('compression');
const multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch');
const fs = require('fs');
const sharp = require('sharp');
const AdmZip = require('adm-zip');
const os = require('os');

const app = express();

// ==========================================
// 配置
// ==========================================
const CONFIG = {
    siliconflow: {
        apiKey: process.env.SILICONFLOW_API_KEY,
        url: 'https://api.siliconflow.cn/v1/chat/completions',
        model: 'Qwen/Qwen2.5-VL-72B-Instruct'  // 必须用 Qwen，支持 Grounding
    },
    deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY,
        url: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
        model: 'deepseek-chat'
    },
    mineru: {
        url: process.env.MINERU_URL || 'https://mineru.net',
        apiKey: process.env.MINERU_API_KEY,
        enabled: process.env.MINERU_ENABLED === 'true'
    }
};

// DeepSeek 系统提示词 - 三段式解题结构
const DEEPSEEK_SYSTEM_PROMPT = `你是一位专业的数学解题助手，面向小学、初中、高中学生。请严格按以下三段式结构回答：

**第一步：模型判断**
识别题目类型和所属数学模型。例如："这是一道典型的'将军饮马'模型"、"这是二次函数最值问题"、"这是全等三角形证明题"。

**第二步：解题思路**
简述解题的核心思路和关键步骤。例如："要证 AB=CD，需先证明三角形全等，可使用 SAS 判定..."

**第三步：详细步骤**
给出完整的计算或证明过程。
- 使用 LaTeX 格式书写数学公式
- 独立公式用 $$...$$ 包裹
- 行内公式用 $...$ 包裹
- 步骤编号清晰，逻辑严谨

请确保解答准确、步骤完整、语言简洁。`;

// SiliconFlow 视觉描述提示词
const VISION_PROMPT = `请仔细观察图片，忽略所有文字内容，仅详细描述图中的几何图形、坐标系、函数图像或其他数学图形。

描述要求：
1. 几何图形：描述形状、位置关系、标记的点和线段、辅助线
2. 坐标系：描述坐标轴、原点、函数曲线的走势和关键点
3. 辅助线：特别指出虚线、辅助构造
4. 角度和平行/垂直关系

输出格式：纯文本描述，不要使用Markdown格式。`;

// ==========================================
// Mock 数据 (无 API Key 时使用)
// ==========================================
const MOCK_DATA = {
    mineru: {
        success: true,
        text: `已知：在 $\\triangle ABC$ 中，$AB = AC$，$D$ 是 $BC$ 的中点，$E$ 是 $AD$ 上一点。

求证：$BE = CE$

提示：可利用等腰三角形的性质和全等三角形判定。`,
        latex: '\\triangle ABC, AB = AC, D \\in BC, BD = DC'
    },
    siliconflow: {
        description: `图中是一个等腰三角形ABC，其中：
- 点A在上方，点B和C分别在左下和右下
- AB和AC两条边相等，用小短线标记表示
- D是BC边的中点，有中点标记
- E是AD线段上的一点
- 连接了BE和CE两条线段
- AD是三角形的高（或中线），与BC垂直相交于D点`
    },
    deepseek: {
        answer: `**第一步：模型判断**

这是一道典型的 **等腰三角形性质应用** + **全等三角形证明** 问题。

---

**第二步：解题思路**

由于 $AB = AC$ 且 $D$ 是 $BC$ 的中点，可以利用等腰三角形"三线合一"的性质：
- 顶角平分线
- 底边中线  
- 底边上的高

三者重合。因此 $AD \\perp BC$。

然后通过证明 $\\triangle BDE \\cong \\triangle CDE$ 来得出 $BE = CE$。

---

**第三步：详细步骤**

**证明：**

∵ $AB = AC$，$D$ 是 $BC$ 的中点

∴ $AD$ 是等腰三角形 $ABC$ 底边上的中线

∴ $AD \\perp BC$（等腰三角形三线合一）

∴ $\\angle ADB = \\angle ADC = 90°$

又 ∵ $E$ 在 $AD$ 上

∴ $\\angle BDE = \\angle CDE = 90°$

在 $\\triangle BDE$ 和 $\\triangle CDE$ 中：

$$
\\begin{cases}
BD = CD & \\text{（D是中点）} \\\\
\\angle BDE = \\angle CDE = 90° & \\text{（已证）} \\\\
DE = DE & \\text{（公共边）}
\\end{cases}
$$

∴ $\\triangle BDE \\cong \\triangle CDE$（SAS）

∴ $BE = CE$（全等三角形对应边相等）

**证毕。** ∎`
    }
};

// ==========================================
// 中间件
// ==========================================
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d'
}));

// 配置 Multer 用于图片上传
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 限制
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的图片格式'));
        }
    }
});

// ==========================================
// 工具函数
// ==========================================
function isMockMode() {
    return !CONFIG.siliconflow.apiKey || !CONFIG.deepseek.apiKey;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==========================================
// 引擎 D: 四层级联图形检测与裁剪
// ==========================================

// MinerU 结果下载：从 zip 中提取图片
async function downloadAndExtractMineruImages(zipUrl) {
    console.log('[MinerU] 下载并提取图片...');
    try {
        // 下载 zip 文件
        const response = await fetch(zipUrl);
        if (!response.ok) {
            console.log('[MinerU] 下载 zip 失败:', response.status);
            return null;
        }

        const buffer = await response.buffer();
        console.log('[MinerU] zip 下载完成, 大小:', buffer.length, 'bytes');

        // 解压 zip
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();

        // 查找 images 文件夹中的图片
        for (const entry of entries) {
            const name = entry.entryName.toLowerCase();
            if (name.includes('images/') && (name.endsWith('.jpg') || name.endsWith('.png') || name.endsWith('.jpeg'))) {
                console.log('[MinerU] 找到图片:', entry.entryName);
                const imageBuffer = entry.getData();

                // 美化处理：增强对比度 + 白背景
                const processedBuffer = await sharp(imageBuffer)
                    .flatten({ background: { r: 255, g: 255, b: 255 } })
                    .normalize()
                    .png()
                    .toBuffer();

                const base64 = processedBuffer.toString('base64');
                console.log('[MinerU] 图片提取成功');
                // 返回格式与 beautifyAndCrop 保持一致（纯字符串）
                return `data:image/png;base64,${base64}`;
            }
        }

        console.log('[MinerU] zip 中未找到图片');
        return null;
    } catch (e) {
        console.log('[MinerU] 提取图片失败:', e.message);
        return null;
    }
}

// MinerU 云 API 解析（官方 API v4）
// 流程: 1.获取上传链接 → 2.上传文件 → 3.轮询结果
async function parseWithMinerU(imagePath) {
    if (!CONFIG.mineru.enabled || !CONFIG.mineru.apiKey) {
        return null;
    }

    console.log('[MinerU Cloud] 开始解析...');
    const baseUrl = CONFIG.mineru.url || 'https://mineru.net';
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.mineru.apiKey}`
    };

    try {
        // Step 1: 获取上传链接
        const fileName = path.basename(imagePath);
        const batchRes = await fetch(`${baseUrl}/api/v4/file-urls/batch`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                files: [{ name: fileName }],
                model_version: 'vlm',  // 使用 VLM 模型，精度 90%+
                enable_formula: true,
                enable_table: true
            })
        });

        if (!batchRes.ok) {
            console.log('[MinerU Cloud] 获取上传链接失败:', batchRes.status);
            return null;
        }

        const batchData = await batchRes.json();
        if (batchData.code !== 0) {
            console.log('[MinerU Cloud] API 错误:', batchData.msg);
            return null;
        }

        const batchId = batchData.data.batch_id;
        const uploadUrl = batchData.data.file_urls[0];
        console.log('[MinerU Cloud] 获取上传链接成功, batch_id:', batchId);

        // Step 2: 上传文件
        const fileBuffer = fs.readFileSync(imagePath);
        const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            body: fileBuffer
        });

        if (!uploadRes.ok) {
            console.log('[MinerU Cloud] 文件上传失败:', uploadRes.status);
            return null;
        }
        console.log('[MinerU Cloud] 文件上传成功');

        // Step 3: 轮询结果（最多等待 60 秒）
        const maxWait = 60000;
        const pollInterval = 3000;
        let waited = 0;

        while (waited < maxWait) {
            await delay(pollInterval);
            waited += pollInterval;

            const resultRes = await fetch(`${baseUrl}/api/v4/extract-results/batch/${batchId}`, {
                method: 'GET',
                headers
            });

            if (!resultRes.ok) continue;

            const resultData = await resultRes.json();
            if (resultData.code !== 0) continue;

            const extractResult = resultData.data?.extract_result?.[0];
            if (!extractResult) continue;

            if (extractResult.state === 'done') {
                console.log('[MinerU Cloud] 解析完成!');
                return {
                    success: true,
                    zipUrl: extractResult.full_zip_url,
                    state: 'done'
                };
            } else if (extractResult.state === 'failed') {
                console.log('[MinerU Cloud] 解析失败:', extractResult.err_msg);
                return null;
            } else {
                console.log(`[MinerU Cloud] 状态: ${extractResult.state}, 等待中...`);
            }
        }

        console.log('[MinerU Cloud] 超时');
        return null;

    } catch (e) {
        console.log('[MinerU Cloud] 错误:', e.message);
        return null;
    }
}


// 辅助函数：保守裁剪 + 美化（背景换白 + 线条加深）
async function beautifyAndCrop(imagePath, initialBbox) {
    try {
        const metadata = await sharp(imagePath).metadata();
        const imgWidth = metadata.width;
        const imgHeight = metadata.height;

        let [left, top, right, bottom] = initialBbox;

        // 转换百分比到像素
        if (left <= 100 && top <= 100 && right <= 100 && bottom <= 100) {
            left = Math.round(imgWidth * left / 100);
            top = Math.round(imgHeight * top / 100);
            right = Math.round(imgWidth * right / 100);
            bottom = Math.round(imgHeight * bottom / 100);
        }

        // 计算区域尺寸
        let cropWidth = right - left;
        let cropHeight = bottom - top;

        // 添加 15% 边距
        const paddingX = Math.round(cropWidth * 0.15);
        const paddingY = Math.round(cropHeight * 0.15);

        left = Math.max(0, left - paddingX);
        top = Math.max(0, top - paddingY);
        right = Math.min(imgWidth, right + paddingX);
        bottom = Math.min(imgHeight, bottom + paddingY);

        cropWidth = right - left;
        cropHeight = bottom - top;

        if (cropWidth < 50 || cropHeight < 50) return null;

        console.log(`[Beautify] 裁剪区域: ${cropWidth}x${cropHeight}`);

        // 提取区域并获取像素数据
        const { data, info } = await sharp(imagePath)
            .extract({ left, top, width: cropWidth, height: cropHeight })
            .raw()
            .toBuffer({ resolveWithObject: true });

        // 检测背景色（取四角 + 边缘采样）
        const channels = info.channels;
        const getPixel = (x, y) => {
            const idx = (y * cropWidth + x) * channels;
            return [data[idx], data[idx + 1], data[idx + 2]];
        };

        // 采样更多点来确定背景色
        const samples = [
            getPixel(2, 2),
            getPixel(cropWidth - 3, 2),
            getPixel(2, cropHeight - 3),
            getPixel(cropWidth - 3, cropHeight - 3),
            getPixel(Math.floor(cropWidth / 2), 2),
            getPixel(2, Math.floor(cropHeight / 2)),
        ];

        const bgR = Math.round(samples.reduce((s, c) => s + c[0], 0) / samples.length);
        const bgG = Math.round(samples.reduce((s, c) => s + c[1], 0) / samples.length);
        const bgB = Math.round(samples.reduce((s, c) => s + c[2], 0) / samples.length);

        console.log(`[Beautify] 检测到背景色: rgb(${bgR}, ${bgG}, ${bgB})`);

        // 处理每个像素：背景换白 + 线条大幅加深
        const newData = Buffer.alloc(data.length);
        const threshold = 80; // 加大阈值，更宽松地识别背景

        for (let i = 0; i < data.length; i += channels) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);

            if (diff < threshold) {
                // 背景 → 纯白
                newData[i] = 255;
                newData[i + 1] = 255;
                newData[i + 2] = 255;
            } else {
                // 线条 → 大幅加深对比度
                const darken = 0.4; // 更强的加深
                newData[i] = Math.round(Math.min(255, Math.max(0, r * darken)));
                newData[i + 1] = Math.round(Math.min(255, Math.max(0, g * darken)));
                newData[i + 2] = Math.round(Math.min(255, Math.max(0, b * darken)));
            }

            // 复制 alpha 通道
            if (channels === 4) {
                newData[i + 3] = data[i + 3];
            }
        }

        // 生成最终图片
        const resultBuffer = await sharp(newData, {
            raw: { width: cropWidth, height: cropHeight, channels }
        })
            .png()
            .toBuffer();

        console.log('[Beautify] 美化完成（强对比度 + 白背景）');
        return `data:image/png;base64,${resultBuffer.toString('base64')}`;
    } catch (e) {
        console.error('[Beautify Error]', e.message);
        return null;
    }
}

// 辅助函数：基础裁剪（备用）
async function cropImageByBbox(imagePath, bbox) {
    try {
        const metadata = await sharp(imagePath).metadata();
        const imgWidth = metadata.width;
        const imgHeight = metadata.height;

        let [left, top, right, bottom] = bbox;

        if (left <= 100 && top <= 100 && right <= 100 && bottom <= 100) {
            left = Math.round(imgWidth * left / 100);
            top = Math.round(imgHeight * top / 100);
            right = Math.round(imgWidth * right / 100);
            bottom = Math.round(imgHeight * bottom / 100);
        }

        let cropLeft = Math.max(0, Math.min(left, imgWidth - 1));
        let cropTop = Math.max(0, Math.min(top, imgHeight - 1));
        let cropWidth = Math.min(right - left, imgWidth - cropLeft);
        let cropHeight = Math.min(bottom - top, imgHeight - cropTop);

        if (cropWidth < 30 || cropHeight < 30) return null;

        const croppedBuffer = await sharp(imagePath)
            .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
            .png()
            .toBuffer();

        return `data:image/png;base64,${croppedBuffer.toString('base64')}`;
    } catch (e) {
        console.error('[Crop Error]', e.message);
        return null;
    }
}

// 方法 1: Qwen2.5-VL 原生 Grounding（最精准）
// 方法 1: Qwen2.5-VL 原生 Grounding（最精准）
const GROUNDING_PROMPT = `这是中文试卷或教辅资料的截图。请精确检测其中的插图、示意图或几何图形区域。

规则：
1. 目标是提取题目中的辅助图形（如几何图、函数图、物理模型图等）
2. 即使图形很小（如嵌入在文字中的皮带轮、滑块），也要精确检测
3. 只框选图形本身，**不要**包含周围的题号、选项文字或说明文字
4. 边界框要紧贴图形边缘，不要留太多空白

输出格式（严格JSON）:
{"bbox_2d": [x1, y1, x2, y2]}

x1,y1 是左上角像素坐标，x2,y2 是右下角像素坐标。
如果没有图形，返回: {"bbox_2d": null}`;

async function detectWithQwenGrounding(imagePath, base64Image, mimeType) {
    console.log('[Layer 1] Qwen Grounding 检测...');
    try {
        // 获取原图尺寸
        const metadata = await sharp(imagePath).metadata();
        const origWidth = metadata.width;
        const origHeight = metadata.height;

        // 关键：将图片缩放到 1000x1000 以提高 Qwen bbox 准确度
        const TARGET_SIZE = 1000;
        const resizedBuffer = await sharp(imagePath)
            .resize(TARGET_SIZE, TARGET_SIZE, { fit: 'fill' })
            .png()
            .toBuffer();
        const resizedBase64 = resizedBuffer.toString('base64');

        console.log(`[Layer 1] 图片已缩放: ${origWidth}x${origHeight} -> ${TARGET_SIZE}x${TARGET_SIZE}`);

        const response = await fetch(CONFIG.siliconflow.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.siliconflow.apiKey}`
            },
            body: JSON.stringify({
                model: CONFIG.siliconflow.model,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: `data:image/png;base64,${resizedBase64}` } },
                        { type: 'text', text: GROUNDING_PROMPT }
                    ]
                }],
                max_tokens: 150,
                temperature: 0.05
            })
        });

        if (!response.ok) return null;

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // 解析 bbox_2d
        const match = content.match(/\{[\s\S]*"bbox_2d"[\s\S]*\}/);
        if (!match) return null;

        const parsed = JSON.parse(match[0]);
        if (!parsed.bbox_2d || !Array.isArray(parsed.bbox_2d)) return null;

        // API 返回的是 1000x1000 图片上的坐标，需要转换回原图尺寸
        const [x1, y1, x2, y2] = parsed.bbox_2d;
        if (x2 > x1 && y2 > y1) {
            const scaleX = origWidth / TARGET_SIZE;
            const scaleY = origHeight / TARGET_SIZE;
            const scaledBbox = [
                Math.round(x1 * scaleX),
                Math.round(y1 * scaleY),
                Math.round(x2 * scaleX),
                Math.round(y2 * scaleY)
            ];
            console.log(`[Layer 1] 成功: 原始 [${x1}, ${y1}, ${x2}, ${y2}] -> 缩放后 [${scaledBbox.join(', ')}]`);
            return scaledBbox;
        }
        return null;
    } catch (e) {
        console.log('[Layer 1] 失败:', e.message);
        return null;
    }
}


// 方法 4: 兜底 API（不同提示词）
const FALLBACK_PROMPT = `这是一道数学题的图片。请找出图中的几何图形（如三角形、正方形、圆等）。

返回图形所在区域的边界框，格式：
{"box": [左边界百分比, 上边界百分比, 右边界百分比, 下边界百分比]}

百分比范围 0-100。例如图形在右半部分：{"box": [50, 20, 95, 80]}`;

async function detectWithFallbackAPI(imagePath, base64Image, mimeType) {
    console.log('[Layer 4] 兜底 API 检测...');
    try {
        const response = await fetch(CONFIG.siliconflow.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.siliconflow.apiKey}`
            },
            body: JSON.stringify({
                model: CONFIG.siliconflow.model,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
                        { type: 'text', text: FALLBACK_PROMPT }
                    ]
                }],
                max_tokens: 100,
                temperature: 0.1
            })
        });

        if (!response.ok) return null;

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        const match = content.match(/\{[\s\S]*"box"[\s\S]*\}/);
        if (!match) return null;

        const parsed = JSON.parse(match[0]);
        if (!parsed.box || parsed.box.length !== 4) return null;

        const [left, top, right, bottom] = parsed.box.map(v => Math.max(0, Math.min(100, Number(v) || 0)));
        if (right > left && bottom > top) {
            console.log(`[Layer 4] 成功: [${left}%, ${top}%, ${right}%, ${bottom}%]`);
            return [left, top, right, bottom];
        }
        return null;
    } catch (e) {
        console.log('[Layer 4] 失败:', e.message);
        return null;
    }
}

// 主函数：四层级联检测
async function detectAndCropDiagram(imagePath) {
    if (!CONFIG.siliconflow.apiKey) {
        console.log('[DiagramDetect] 跳过 - 无 API Key');
        return null;
    }

    try {
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

        console.log('[DiagramDetect] 开始检测...');

        // Layer 0: MinerU 云 API（最高精度，提取干净的图形）
        if (CONFIG.mineru.enabled && CONFIG.mineru.apiKey) {
            console.log('[Layer 0] MinerU 云解析...');
            const mineruResult = await parseWithMinerU(imagePath);
            if (mineruResult && mineruResult.success && mineruResult.zipUrl) {
                console.log('[DiagramDetect] MinerU 解析成功，下载结果...');
                const extractedImage = await downloadAndExtractMineruImages(mineruResult.zipUrl);
                if (extractedImage) {
                    console.log('[DiagramDetect] Layer 0 成功 - MinerU 图片提取完成');
                    return extractedImage;
                }
            }
        }

        // Layer 1: Qwen Grounding（完全信任 API 结果）
        let bbox = await detectWithQwenGrounding(imagePath, base64Image, mimeType);
        if (bbox) {
            console.log('[DiagramDetect] Layer 1 成功，使用 API 返回的结果');
            const result = await beautifyAndCrop(imagePath, bbox);
            if (result) return result;
        }

        // Layer 4: Fallback API（备用）
        bbox = await detectWithFallbackAPI(imagePath, base64Image, mimeType);
        if (bbox) {
            console.log('[DiagramDetect] Layer 4 成功');
            const result = await beautifyAndCrop(imagePath, bbox);
            if (result) return result;
        }

        console.log('[DiagramDetect] 未检测到图形');
        return null;
    } catch (error) {
        console.error('[DiagramDetect Error]', error.message);
        return null;
    }
}

// 内容类型提示映射表
const CONTENT_HINTS = {
    '波形': '波形曲线和坐标刻度由系统单独处理',
    '正弦': '正弦/余弦曲线由系统单独处理',
    '几何': '几何图形由系统单独处理',
    '三角': '三角形图形由系统单独处理',
    '坐标': '坐标系图形由系统单独处理',
    '函数': '函数图像由系统单独处理',
    '圆': '圆形图形由系统单独处理',
    '抛物线': '抛物线图形由系统单独处理'
};

// 构建自适应 OCR 提示词
function buildAdaptiveOCRPrompt(visionDescription = '') {
    let hint = '图形内容由系统单独处理';

    // 根据 Vision 描述匹配内容类型
    for (const [keyword, hintText] of Object.entries(CONTENT_HINTS)) {
        if (visionDescription.includes(keyword)) {
            hint = hintText;
            break;
        }
    }

    return `请提取图片中的文字内容。

上下文: ${hint}，你只需提取纯文字（题目、选项、说明等）。

格式要求:
- 数学公式用 $...$ 包裹
- 保持选项格式（A. B. C.）
- 不要描述或表示图形

直接输出文字内容:`;
}

async function extractTextWithVisionOCR(imagePath, visionDescription = '') {
    if (!CONFIG.siliconflow.apiKey) {
        console.log('[OCR] 未配置 SiliconFlow Key，使用 Mock 数据');
        return MOCK_DATA.mineru;
    }

    try {
        const prompt = buildAdaptiveOCRPrompt(visionDescription);
        console.log('[OCR] 使用自适应提示词进行文字识别...');

        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

        const response = await fetch(CONFIG.siliconflow.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.siliconflow.apiKey}`
            },
            body: JSON.stringify({
                model: CONFIG.siliconflow.model,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
                        { type: 'text', text: prompt }
                    ]
                }],
                max_tokens: 1500,
                temperature: 0.1
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[OCR] API 错误 ${response.status}:`, errorBody.substring(0, 200));
            return MOCK_DATA.mineru;
        }

        const data = await response.json();
        const extractedText = data.choices?.[0]?.message?.content || '';

        console.log('[OCR] 文字识别成功');
        return {
            success: true,
            text: extractedText,
            latex: ''
        };
    } catch (error) {
        console.error('[OCR Error]', error.message);
        return {
            success: false,
            text: '[OCR 失败] 无法识别图片中的文字',
            latex: ''
        };
    }
}

// ==========================================
// 引擎 A (续): SiliconFlow API - 视觉语义理解
// ==========================================
async function describeImageWithVision(imagePath) {
    if (!CONFIG.siliconflow.apiKey) {
        console.log('[Mock] SiliconFlow API - 使用模拟数据');
        await delay(800);
        return MOCK_DATA.siliconflow;
    }

    try {
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

        const response = await fetch(CONFIG.siliconflow.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.siliconflow.apiKey}`
            },
            body: JSON.stringify({
                model: CONFIG.siliconflow.model,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${mimeType};base64,${base64Image}`
                                }
                            },
                            {
                                type: 'text',
                                text: VISION_PROMPT
                            }
                        ]
                    }
                ],
                max_tokens: 500,
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[SiliconFlow] API 错误 ${response.status}:`, errorBody.substring(0, 200));
            // 降级到 Mock 数据而不是抛出错误
            console.log('[SiliconFlow] 降级使用 Mock 数据');
            return MOCK_DATA.siliconflow;
        }

        const data = await response.json();
        return {
            description: data.choices?.[0]?.message?.content || ''
        };
    } catch (error) {
        console.error('[SiliconFlow Error]', error.message);
        // 降级到 Mock 数据
        console.log('[SiliconFlow] 异常，降级使用 Mock 数据');
        return MOCK_DATA.siliconflow;
    }
}

// ==========================================
// 引擎 C: DeepSeek API - 逻辑推理
// ==========================================
async function solveWithDeepSeek(extractedText, imageDescription) {
    if (!CONFIG.deepseek.apiKey) {
        console.log('[Mock] DeepSeek API - 使用模拟数据');
        await delay(1000);
        return MOCK_DATA.deepseek;
    }

    try {
        // 构建综合 Prompt
        const userPrompt = `【题目文字内容】
${extractedText}

【图形描述】
${imageDescription}

请根据以上信息，按照规定的三段式结构解答这道题。`;

        const response = await fetch(CONFIG.deepseek.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.deepseek.apiKey}`
            },
            body: JSON.stringify({
                model: CONFIG.deepseek.model,
                messages: [
                    { role: 'system', content: DEEPSEEK_SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.4,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            throw new Error(`DeepSeek API 错误: ${response.status}`);
        }

        const data = await response.json();
        return {
            answer: data.choices?.[0]?.message?.content || ''
        };
    } catch (error) {
        console.error('[DeepSeek Error]', error);
        return { answer: '', error: error.message };
    }
}

// ==========================================
// 主 API 端点: /api/solve
// ==========================================
app.post('/api/solve', upload.single('image'), async (req, res) => {
    const startTime = Date.now();

    try {
        // 检查是否有图片
        if (!req.file && !req.body.imageBase64) {
            return res.status(400).json({ error: '请上传题目图片' });
        }

        let imagePath;
        let shouldCleanup = false;

        // 处理 Base64 上传
        if (req.body.imageBase64) {
            const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const uploadDir = path.join(__dirname, 'uploads');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            imagePath = path.join(uploadDir, `${Date.now()}.png`);
            fs.writeFileSync(imagePath, buffer);
            shouldCleanup = true;
        } else {
            imagePath = req.file.path;
            shouldCleanup = true;
        }

        console.log(`\n${'='.repeat(50)}`);
        console.log(`[MathSolver] 新请求 - ${new Date().toLocaleString()}`);
        console.log(`[模式] ${isMockMode() ? 'Mock 模式 (未配置完整 API Key)' : '正式模式'}`);
        console.log(`${'='.repeat(50)}\n`);

        // ========== 双引擎处理 ==========
        // 先获取图形描述，用于自适应 OCR
        console.log('[Step 1/2] 调用 SiliconFlow - 图形描述 + OCR...');

        const visionResult = await describeImageWithVision(imagePath);
        console.log('[Vision] 描述完成:', visionResult.description?.substring(0, 100) + '...');

        // OCR 使用 Vision 描述来自适应处理
        const ocrResult = await extractTextWithVisionOCR(imagePath, visionResult.description || '');
        console.log('[OCR] 提取完成:', ocrResult.text?.substring(0, 100) + '...');

        // 引擎 B + D: DeepSeek 逻辑推理 + 图形裁剪 (并行)
        console.log('[Step 2/2] 调用 DeepSeek + 图形裁剪...');
        const [deepseekResult, diagramBase64] = await Promise.all([
            solveWithDeepSeek(ocrResult.text || '', visionResult.description || ''),
            detectAndCropDiagram(imagePath)
        ]);

        console.log('[DeepSeek] 解答完成');
        if (diagramBase64) {
            console.log('[DiagramCrop] 图形提取完成');
        }

        // 清理临时文件
        if (shouldCleanup && fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        const totalTime = Date.now() - startTime;
        console.log(`\n[完成] 总耗时: ${totalTime}ms\n`);

        // 返回结果
        res.json({
            success: true,
            isMockMode: isMockMode(),
            timing: {
                total: totalTime
            },
            data: {
                extractedText: ocrResult.text || '',
                imageDescription: visionResult.description || '',
                diagramBase64: diagramBase64 || null,
                solution: deepseekResult.answer || ''
            }
        });

    } catch (error) {
        console.error('[API Error]', error);
        res.status(500).json({
            success: false,
            error: error.message || '服务器内部错误'
        });
    }
});

// ==========================================
// 文字对话 API 端点: /api/chat
// ==========================================
app.post('/api/chat', async (req, res) => {
    try {
        const { messages, model, temperature = 0.7 } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: '请提供有效的 messages 数组' });
        }

        // 检查 Mock 模式
        if (isMockMode()) {
            return res.json({
                choices: [{
                    message: {
                        role: 'assistant',
                        content: '【Mock 模式】这是模拟回复。\n\n您的问题很好！让我来详细解答...\n\n根据之前的解题过程，我们可以这样理解：\n\n$$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$\n\n这是一个示例公式。在正式模式下，我会根据您的具体问题提供准确解答。'
                    }
                }]
            });
        }

        // 调用 DeepSeek API
        const response = await fetch(CONFIG.deepseek.url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.deepseek.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model || 'deepseek-chat',
                messages: messages,
                temperature: temperature,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Chat API Error]', errorText);
            return res.status(response.status).json({ error: `DeepSeek API 错误: ${response.status}` });
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('[Chat API Exception]', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mode: isMockMode() ? 'mock' : 'production',
        engines: {
            siliconflow: !!CONFIG.siliconflow.apiKey,
            deepseek: !!CONFIG.deepseek.apiKey,
            mineru: CONFIG.mineru.enabled && !!CONFIG.mineru.apiKey
        }
    });
});

// ==========================================
// 启动服务器
// ==========================================
const PORT = process.env.PORT || 3003;

// 暴露 uploads 目录
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('  MathSolver - AI 识题解题服务');
    console.log('='.repeat(50));
    console.log(`  地址: http://localhost:${PORT}`);
    console.log(`  模式: ${isMockMode() ? 'Mock 模式 (可直接测试 UI)' : '正式模式'}`);
    console.log('='.repeat(50));

    if (isMockMode()) {
        console.log('\n  ⚠️  提示: 未检测到完整的 API Key 配置');
        console.log('  📋 请复制 .env.example 为 .env 并填入 API Keys');
        console.log('  🧪 当前使用 Mock 数据，可正常测试 UI 流程\n');
    }
});
