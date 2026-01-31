/**
 * MathSolver
 * Copyright (c) 2026 ICeCreamChat
 * Licensed under the MIT License.
 */
import * as THREE from 'three';

// ==========================================
// 1. 配置
// ==========================================
// ==========================================
// 1. 配置
// ==========================================
// API_CONFIG removed - using ApiClient module exclusively

// 状态
let isTTSEnabled = false;
let isManualTheme = false;
let isManualContextSwitch = false; // 看板手动锁定状态

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
// 使用安全解析，避免 JSON 解析失败导致的白屏
function safeJsonParse(str, fallback) {
    try {
        return str ? JSON.parse(str) : fallback;
    } catch (e) {
        console.error('Storage 解析失败:', e);
        return fallback;
    }
}

let chatSessions = safeJsonParse(localStorage.getItem('mathSolverSessions'), []);
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

    // Global Error Boundary
    window.onerror = function (msg, url, lineNo, columnNo, error) {
        console.error('Global Error:', msg, 'at', lineNo, ':', columnNo);
        if (window.showToast) window.showToast(`System Error: ${msg}`, 'error');
        return false;
    };

    initMathParticleScene();
    initPerformanceOptimization();

    if (window.UiManager) window.UiManager.init();

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
    if (window.lucide) window.lucide.createIcons();
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

function saveMessageToCurrentSession(role, text, imageUrl = null, contextData = null) {
    const session = chatSessions.find(s => s.id === currentSessionId);
    if (session) {
        session.messages.push({ role, text, imageUrl, contextData });
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
        // 使用 svg 字符串或 data-lucide
        item.innerHTML = `<span>${session.title}</span><span class="delete-chat" onclick="window.deleteSessionProxy(event, '${session.id}')"><i data-lucide="x" style="width:16px;"></i></span>`;
        list.appendChild(item);
    });
    // 渲染完历史列表后刷新图标
    if (window.lucide) window.lucide.createIcons();
}

async function deleteSession(e, id) {
    e.stopPropagation();

    // 使用自定义模态框替代原生 confirm
    const confirmed = await showConfirm('确认删除', '确定要删除此对话吗？此操作无法撤销。');

    if (confirmed) {
        chatSessions = chatSessions.filter(s => s.id !== id);
        saveData();
        renderHistoryList();
        if (chatSessions.length === 0) {
            startNewChat();
        } else if (currentSessionId === id) {
            loadSession(chatSessions[0].id);
        }
        showToast('对话已删除', 'success');
    }
}
window.deleteSessionProxy = deleteSession;

function updateSidebarActiveState() {
    document.querySelectorAll('.history-item').forEach(item => item.classList.remove('active'));
    renderHistoryList();
}

async function clearAllHistory() {
    // 使用自定义模态框
    const confirmed = await showConfirm('确认清空', '确定要清空所有对话历史吗？此操作将永久删除所有记录。');

    if (confirmed) {
        localStorage.removeItem('mathSolverSessions');
        localStorage.removeItem('mathSolverCurrentSession');
        chatSessions = [];
        startNewChat();
        const dropdown = document.getElementById('dropdownMenu');
        if (dropdown) dropdown.classList.remove('show');
        showToast('所有历史已清空', 'success');
    }
}

// ==========================================
// 6.2 健壮性工具 (Toast & Modal)
// ==========================================

// Toast 通知
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

    // 自动移除
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s forwards';
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

// 自定义确认框 (Promise 封装)
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const msgEl = document.getElementById('confirm-message');
        const btnCancel = document.getElementById('btn-confirm-cancel');
        const btnOk = document.getElementById('btn-confirm-ok');

        if (!modal) {
            // 回退到原生 confirm
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

        const onCancel = () => {
            cleanup();
            resolve(false);
        };

        const onOk = () => {
            cleanup();
            resolve(true);
        };

        btnCancel.addEventListener('click', onCancel);
        btnOk.addEventListener('click', onOk);
    });
}

