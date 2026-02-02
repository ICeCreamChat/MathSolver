/**
 * MathSolver
 * Copyright (c) 2026 ICeCreamChat
 * Licensed under the MIT License.
 *
 * Entry Point - Initializes all modules and binds events.
 * Refactored: All logic moved to dedicated modules in js/ folder.
 */
import * as THREE from 'three';

// ==========================================
// 1. Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize StateManager first (loads from localStorage)
    if (window.StateManager) StateManager.init();

    // Initialize Theme
    if (window.ThemeManager) ThemeManager.init();

    // Initialize Effects
    if (window.CursorEffects) CursorEffects.init();

    // Initialize Chat System
    if (window.ChatSystem) ChatSystem.init();

    // Initialize Particle Engine
    if (window.ParticleEngine) {
        ParticleEngine.init();
        ParticleEngine.initPerformanceOptimization();
    }

    // Initialize Context Panel
    if (window.ContextPanel) ContextPanel.init();

    // Initialize UI Manager
    if (window.UiManager) UiManager.init();

    // Initialize Marked options
    if (window.marked) window.marked.setOptions({ breaks: true, gfm: true });

    // Bind all events
    bindEvents();

    // Initialize Icons
    if (window.lucide) window.lucide.createIcons();

    // Global Error Boundary
    window.onerror = function (msg, url, lineNo, columnNo, error) {
        console.error('Global Error:', msg, 'at', lineNo, ':', columnNo);
        if (window.showToast) window.showToast(`System Error: ${msg}`, 'error');
        return false;
    };

    // Unhandled Promise Rejection Handler
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled Promise Rejection:', event.reason);
        if (window.showToast) window.showToast(`Async Error: ${event.reason}`, 'error');
    });
});

// ==========================================
// 2. Toast & Modal (Robustness Tools)
// ==========================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-circle';

    toast.innerHTML = `<i data-lucide="${iconName}"></i><span>${message}</span>`;
    container.appendChild(toast);

    if (window.lucide) window.lucide.createIcons();

    const { TOAST_DURATION } = window.CONSTANTS || { TOAST_DURATION: 3000 };
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s forwards';
        toast.addEventListener('animationend', () => toast.remove());
    }, TOAST_DURATION);
}

function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const msgEl = document.getElementById('confirm-message');
        const btnCancel = document.getElementById('btn-confirm-cancel');
        const btnOk = document.getElementById('btn-confirm-ok');

        if (!modal) {
            resolve(confirm(`${title}: ${message}`));
            return;
        }

        titleEl.textContent = title;
        msgEl.textContent = message;
        modal.classList.add('active');

        const cleanup = () => {
            modal.classList.remove('active');
            btnCancel.removeEventListener('click', onCancel);
            btnOk.removeEventListener('click', onOk);
        };

        const onCancel = () => { cleanup(); resolve(false); };
        const onOk = () => { cleanup(); resolve(true); };

        btnCancel.addEventListener('click', onCancel);
        btnOk.addEventListener('click', onOk);
    });
}

window.showToast = showToast;
window.showConfirm = showConfirm;

