import * as THREE from 'three';

// ==========================================
// 1. 配置
// ==========================================
const API_CONFIG = {
    mathSolver: {
        url: '/api/solve'
    },
    chat: {
        url: '/api/chat'
    }
};

// 状态
let isTTSEnabled = false;
let isManualTheme = false;

// Cropper 状态
let cropper = null;
let croppedImageData = null;
let originalImageFile = null;

// 3D 场景变量
let scene, camera, renderer, particles;
let clock = new THREE.Clock();
let animationFrameId = null;
let isPageVisible = true;

// 记忆系统 (Local Storage)
let chatSessions = JSON.parse(localStorage.getItem('mathSolverSessions')) || [];
let currentSessionId = localStorage.getItem('mathSolverCurrentSession') || null;

// ==========================================
// 2. 初始化
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    bindEvents();

    // 初始化时间检查与主题
    checkBeijingTime();
    setInterval(checkBeijingTime, 60000);

    // 强制同步手机状态栏颜色
    updateMobileStatusBar();

    initChatSystem();
    initCustomCursor();

    initMathParticleScene();
    initPerformanceOptimization();

    if (window.marked) window.marked.setOptions({ breaks: true, gfm: true });
});

// ==========================================
// 3. 点击爆破特效
// ==========================================
function initCustomCursor() {
    document.addEventListener('mousedown', (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
            createExplosion(e.clientX, e.clientY);
        }
    });
}

function createExplosion(x, y) {
    const symbols = ['∑', '∫', 'π', '∞', '√', '≈', '≠', '±', '∂', '∇', 'x', 'y'];
    const particleCount = 12;
    const themeColor = getComputedStyle(document.body).color;

    for (let i = 0; i < particleCount; i++) {
        const el = document.createElement('div');
        el.classList.add('math-particle-dom');
        el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        el.style.color = themeColor;
        document.body.appendChild(el);

        el.style.left = `${x}px`;
        el.style.top = `${y}px`;

        const angle = Math.random() * Math.PI * 2;
        const velocity = 60 + Math.random() * 60;
        const tx = Math.cos(angle) * velocity + 'px';
        const ty = Math.sin(angle) * velocity + 'px';
        const rot = (Math.random() - 0.5) * 360 + 'deg';

        el.style.setProperty('--tx', tx);
        el.style.setProperty('--ty', ty);
        el.style.setProperty('--rot', rot);

        setTimeout(() => el.remove(), 1000);
    }
}

// ==========================================
// 4. 主题控制
// ==========================================
function checkBeijingTime() {
    if (isManualTheme) return;
    const date = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
    const hour = date.getHours();

    const wasLight = document.body.classList.contains('light-mode');

    if (hour >= 6 && hour < 19) document.body.classList.add('light-mode');
    else document.body.classList.remove('light-mode');

    const isLight = document.body.classList.contains('light-mode');
    if (wasLight !== isLight || !window.hasInitializedTheme) {
        updateMobileStatusBar();
        window.hasInitializedTheme = true;
    }
}

function toggleTheme() {
    isManualTheme = true;
    document.body.classList.toggle('light-mode');
    const dropdown = document.getElementById('dropdownMenu');
    if (dropdown) dropdown.classList.remove('show');
    updateMobileStatusBar();
}

function updateMobileStatusBar() {
    const isLight = document.body.classList.contains('light-mode');
    const themeColor = isLight ? '#f0f4f8' : '#050b14';

    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.name = "theme-color";
        document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = themeColor;

    let metaStatusStyle = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (metaStatusStyle) {
        metaStatusStyle.content = isLight ? "default" : "black-translucent";
    }
}

// ==========================================
// 5. 数学符号粒子引擎
// ==========================================
function initPerformanceOptimization() {
    document.addEventListener('visibilitychange', () => {
        isPageVisible = !document.hidden;
        if (isPageVisible) {
            clock.start();
            animate();
        } else {
            clock.stop();
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        }
    });
}