// 暴露给全局以便 HTML 调用 (如果需要)
window.showToast = showToast;

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
function displayMessage(role, text, imageUrl = null, shouldSave = false, contextData = null) {
    if (shouldSave) saveMessageToCurrentSession(role, text, imageUrl, contextData);

    const container = document.getElementById('messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    // 如果是 Bot 消息且包含 contextData，绑定数据供 IntersectionObserver 使用
    if (role === 'bot' && contextData) {
        msgDiv.dataset.contextData = JSON.stringify(contextData);
        // 尝试立即更新一次（如果是最新的消息）
        if (!isManualContextSwitch && window.UiManager) {
            window.UiManager.updateContextPanel(contextData.image, contextData.text);
        }
    }

    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.src = role === 'user' ? 'user-avatar.jpg' : 'bot-avatar.jpg';
    avatar.alt = role;

    // 图片加载失败时回退到 Lucide 图标
    avatar.onerror = function () {
        const iconDiv = document.createElement('div');
        iconDiv.className = 'avatar icon-avatar'; // 添加一个类以便 CSS 可能的特殊处理
        iconDiv.innerHTML = role === 'user'
            ? '<i data-lucide="user"></i>'
            : '<i data-lucide="bot"></i>';
        this.replaceWith(iconDiv);
        if (window.lucide) window.lucide.createIcons();
    };

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // 移除“查看题目”按钮逻辑


    // 如果有图片 (User 上传的)，直接显示
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

        // 使用 MathRenderer 模块处理
        if (window.MathRenderer) {
            window.MathRenderer.renderMarkdown(text, textDiv);
        } else {
            // Fallback if module missing
            textDiv.textContent = text;
        }

        contentDiv.appendChild(textDiv);
    }

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(contentDiv);

    // KaTeX 渲染 (MathRenderer 已处理，此处可移除或保留作为双重保险)
    // 移除以前的 setTimeout 因为 restoreAndRender 内部已处理

    container.appendChild(msgDiv);

    // 生成图标
    if (window.lucide) window.lucide.createIcons();

    // 绑定滚动监听
    if (role === 'bot' && contextData) {
        observeMessageIntersection(msgDiv);
    }

    requestAnimationFrame(() => {
        msgDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
}

// ==========================================
// 13. 全局悬浮看板逻辑 (New Context Panel)

// 13.1 看板更新
// 13.1 看板更新
// function updateContextPanel has been moved to js/ui_manager.js

// 13.2 滚动监听 (Scroll Observer)
// 13.2 滚动同步 (Scroll Sync)
let messageObserver = null;
// let isManualContextSwitch = false; // 已在全局定义

function setupScrollObserver() {
    if (messageObserver) messageObserver.disconnect();

    // 改进：使用多个 threshold 确保捕捉各种进出情况
    const options = {
        root: document.getElementById('messages'),
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    };

    messageObserver = new IntersectionObserver((entries) => {
        // 如果最近发生过手动切换，暂停自动同步一小会儿
        if (isManualContextSwitch) return;

        // 核心算法改进：寻找屏幕上“最显著”的消息
        // 比较可见高度 (visible height in pixels) 而不是 intersectionRatio
        let maxVisibleHeight = 0;
        let targetEntry = null;

        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // 直接比谁的可见高度像素值大
                if (entry.intersectionRect.height > maxVisibleHeight) {
                    maxVisibleHeight = entry.intersectionRect.height;
                    targetEntry = entry;
                }
            }
        });

        // 阈值：如果最大的可见高度太小（比如刚滑入一点点），则不更新
        if (targetEntry && maxVisibleHeight > 100 && targetEntry.target.dataset.contextData) {
            try {
                const data = JSON.parse(targetEntry.target.dataset.contextData);
                // 仅当不一样时更新，避免无意义重绘
                const currentText = document.getElementById('context-text').textContent;
                // 使用 image 作为唯一标识符来去重
                const currentImage = document.getElementById('context-image').src;

                // 注意：src 可能是完整 URL，data.image 可能是 base64，比较需谨慎
                // 简单起见，只要 data 有值就调 update，update 内部有 diff check
                if (window.UiManager) {
                    window.UiManager.updateContextPanel(data.image, data.text);
                }
            } catch (e) {
                console.error("Context Data Parse Error", e);
            }
        }
    }, options);
}

function observeMessageIntersection(element, contextData) {
    if (!messageObserver) setupScrollObserver();
    // 兼容逻辑：如果传了 contextData，更新 dataset
    if (contextData) {
        element.dataset.contextData = JSON.stringify(contextData);
    }
    if (element.dataset.contextData) {
        messageObserver.observe(element);
    }
}