// ==========================================
// 3. Image Lightbox
// ==========================================
function openImageLightbox(imageUrl) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.9); display: flex; align-items: center;
        justify-content: center; z-index: 10000; cursor: zoom-out;
    `;

    const img = document.createElement('img');
    img.src = imageUrl;
    img.style.cssText = `
        max-width: 90%; max-height: 90%; border-radius: 8px;
        box-shadow: 0 10px 50px rgba(0,0,0,0.5);
    `;

    overlay.appendChild(img);
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
}

window.openImageLightbox = openImageLightbox;

// ==========================================
// 4. Message Display
// ==========================================
function displayMessage(role, text, imageUrl = null, shouldSave = false, contextData = null) {
    if (shouldSave && window.ChatSystem) {
        ChatSystem.saveMessageToCurrentSession(role, text, imageUrl, contextData);
    }

    const container = document.getElementById('messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    if (role === 'bot' && contextData) {
        msgDiv.dataset.contextData = JSON.stringify(contextData);
        if (!StateManager.get('isManualContextSwitch') && window.UiManager) {
            UiManager.updateContextPanel(contextData.image, contextData.text);
        }
    }

    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.src = role === 'user' ? 'user-avatar.jpg' : 'bot-avatar.jpg';
    avatar.alt = role;

    avatar.onerror = function () {
        const iconDiv = document.createElement('div');
        iconDiv.className = 'avatar icon-avatar';
        iconDiv.innerHTML = role === 'user'
            ? '<i data-lucide="user"></i>'
            : '<i data-lucide="bot"></i>';
        this.replaceWith(iconDiv);
        if (window.lucide) window.lucide.createIcons();
    };

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (imageUrl) {
        const img = document.createElement('img');
        img.className = 'uploaded-image';
        img.src = imageUrl;
        img.alt = 'Uploaded Image';
        img.onclick = () => openImageLightbox(imageUrl);
        contentDiv.appendChild(img);
    }

    if (text) {
        const textDiv = document.createElement('div');
        if (window.MathRenderer) {
            MathRenderer.renderMarkdown(text, textDiv);
        } else {
            textDiv.textContent = text;
        }
        contentDiv.appendChild(textDiv);
    }

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(contentDiv);

    if (window.lucide) window.lucide.createIcons();

    if (role === 'bot' && contextData && window.ContextPanel) {
        ContextPanel.observeMessageIntersection(msgDiv, contextData);
    }

    container.appendChild(msgDiv);

    requestAnimationFrame(() => {
        msgDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
}

window.displayMessage = displayMessage;

// ==========================================
// 5. API Calls
// ==========================================
async function startSolving() {
    const croppedImageData = StateManager.get('croppedImageData');
    if (!croppedImageData) return;

    const loading = document.getElementById('loading');
    loading.style.display = 'block';

    try {
        let result;

        if (window.ApiClient) {
            const formData = new FormData();
            const response = await fetch(croppedImageData);
            const blob = await response.blob();
            formData.append('image', blob, 'capture.jpg');
            result = await ApiClient.analyze(formData);
        } else {
            throw new Error("ApiClient module not loaded");
        }

        loading.style.display = 'none';

        let aiContent = '';
        if (result.data.extractedText) {
            aiContent += `## 📋 题目内容\n\n${result.data.extractedText}\n\n`;
        }
        if (result.data.diagramBase64) {
            aiContent += `![几何图形](${result.data.diagramBase64})\n\n`;
        }
        aiContent += `---\n\n`;
        if (result.data.solution) {
            aiContent += `## 💡 解答过程\n\n${result.data.solution}`;
        }

        let panelImage = result.data.diagramBase64 || null;
        let panelText = result.data.extractedText || "（暂无文字识别结果）";

        const isOCRFailed = panelText.includes('OCR 失败') || panelText.includes('无法识别') || panelText.trim().length < 5;
        if (isOCRFailed && !panelImage) {
            console.warn("OCR 似乎失败，启用原图兜底模式");
            panelImage = croppedImageData;
            if (panelText.includes('OCR 失败')) {
                panelText += "\n\n> ⚠️ **自动回退模式**：由于文字识别遇到网络问题，已为您显示原始截图。";
            }
        }

        const contextData = {
            image: panelImage,
            text: panelText,
            extractedText: result.data.extractedText || "",
            imageDescription: result.data.imageDescription || "",
            solution: result.data.solution || ""
        };

        displayMessage('bot', aiContent, null, true, contextData);
        if (window.TTSHandler) TTSHandler.speak(aiContent);

    } catch (error) {
        loading.style.display = 'none';
        displayMessage('bot', `❌ **解题失败**: ${error.message}\n\n请检查网络连接后重试。`, null, true);
        showToast('解题失败，请查看消息', 'error');
    } finally {
        StateManager.set('croppedImageData', null);
    }
}

window.startSolving = startSolving;