function initMathParticleScene() {
    const container = document.getElementById('math-canvas-container');
    if (!container) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = 50;

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const symbols = ['∑', '∫', 'π', 'e', '0', '1', 'sin', 'cos', '∞', '√', 'tan', 'log'];
    const materials = [];

    symbols.forEach(sym => {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 60px "JetBrains Mono", monospace';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sym, 64, 64);
        const tex = new THREE.CanvasTexture(canvas);
        materials.push(new THREE.SpriteMaterial({
            map: tex, transparent: true, opacity: 0.5, color: 0xffffff
        }));
    });

    particles = new THREE.Group();
    const particleCount = window.innerWidth < 768 ? 1500 : 3000;

    for (let i = 0; i < particleCount; i++) {
        const mat = materials[Math.floor(Math.random() * materials.length)].clone();
        const sprite = new THREE.Sprite(mat);

        sprite.position.x = (Math.random() - 0.5) * 400;
        sprite.position.y = (Math.random() - 0.5) * 300;
        sprite.position.z = (Math.random() - 0.5) * 200;

        const scale = 0.5 + Math.random() * 2.0;
        sprite.scale.set(scale, scale, 1);

        sprite.userData = {
            speed: 0.05 + Math.random() * 0.1,
            type: Math.floor(Math.random() * 3),
            offset: Math.random() * 100,
            amp: 0.5 + Math.random() * 2
        };

        sprite.material.opacity = 0.1 + Math.random() * 0.4;
        particles.add(sprite);
    }
    scene.add(particles);

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }, 100);
    });

    animate();
}

function animate() {
    if (!isPageVisible) return;

    animationFrameId = requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    particles.children.forEach(sprite => {
        const d = sprite.userData;

        sprite.position.y -= d.speed;

        if (d.type === 0) {
            sprite.position.x += Math.sin(time * 0.5 + d.offset) * 0.02 * d.amp;
        } else if (d.type === 1) {
            sprite.position.x += Math.cos(time * 0.4 + d.offset) * 0.02 * d.amp;
        } else {
            sprite.position.x += Math.sin(time * 0.3) * 0.01 + Math.cos(time * 0.6) * 0.01;
        }

        sprite.material.rotation += 0.005;

        if (sprite.position.y < -150) {
            sprite.position.y = 150;
            sprite.position.x = (Math.random() - 0.5) * 400;
        }

        const isLight = document.body.classList.contains('light-mode');
        const targetColor = isLight ? new THREE.Color(0x64748b) : new THREE.Color(0xccf0ff);
        sprite.material.color.lerp(targetColor, 0.1);
        sprite.material.opacity = isLight ? 0.2 : 0.3;
    });

    renderer.render(scene, camera);
}

// ==========================================
// 6. 聊天系统
// ==========================================
function initChatSystem() {
    renderHistoryList();
    if (currentSessionId && chatSessions.find(s => s.id === currentSessionId)) {
        loadSession(currentSessionId);
    } else {
        startNewChat();
    }
}

function startNewChat() {
    if (chatSessions.length > 0) {
        const lastSession = chatSessions[0];
        if (lastSession.messages.length === 1 && lastSession.messages[0].role === 'bot') {
            currentSessionId = lastSession.id;
            localStorage.setItem('mathSolverCurrentSession', currentSessionId);
            renderHistoryList();
            loadSession(currentSessionId);
            closeSidebarMobile();
            return;
        }
    }

    currentSessionId = Date.now().toString();
    const newSession = {
        id: currentSessionId,
        title: "新对话 " + new Date().toLocaleTimeString(),
        messages: [{ role: 'bot', text: "👋 你好！我是 **MathSolver**，你的 AI 数学解题助手。\n\n📸 请点击下方按钮上传数学题图片，我会帮你识别题目并给出详细解答。" }]
    };
    chatSessions.unshift(newSession);
    saveData();
    renderHistoryList();
    loadSession(currentSessionId);
}

function loadSession(id) {
    currentSessionId = id;
    localStorage.setItem('mathSolverCurrentSession', id);
    const session = chatSessions.find(s => s.id === id);
    if (!session) return;

    const container = document.getElementById('messages');
    container.innerHTML = '';
    session.messages.forEach(msg => displayMessage(msg.role, msg.text, msg.imageUrl, false));
    updateSidebarActiveState();
    closeSidebarMobile();
}

function closeSidebarMobile() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (window.innerWidth <= 768 && sidebar && overlay) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }
}