// 13.3 交互逻辑 (Drag & Event Binding)
// 绑定看板事件
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('context-toggle-btn');
    const panel = document.getElementById('context-panel');
    const contextHeader = document.getElementById('context-header');

    // Define toggle function in shared scope to avoid ReferenceError
    const toggleMiniMode = () => {
        if (!panel) return;
        panel.classList.toggle('mini');
        if (panel.classList.contains('mini')) {
            // Save size before mini
            panel.dataset.prevWidth = panel.style.width;
            panel.dataset.prevHeight = panel.style.height;
            showToast('已切换为小图标模式', 'info');
        } else {
            // Restore size
            if (panel.dataset.prevWidth) panel.style.width = panel.dataset.prevWidth;
            if (panel.dataset.prevHeight) panel.style.height = panel.dataset.prevHeight;
        }
    };

    if (toggleBtn && panel) {
        // Define toggle function first to avoid ReferenceError
        // toggleMiniMode definition moved to parent scope

        const toggleFunc = () => {
            // Use toggleMiniMode for consistent 'collapse' behavior
            toggleMiniMode();
        };
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFunc();
        });

        const lockBtn = document.getElementById('context-lock-btn');
        if (lockBtn) {
            lockBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // 切换锁定状态
                isManualContextSwitch = !isManualContextSwitch;

                const icon = lockBtn.querySelector('i'); // 或者 svg
                if (isManualContextSwitch) {
                    lockBtn.style.color = 'var(--accent-color)';
                    lockBtn.innerHTML = '<i data-lucide="lock"></i>';
                    showToast('看板已锁定', 'info');
                } else {
                    lockBtn.style.color = '';
                    lockBtn.innerHTML = '<i data-lucide="unlock"></i>';
                    showToast('看板已解锁', 'info');
                }
                if (window.lucide) window.lucide.createIcons();
            });
        }
    }

    // 桌面端：拖拽逻辑 (Floating Widget)
    if (panel && contextHeader) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        const dragStart = (e) => {
            // 允许移动端拖拽

            // 检查点击目标是否在 header 内，且不是按钮
            const isHeader = e.target.closest('.context-header');
            const isButton = e.target.closest('button') || e.target.closest('.context-toggle-btn');

            if (!isHeader || isButton) return;

            isDragging = true;

            if (e.type === 'mousedown') {
                startX = e.clientX;
                startY = e.clientY;
            } else if (e.type === 'touchstart') {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            }

            // 获取当前位置（如果没有设置 left/top，默认为 CSS 中的值）
            const rect = panel.getBoundingClientRect();
            // 注意：getBoundingClientRect 返回的是相对于视口的坐标
            initialLeft = rect.left;
            initialTop = rect.top;

            // 切换为 JS 控制定位
            // 关键：必须清除 bottom/right，否则 top/left 可能无效 (取决于 CSS 优先级)
            panel.style.position = 'fixed';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto'; // 清除 CSS 中的 bottom: 100px

            panel.style.left = `${initialLeft}px`;
            panel.style.top = `${initialTop}px`;

            panel.style.transition = 'none'; // 拖拽时移除过渡
            panel.style.cursor = 'grabbing';
            // 阻止默认滚动
            if (e.type === 'touchstart') document.body.style.overflow = 'hidden';
        };

        const dragEnd = (e) => {
            if (!isDragging) return;

            // 判断是否是点击（位移很小）
            const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
            const dist = Math.sqrt(Math.pow(clientX - startX, 2) + Math.pow(clientY - startY, 2));

            isDragging = false;
            panel.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s'; // 恢复过渡
            panel.style.cursor = 'default';
            document.body.style.overflow = ''; // 恢复滚动

            // 如果位移小于 5px，视为点击，触发切换
            if (dist < 5 && (e.target === contextHeader || e.target.classList.contains('context-title') || e.target.closest('.context-title'))) {
                // Remove single click toggle, use double click or button
            }

            // Save Position Preference
            localStorage.setItem('mathSolver_panelPos', JSON.stringify({
                left: panel.offsetLeft,
                top: panel.offsetTop
            }));
        };

        // Allow expanding from Mini Mode by simple click (since button is hidden)
        // But do NOT allow collapsing by click (user requested button only)
        // Allow expanding from Mini Mode by DOUBLE CLICK (User Request)
        contextHeader.addEventListener('dblclick', (e) => {
            if (panel.classList.contains('mini')) {
                toggleMiniMode();
            }
        });

        // Prevent single click from doing anything in Mini Mode (it might conflict with drag, but drag is handled separately)
        // Note: dragEnd logic for toggle was already disabled/empty in lines 787-789.

        // toggleMiniMode definition moved to parent scope

        // === Resize Logic ===
        const resizers = panel.querySelectorAll('.resizer');
        let currentResizer;

        for (let resizer of resizers) {
            resizer.addEventListener('mousedown', initResize);
            resizer.addEventListener('touchstart', initResize, { passive: false });
        }

        function initResize(e) {
            e.stopPropagation(); // Critical: Stop drag from starting
            e.preventDefault(); // Prevent text selection
            currentResizer = e.target;

            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResize);
            window.addEventListener('touchmove', resize, { passive: false });
            window.addEventListener('touchend', stopResize);

            // Disable transition during resize for performance
            panel.style.transition = 'none';

            const rect = panel.getBoundingClientRect();
            panel.dataset.startX = e.clientX || e.touches[0].clientX;
            panel.dataset.startY = e.clientY || e.touches[0].clientY;
            panel.dataset.startWidth = rect.width;
            panel.dataset.startHeight = rect.height;
            panel.dataset.startLeft = rect.left;
            panel.dataset.startTop = rect.top;
        }

        function resize(e) {
            const clientX = e.clientX || e.touches[0].clientX;
            const clientY = e.clientY || e.touches[0].clientY;

            const dx = clientX - parseFloat(panel.dataset.startX);
            const dy = clientY - parseFloat(panel.dataset.startY);

            const startWidth = parseFloat(panel.dataset.startWidth);
            const startHeight = parseFloat(panel.dataset.startHeight);
            const startLeft = parseFloat(panel.dataset.startLeft);
            const startTop = parseFloat(panel.dataset.startTop);

            // Right / Bottom resizing
            if (currentResizer.classList.contains('resizer-r') || currentResizer.classList.contains('resizer-rb')) {
                panel.style.width = Math.max(300, startWidth + dx) + 'px';
            }
            if (currentResizer.classList.contains('resizer-b') || currentResizer.classList.contains('resizer-rb') || currentResizer.classList.contains('resizer-lb')) {
                panel.style.height = Math.max(200, startHeight + dy) + 'px';
            }

            // Left resizing (Requires moving left AND changing width)
            if (currentResizer.classList.contains('resizer-l') || currentResizer.classList.contains('resizer-lb')) {
                const newWidth = Math.max(300, startWidth - dx);
                // Only update left if width actually changed (respected constraints)
                if (newWidth > 300) {
                    panel.style.left = (startLeft + dx) + 'px';
                    panel.style.width = newWidth + 'px';
                    // Force fixed positioning if not already
                    panel.style.position = 'fixed';
                    panel.style.right = 'auto'; // Clear right if it was set
                }
            }
            // Top resizing (Requires moving top AND changing height)
            if (currentResizer.classList.contains('resizer-t') || currentResizer.classList.contains('resizer-tr') || currentResizer.classList.contains('resizer-tl')) {
                const newHeight = Math.max(200, startHeight - dy);
                if (newHeight > 200) {
                    panel.style.top = (startTop + dy) + 'px';
                    panel.style.height = newHeight + 'px';
                    panel.style.position = 'fixed';
                    panel.style.bottom = 'auto';
                }
            }

            // Width adjustments for corners
            if (currentResizer.classList.contains('resizer-tr')) {
                panel.style.width = Math.max(300, startWidth + dx) + 'px';
            }
            if (currentResizer.classList.contains('resizer-tl')) {
                const newWidth = Math.max(300, startWidth - dx);
                if (newWidth > 300) {
                    panel.style.left = (startLeft + dx) + 'px';
                    panel.style.width = newWidth + 'px';
                    panel.style.position = 'fixed';
                    panel.style.right = 'auto';
                }
            }
        }

        function stopResize() {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResize);
            window.removeEventListener('touchmove', resize);
            window.removeEventListener('touchend', stopResize);

            panel.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'; // Restore smooth transition

            // Save Size Preference
            localStorage.setItem('mathSolver_panelSize', JSON.stringify({
                width: panel.style.width,
                height: panel.style.height
            }));

            // Also save position as left resizing changes it
            localStorage.setItem('mathSolver_panelPos', JSON.stringify({
                left: panel.offsetLeft,
                top: panel.offsetTop
            }));
        }
        const drag = (e) => {
            if (!isDragging) return;

            let clientX, clientY;
            if (e.type === 'mousemove') {
                e.preventDefault();
                clientX = e.clientX;
                clientY = e.clientY;
            } else if (e.type === 'touchmove') {
                e.preventDefault();
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            }

            const dx = clientX - startX;
            const dy = clientY - startY;

            panel.style.left = `${initialLeft + dx}px`;
            panel.style.top = `${initialTop + dy}px`;
        };

        // Restore Position & Size on Load
        const savedPos = safeJsonParse(localStorage.getItem('mathSolver_panelPos'));
        if (savedPos) {
            panel.style.left = `${savedPos.left}px`;
            panel.style.top = `${savedPos.top}px`;
        }

        const savedSize = safeJsonParse(localStorage.getItem('mathSolver_panelSize'));
        if (savedSize) {
            panel.style.width = savedSize.width;
            panel.style.height = savedSize.height;
        }

        // === Smart Opacity Logic REMOVED as per user request ===
        // The panel will now remain fully opaque unless manually toggled.

        if (window.matchMedia("(min-width: 769px)").matches) {
            document.addEventListener('mousemove', drag);
            document.addEventListener('touchmove', drag, { passive: false });
            document.addEventListener('mouseup', dragEnd);
            document.addEventListener('touchend', dragEnd);
            if (contextHeader) {
                contextHeader.addEventListener('mousedown', dragStart);
                contextHeader.addEventListener('touchstart', dragStart, { passive: false });
            }
        }
    }
});