// ==========================================
// 6. Text Message Sending
// ==========================================
async function sendTextMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    displayMessage('user', message, null, true);
    input.value = '';

    const currentSession = StateManager.getCurrentSession();
    const historyMessages = currentSession ? currentSession.messages : [];
    const { MAX_HISTORY_MESSAGES } = window.CONSTANTS || { MAX_HISTORY_MESSAGES: 50 };

    // Context Anchoring
    let anchoredContext = null;
    let anchoredPrompt = "";

    for (let i = historyMessages.length - 1; i >= 0; i--) {
        if (historyMessages[i].role === 'bot' && historyMessages[i].contextData) {
            anchoredContext = historyMessages[i].contextData;
            break;
        }
    }

    if (anchoredContext) {
        anchoredPrompt = `
【当前题目上下文 (Anchored Context)】
题目文字: ${anchoredContext.extractedText || anchoredContext.text}
视觉描述: ${anchoredContext.imageDescription || "无"}
初始解答: (已提供，仅供参考)
`;
    }

    const apiMessages = [{
        role: "system",
        content: `你是一个专业的数学辅导助手。用户可能会：
1. 请求你修正之前的解答
2. 询问解题步骤的细节
3. 要求换一种方法解题
4. 询问相关知识点

${anchoredPrompt}

请用清晰、详细的方式回答。所有数学公式请使用 LaTeX 格式：
- 独立公式用 $$...$$ 包裹
- 行内公式用 $...$ 包裹`
    }];

    const recentMessages = historyMessages.slice(-MAX_HISTORY_MESSAGES);
    recentMessages.forEach(msg => {
        if (msg.text) {
            let safeContent = msg.text.replace(/!\[.*?\]\(data:image\/.*?\)/g, '[图片]');
            safeContent = safeContent.replace(/[a-zA-Z0-9+/=]{500,}/g, '[Large Data Removed]');
            apiMessages.push({
                role: msg.role === 'bot' ? 'assistant' : 'user',
                content: safeContent
            });
        }
    });

    const loading = document.getElementById('loading');
    loading.style.display = 'block';

    try {
        if (!window.ApiClient) throw new Error("ApiClient module not loaded");

        const result = await ApiClient.chat(apiMessages);
        loading.style.display = 'none';

        if (result.error) {
            displayMessage('bot', `❌ **错误**: ${result.error}`, null, true);
            return;
        }

        if (result.choices && result.choices.length > 0) {
            const reply = result.choices[0].message.content;
            displayMessage('bot', reply, null, true);
            if (window.TTSHandler) TTSHandler.speak(reply);
        } else {
            displayMessage('bot', '❌ **API 错误**: 未能获取回复', null, true);
        }

    } catch (error) {
        loading.style.display = 'none';
        displayMessage('bot', `❌ **请求失败**: ${error.message}\n\n请检查网络连接后重试。`, null, true);
    }
}

// ==========================================
// 7. Event Binding
// ==========================================
function toggleDropdown(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('dropdownMenu');
    if (dropdown) dropdown.classList.toggle('show');
}

window.onclick = function (e) {
    if (!e.target.closest('.dropdown')) {
        const dropdown = document.getElementById('dropdownMenu');
        if (dropdown) dropdown.classList.remove('show');
    }
};

function bindEvents() {
    // Upload buttons
    const uploadBtn = document.getElementById('upload-btn');
    const cameraBtn = document.getElementById('camera-btn');
    const fileInput = document.getElementById('file-input');
    const cameraInput = document.getElementById('camera-input');

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => CropperHandler.handleFileSelect(e));
    }

    if (cameraBtn && cameraInput) {
        cameraBtn.addEventListener('click', () => cameraInput.click());
        cameraInput.addEventListener('change', (e) => CropperHandler.handleFileSelect(e));
    }

    // Text message
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');

    if (sendBtn) sendBtn.addEventListener('click', sendTextMessage);
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendTextMessage();
            }
        });
    }

    // Cropper buttons
    const cropConfirm = document.getElementById('btn-crop-confirm');
    const cropCancel = document.getElementById('btn-crop-cancel');
    const cropReset = document.getElementById('btn-crop-reset');

    if (cropConfirm) cropConfirm.addEventListener('click', () => CropperHandler.confirmCrop());
    if (cropCancel) cropCancel.addEventListener('click', () => CropperHandler.closeCropModal());
    if (cropReset) cropReset.addEventListener('click', () => CropperHandler.resetCrop());

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    const btnTheme = document.getElementById('btn-theme');
    if (themeToggle) themeToggle.addEventListener('click', () => ThemeManager.toggleTheme());
    if (btnTheme) btnTheme.addEventListener('click', () => ThemeManager.toggleTheme());

    // TTS
    const btnTts = document.getElementById('btn-tts');
    if (btnTts) btnTts.addEventListener('click', () => TTSHandler.toggle());

    // Clear history
    const btnClear = document.getElementById('btn-clear');
    if (btnClear) btnClear.addEventListener('click', () => ChatSystem.clearAllHistory());

    // New chat
    const newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) newChatBtn.addEventListener('click', () => ChatSystem.startNewChat());

    // More menu
    const moreBtn = document.getElementById('more-btn');
    if (moreBtn) moreBtn.addEventListener('click', toggleDropdown);

    // Mobile sidebar
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (mobileMenuBtn && sidebar && sidebarOverlay) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.add('open');
            sidebarOverlay.classList.add('active');
        });
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });
    }
}