function saveMessageToCurrentSession(role, text, imageUrl = null) {
    const session = chatSessions.find(s => s.id === currentSessionId);
    if (session) {
        session.messages.push({ role, text, imageUrl });
        if (session.messages.length === 2 && role === 'user') {
            session.title = "数学题 " + new Date().toLocaleTimeString();
            renderHistoryList();
        }
        saveData();
    }
}

function saveData() { localStorage.setItem('mathSolverSessions', JSON.stringify(chatSessions)); }

function renderHistoryList() {
    const list = document.getElementById('history-list');
    if (!list) return;
    list.innerHTML = '';
    chatSessions.forEach(session => {
        const item = document.createElement('div');
        item.className = `history-item ${session.id === currentSessionId ? 'active' : ''}`;
        item.onclick = () => loadSession(session.id);
        item.innerHTML = `<span>${session.title}</span><span class="delete-chat" onclick="window.deleteSessionProxy(event, '${session.id}')">×</span>`;
        list.appendChild(item);
    });
}

function deleteSession(e, id) {
    e.stopPropagation();
    if (confirm('确认删除此对话？')) {
        chatSessions = chatSessions.filter(s => s.id !== id);
        saveData();
        renderHistoryList();
        if (chatSessions.length === 0) {
            startNewChat();
        } else if (currentSessionId === id) {
            loadSession(chatSessions[0].id);
        }
    }
}
window.deleteSessionProxy = deleteSession;

function updateSidebarActiveState() {
    document.querySelectorAll('.history-item').forEach(item => item.classList.remove('active'));
    renderHistoryList();
}

function clearAllHistory() {
    if (confirm('确认清空所有对话历史？')) {
        localStorage.removeItem('mathSolverSessions');
        localStorage.removeItem('mathSolverCurrentSession');
        chatSessions = [];
        startNewChat();
        const dropdown = document.getElementById('dropdownMenu');
        if (dropdown) dropdown.classList.remove('show');
    }
}