// Helper
// Helper `tryParseJSON` removed. Use global `safeJsonParse` (line 33) or move to utils.

// ==========================================
// 移动端 FAB + 底部抽屉逻辑
// ==========================================
// ==========================================
// 移动端 FAB + 底部抽屉逻辑
// ==========================================
const fab = document.getElementById('mobile-context-fab');
// Duplicate mobile context logic removed.
// See lines ~909 for the active implementation.

// ==========================================
// 8. TTS 朗读
// ==========================================
function toggleTTS() {
    isTTSEnabled = !isTTSEnabled;
    const label = document.getElementById('tts-label');
    if (label) {
        // 更新图标和文字
        label.innerHTML = isTTSEnabled
            ? `<i data-lucide="volume-2" style="width: 16px;"></i> 朗读: 开`
            : `<i data-lucide="volume-x" style="width: 16px;"></i> 朗读: 关`;
        if (window.lucide) window.lucide.createIcons();
    }
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
        let result;

        // 优先使用模块化的 ApiClient
        if (window.ApiClient) {
            const formData = new FormData();
            // Convert base64 to blob
            const response = await fetch(croppedImageData);
            const blob = await response.blob();
            formData.append('image', blob, 'capture.jpg');

            result = await window.ApiClient.analyze(formData);
        } else {
            throw new Error("ApiClient module not loaded");
        }

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

        // 构造看板数据
        let panelImage = result.data.diagramBase64 || null;
        let panelText = result.data.extractedText || "（暂无文字识别结果）";

        // 全能兜底方案：
        // 如果 OCR 失败 (包含错误关键词) 或者 识别内容极少 (可能为空)，且没有生成 AI 图形
        // 则强制使用用户上传的原图 (croppedImageData) 作为看板图片，确保用户至少能看到题目原貌。
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
            // Enrich for Long-term Context Anchoring
            extractedText: result.data.extractedText || "",
            imageDescription: result.data.imageDescription || "",
            solution: result.data.solution || ""
        };

        // 不再传递图片参数，因为已嵌入内容中，但传递 contextData 用于悬浮窗
        displayMessage('bot', aiContent, null, true, contextData);
        speakText(aiContent);

    } catch (error) {
        loading.style.display = 'none';
        displayMessage('bot', `❌ **解题失败**: ${error.message}\n\n请检查网络连接后重试。`, null, true);
        showToast('解题失败，请查看消息', 'error');
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

    // --- Context Anchoring Strategy ---
    // 1. Find the latest "Problem Context" (contextData) from history
    //    This ensures we never forget the original problem, even if it's 100 turns ago.
    let anchoredContext = null;
    let anchoredPrompt = "";

    // Search backwards for the most recent bot message that has contextData (Problem Solution)
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
        console.log("Context Anchored:", anchoredContext.extractedText?.substring(0, 20) + "...");
    }

    // 构建 API 消息格式
    const apiMessages = [
        {
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
        }
    ];

    // 添加历史消息 (Feature: Context Management)
    // 1. 过滤掉 Base64 图片 (防止 Token 爆炸)
    // 2. 滑动窗口：保留最近 50 条 (25轮)，由于有了 Anchoring，这足够且安全
    const MAX_HISTORY = 50;
    const recentMessages = historyMessages.slice(-MAX_HISTORY);

    recentMessages.forEach(msg => {
        if (msg.text) {
            // Remove base64 images syntax: ![...](data:image/...)
            let safeContent = msg.text.replace(/!\[.*?\]\(data:image\/.*?\)/g, '[图片]');

            // Also remove any standalone long base64 strings just in case
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

        const result = await window.ApiClient.chat(apiMessages);

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


