/**
 * MathSolver
 * Copyright (c) 2026 ICeCreamChat
 * Licensed under the MIT License.
 *
 * Double Engine API Gateway
 * Refactored to Vercel Best Practices (Composition Pattern)
 */
require('dotenv').config();

const express = require('express');
const path = require('path');
const compression = require('compression');
const multer = require('multer');
const fs = require('fs');
const fetch = require('node-fetch');

// Services
const { CONFIG, isMockMode } = require('./services/config');
const { describeImageWithVision, extractTextWithVisionOCR } = require('./services/siliconflow');
const { solveWithDeepSeek } = require('./services/deepseek');
const { detectAndCropDiagram } = require('./services/diagram_detector');

const app = express();
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File Upload Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的图片格式'));
        }
    }
});

/**
 * Main Solver Endpoint
 */
app.post('/api/solve', upload.single('image'), async (req, res) => {
    const startTime = Date.now();
    let imagePath = null;
    let shouldCleanup = false;

    try {
        // Handle Input
        if (req.body.imageBase64) {
            const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const uploadDir = path.join(__dirname, 'uploads');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            imagePath = path.join(uploadDir, `${Date.now()}.png`);
            fs.writeFileSync(imagePath, buffer);
            shouldCleanup = true;
        } else if (req.file) {
            imagePath = req.file.path;
            shouldCleanup = true;
        } else {
            return res.status(400).json({ error: '请上传题目图片' });
        }

        console.log(`\n=== MathSolver Request [${new Date().toLocaleString()}] ===`);
        console.log(`Mode: ${isMockMode() ? 'MOCK' : 'PROD'}`);

        // Step 1: Vision Description & OCR
        console.log('-> Vision & OCR');
        const visionResult = await describeImageWithVision(imagePath);
        const ocrResult = await extractTextWithVisionOCR(imagePath, visionResult.description || '');

        // Step 2: DeepSeek & Diagram
        console.log('-> DeepSeek & Diagram');
        const [deepseekResult, diagramBase64] = await Promise.all([
            solveWithDeepSeek(ocrResult.text || '', visionResult.description || ''),
            detectAndCropDiagram(imagePath)
        ]);

        // Cleanup
        if (shouldCleanup && fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        const totalTime = Date.now() - startTime;
        console.log(`=== DONE (${totalTime}ms) ===\n`);

        res.json({
            success: true,
            isMockMode: isMockMode(),
            timing: { total: totalTime },
            data: {
                extractedText: ocrResult.text || '',
                imageDescription: visionResult.description || '',
                diagramBase64: diagramBase64 || null,
                solution: deepseekResult.answer || ''
            }
        });

    } catch (error) {
        console.error('[API Error]', error);
        res.status(500).json({ success: false, error: error.message || 'Server Error' });
    }
});

/**
 * Chat Endpoint
 */
app.post('/api/chat', async (req, res) => {
    try {
        const { messages, model, temperature = 0.7 } = req.body;

        if (isMockMode()) {
            return res.json({
                choices: [{
                    message: {
                        role: 'assistant',
                        content: '【Mock 模式】这是模拟回复 (API Key 未配置)。'
                    }
                }]
            });
        }

        // Direct fetch to DeepSeek as it's simple proxy, or could move to deepseek service
        // Moving to deepseek service is better for consistency, but `solveWithDeepSeek` is specialized.
        // Let's just do a direct fetch here to keep it simple or strictly use service?
        // Let's stay with direct fetch for chat to avoid over-engineering the service for generic chat.
        // Actually, let's keep it here.

        const response = await fetch(CONFIG.deepseek.url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.deepseek.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model || 'deepseek-chat',
                messages,
                temperature,
                stream: false
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`DeepSeek API Error: ${err}`);
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('[Chat Error]', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', mode: isMockMode() ? 'mock' : 'prod' });
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`MathSolver running on http://localhost:${PORT}`);
});