// ==========================================
// 6.5 图片放大 Lightbox
// ==========================================
function openImageLightbox(imageUrl) {
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.9); display: flex; align-items: center;
        justify-content: center; z-index: 10000; cursor: zoom-out;
    `;

    // 创建图片
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

// ==========================================
// 7. 消息显示
// ==========================================
function displayMessage(role, text, imageUrl = null, shouldSave = false) {
    if (shouldSave) saveMessageToCurrentSession(role, text, imageUrl);

    const container = document.getElementById('messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.src = role === 'user' ? 'user-avatar.jpg' : 'bot-avatar.jpg';
    avatar.onerror = function () {
        this.src = role === 'user'
            ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%2310b981' width='100' height='100'/%3E%3Ctext x='50' y='60' text-anchor='middle' fill='white' font-size='40'%3E👤%3C/text%3E%3C/svg%3E"
            : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%230061ff' width='100' height='100'/%3E%3Ctext x='50' y='60' text-anchor='middle' fill='white' font-size='40'%3E📐%3C/text%3E%3C/svg%3E";
    };

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // 如果有图片，先显示图片（可点击放大）
    if (imageUrl) {
        const img = document.createElement('img');
        img.className = 'uploaded-image';
        img.src = imageUrl;
        img.alt = '上传的题目';
        img.style.cursor = 'zoom-in';
        img.onclick = () => openImageLightbox(imageUrl);
        contentDiv.appendChild(img);
    }

    // 处理文本内容
    if (text) {
        const textDiv = document.createElement('div');

        // 保护数学公式
        const mathMap = new Map();
        const generateId = () => "MATHBLOCK" + Math.random().toString(36).substr(2, 9) + "END";
        let protectedText = text
            .replace(/\$\$([\s\S]*?)\$\$/g, (match, code) => { const id = generateId(); mathMap.set(id, `$$${code}$$`); return "\n\n" + id + "\n\n"; })
            .replace(/\\\[([\s\S]*?)\\\]/g, (match, code) => { const id = generateId(); mathMap.set(id, `$$${code}$$`); return "\n\n" + id + "\n\n"; })
            .replace(/([^\\]|^)\$([^\$]*?)\$/g, (match, prefix, code) => { const id = generateId(); mathMap.set(id, `$${code}$`); return prefix + id; })
            .replace(/\\\(([\s\S]*?)\\\)/g, (match, code) => { const id = generateId(); mathMap.set(id, `$${code}$`); return id; });

        if (window.marked) textDiv.innerHTML = window.marked.parse(protectedText);
        else textDiv.textContent = text;

        let finalHtml = textDiv.innerHTML;
        // 使用正则替换，处理可能被 HTML 编码的占位符
        mathMap.forEach((latex, id) => {
            // 同时匹配原始 ID 和可能被转义的版本
            const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            finalHtml = finalHtml.replace(new RegExp(escapedId, 'g'), latex);
        });
        textDiv.innerHTML = finalHtml;

        contentDiv.appendChild(textDiv);
    }

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(contentDiv);

    // 渲染 KaTeX
    if (window.renderMathInElement) {
        setTimeout(() => {
            try {
                window.renderMathInElement(contentDiv, {
                    delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
                    throwOnError: false
                });
            } catch (e) { }
        }, 0);
    }

    container.appendChild(msgDiv);
    requestAnimationFrame(() => { msgDiv.scrollIntoView({ behavior: 'smooth', block: 'end' }); });
}

// ==========================================
// 8. TTS 朗读
// ==========================================
function toggleTTS() {
    isTTSEnabled = !isTTSEnabled;
    const label = document.getElementById('tts-label');
    if (label) label.textContent = isTTSEnabled ? "🔊 朗读: 开" : "🔇 朗读: 关";
    if (!isTTSEnabled) stopSpeaking();
    const dropdown = document.getElementById('dropdownMenu');
    if (dropdown) dropdown.classList.remove('show');
}

function speakText(text) {
    if (!isTTSEnabled || !('speechSynthesis' in window)) return;
    const cleanText = text.replace(/[\$\*\#\`]/g, '').replace(/\[.*?\]/g, '').replace(/\n/g, '，');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();
    const bestVoice = voices.find(v => v.lang.includes('zh') && (v.name.includes('Microsoft') || v.name.includes('Google'))) || voices.find(v => v.lang.includes('zh'));
    if (bestVoice) { utterance.voice = bestVoice; utterance.rate = 1.1; }
    window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

// ==========================================
// 9. 图片上传与裁剪
// ==========================================
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        originalImageFile = file;
        openCropModal(file);
    }
    e.target.value = '';
}

function openCropModal(file) {
    const cropModal = document.getElementById('crop-modal');
    const cropImage = document.getElementById('crop-image');

    const reader = new FileReader();
    reader.onload = (e) => {
        cropImage.src = e.target.result;
        cropModal.classList.add('active');

        if (cropper) {
            cropper.destroy();
        }

        cropper = new Cropper(cropImage, {
            aspectRatio: NaN,
            viewMode: 1,
            autoCropArea: 1,
            responsive: true,
            background: false
        });
    };
    reader.readAsDataURL(file);
}

function closeCropModal() {
    const cropModal = document.getElementById('crop-modal');
    cropModal.classList.remove('active');
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
}

function resetCrop() {
    if (cropper) {
        cropper.reset();
    }
}

function confirmCrop() {
    if (!cropper) return;

    const canvas = cropper.getCroppedCanvas({
        maxWidth: 2048,
        maxHeight: 2048
    });

    croppedImageData = canvas.toDataURL('image/jpeg', 0.9);
    closeCropModal();

    // 显示用户消息（带图片）
    displayMessage('user', null, croppedImageData, true);

    // 开始解题
    startSolving();
}

// ==========================================
// 10. API 调用
// ==========================================
async function startSolving() {
    if (!croppedImageData) return;

    const loading = document.getElementById('loading');
    loading.style.display = 'block';

    try {
        const response = await fetch(API_CONFIG.mathSolver.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imageBase64: croppedImageData
            })
        });

        if (!response.ok) {
            throw new Error(`服务器错误: ${response.status}`);
        }

        const result = await response.json();

        loading.style.display = 'none';

        // 构建 AI 回复
        let aiContent = '';

        if (result.data.extractedText) {
            aiContent += `## 📋 题目内容\n\n${result.data.extractedText}\n\n`;
        }

        // 图形放在题目内容下面
        if (result.data.diagramBase64) {
            aiContent += `![几何图形](${result.data.diagramBase64})\n\n`;
        }

        aiContent += `---\n\n`;

        if (result.data.solution) {
            aiContent += `## 💡 解答过程\n\n${result.data.solution}`;
        }

        // 不再传递图片参数，因为已嵌入内容中
        displayMessage('bot', aiContent, null, true);
        speakText(aiContent);

    } catch (error) {
        loading.style.display = 'none';
        displayMessage('bot', `❌ **解题失败**: ${error.message}\n\n请检查网络连接后重试。`, null, true);
    } finally {
        croppedImageData = null;
    }
}

