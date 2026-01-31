const fetch = require('node-fetch');
const { CONFIG, MOCK_DATA } = require('./config');

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

async function solveWithDeepSeek(extractedText, imageDescription) {
    if (!CONFIG.deepseek.apiKey) {
        return MOCK_DATA.deepseek;
    }

    try {
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

module.exports = { solveWithDeepSeek };