// ==========================================
// 11. 事件绑定
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
}

function bindEvents() {
    // 上传按钮
    const uploadBtn = document.getElementById('upload-btn');
    const cameraBtn = document.getElementById('camera-btn');
    const fileInput = document.getElementById('file-input');
    const cameraInput = document.getElementById('camera-input');

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileSelect);
    }

    if (cameraBtn && cameraInput) {
        cameraBtn.addEventListener('click', () => cameraInput.click());
        cameraInput.addEventListener('change', handleFileSelect);
    }

    // 发送文字消息
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');

    if (sendBtn) {
        sendBtn.addEventListener('click', sendTextMessage);
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendTextMessage();
            }
        });
    }

    // 裁剪按钮
    const cropConfirm = document.getElementById('btn-crop-confirm');
    const cropCancel = document.getElementById('btn-crop-cancel');
    const cropReset = document.getElementById('btn-crop-reset');

    if (cropConfirm) cropConfirm.addEventListener('click', confirmCrop);
    if (cropCancel) cropCancel.addEventListener('click', closeCropModal);
    if (cropReset) cropReset.addEventListener('click', resetCrop);

    // 主题切换
    const themeToggle = document.getElementById('theme-toggle');
    const btnTheme = document.getElementById('btn-theme');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (btnTheme) btnTheme.addEventListener('click', toggleTheme);

    // TTS
    const btnTts = document.getElementById('btn-tts');
    if (btnTts) btnTts.addEventListener('click', toggleTTS);

    // 清空历史
    const btnClear = document.getElementById('btn-clear');
    if (btnClear) btnClear.addEventListener('click', clearAllHistory);

    // 新建对话
    const newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) newChatBtn.addEventListener('click', startNewChat);

    // 更多按钮
    const moreBtn = document.getElementById('more-btn');
    if (moreBtn) moreBtn.addEventListener('click', toggleDropdown);

    // 移动端菜单
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

// ==========================================
// 12. 文字消息发送
// ==========================================
async function sendTextMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message) return;

    // 显示用户消息
    displayMessage('user', message, null, true);
    input.value = '';

    // 获取当前会话的历史记录
    const currentSession = chatSessions.find(s => s.id === currentSessionId);
    const historyMessages = currentSession ? currentSession.messages : [];

    // 构建 API 消息格式
    const apiMessages = [
        {
            role: "system",
            content: `你是一个专业的数学辅导助手。用户可能会：
1. 请求你修正之前的解答
2. 询问解题步骤的细节
3. 要求换一种方法解题
4. 询问相关知识点

请用清晰、详细的方式回答。所有数学公式请使用 LaTeX 格式：
- 独立公式用 $$...$$ 包裹
- 行内公式用 $...$ 包裹`
        }
    ];

    // 添加历史消息
    historyMessages.forEach(msg => {
        if (msg.text) {
            apiMessages.push({
                role: msg.role === 'bot' ? 'assistant' : 'user',
                content: msg.text
            });
        }
    });

    const loading = document.getElementById('loading');
    loading.style.display = 'block';

    try {
        const response = await fetch(API_CONFIG.chat.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: apiMessages,
                model: 'deepseek-chat',
                stream: false,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`服务器错误: ${response.status}`);
        }

        const result = await response.json();
        loading.style.display = 'none';

        if (result.error) {
            displayMessage('bot', `❌ **错误**: ${result.error}`, null, true);
            return;
        }

        if (result.choices && result.choices.length > 0) {
            const reply = result.choices[0].message.content;
            displayMessage('bot', reply, null, true);
            speakText(reply);
        } else {
            displayMessage('bot', '❌ **API 错误**: 未能获取回复', null, true);
        }

    } catch (error) {
        loading.style.display = 'none';
        displayMessage('bot', `❌ **请求失败**: ${error.message}\n\n请检查网络连接后重试。`, null, true);
    }
}

