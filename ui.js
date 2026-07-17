/**
 * Hulu Hub — Floating UI v4.2 (New Chat feature + Robust Settings)
 */

"use strict";

(function () {
  if (document.getElementById("hulu-hub-root")) return;

  const root   = document.createElement("div");
  root.id      = "hulu-hub-root";
  document.body.appendChild(root);
  const shadow = root.attachShadow({ mode: "open" });

  const LOGO_SVG = `
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="40" height="40">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2EF2C4"/>
      <stop offset="100%" stop-color="#4D5DFF"/>
    </linearGradient>
  </defs>
  <path fill="url(#g)" d="M18 8C12.5 8 8 12.5 8 18v22c0 5.5 4.5 10 10 10h10l6 6v-6h12c5.5 0 10-4.5 10-10V18c0-5.5-4.5-10-10-10H18z"/>
  <path fill="#0B1220" d="M20 12c-4.4 0-8 3.6-8 8v18c0 4.4 3.6 8 8 8h10v3.5l4-3.5h10c4.4 0 8-3.6 8-8V20c0-4.4-3.6-8-8-8H20z"/>
  <path fill="url(#g)" d="M24 18h5v9h6v-9h5v22h-5v-8h-6v8h-5V18z"/>
</svg>`;

  const styleEl = document.createElement("style");
  styleEl.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :host { all: initial; }

    #hub-btn {
      position: fixed;
      bottom: 28px;
      left: 28px;
      width: 54px;
      height: 54px;
      border-radius: 50%;
      border: none;
      padding: 0;
      cursor: grab;
      pointer-events: auto;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      background: none;
      z-index: 2147483647;
      transition: transform 0.2s cubic-bezier(.34,1.56,.64,1);
      filter: drop-shadow(0 4px 12px rgba(77,93,255,0.45));
    }
    #hub-btn:active { cursor: grabbing; transform: scale(0.95); }
    #hub-btn:hover  { transform: scale(1.1);  }
    #hub-btn.open   { transform: scale(0.92); filter: drop-shadow(0 2px 6px rgba(77,93,255,0.3)); }

    #hub-badge {
      display: none;
      position: absolute;
      top: 0; right: 0;
      width: 16px; height: 16px;
      background: #ef4444;
      border-radius: 50%;
      border: 2.5px solid white;
      font-size: 9px;
      color: white;
      font-weight: 700;
      align-items: center;
      justify-content: center;
      font-family: Inter, sans-serif;
    }
    #hub-badge.show { display: flex; }

    #hub-panel {
      position: fixed;
      bottom: 94px;
      left: 28px;
      width: 370px;
      height: 520px;
      z-index: 2147483646;
      display: flex;
      flex-direction: column;
      border-radius: 20px;
      overflow: hidden;
      background: #000000;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 24px 64px rgba(0,0,0,0.7), 0 4px 24px rgba(0, 0, 0, 0.8);
      transform-origin: bottom left;
      transform: scale(0.88) translateY(8px);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.22s cubic-bezier(.34,1.56,.64,1), opacity 0.18s ease;
      font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    #hub-panel.visible {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: auto; 
    }

    .hub-header { 
      display: flex; 
      align-items: center; 
      justify-content: space-between; 
      padding: 14px 16px; 
      background: linear-gradient(135deg, #2EF2C4 0%, #4D5DFF 100%); 
      flex-shrink: 0; 
      gap: 10px; 
    }
    .hub-header-left { display: flex; align-items: center; gap: 9px; }
    .hub-logo-sm { width: 32px; height: 32px; border-radius: 8px;  display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .hub-logo-sm svg { width: 32px; height: 32px; }
    .hub-header h3 { font-size: 15px; font-weight: 600; color: #0B1220; letter-spacing: -0.01em; }
    
    .hub-provider-wrap { position: relative; }
    #hub-provider { 
      appearance: none; 
      -webkit-appearance: none; 
      padding: 5px 26px 5px 10px; 
      border-radius: 8px; 
      border: 1px solid rgba(11,18,32,0.2); 
      font-size: 12px; 
      font-weight: 700; 
      background: rgba(46, 242, 196, 0.45); 
      color: #000000; 
      cursor: pointer; 
      outline: none; 
      font-family: inherit; 
    }
    #hub-provider option { background: #ffffff; color: #000000; font-weight: 600; }
    .hub-provider-arrow { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #0B1220; font-size: 10px; }
    
    .hub-icon-btn { width: 28px; height: 28px; border-radius: 8px; border: none; background: rgba(11,18,32,0.15); color: #0B1220; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; transition: background 0.15s; font-family: inherit; }
    .hub-icon-btn:hover { background: rgba(11,18,32,0.3); }

    /* Settings UI */
    #hub-settings {
      position: absolute; inset: 0; top: 60px;
      background: #000000; z-index: 10; display: none;
      flex-direction: column; padding: 20px; gap: 12px;
    }
    #hub-settings.show { display: flex; }
    .hub-settings-btn {
      padding: 12px; border-radius: 8px; border: 1px solid #222;
      background: #111; color: #fff; cursor: pointer; font-weight: 500; font-family: inherit; text-align: left;
    }
    .hub-settings-btn:hover { background: #1a1a1a; }

    #hub-history { flex: 1; overflow-y: auto; padding: 16px 14px; display: flex; flex-direction: column; gap: 10px; scroll-behavior: smooth; background: #050505; }
    #hub-history::-webkit-scrollbar { width: 4px; }
    #hub-history::-webkit-scrollbar-track { background: transparent; }
    #hub-history::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 4px; }

    .hub-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; opacity: 0.6; pointer-events: none; user-select: none; }
    .hub-empty-icon { font-size: 32px; color: #ffffff; }
    .hub-empty-text { font-size: 13px; color: #ffffff; font-weight: 500; }

    .hub-msg { max-width: 84%; padding: 10px 14px; border-radius: 16px; font-size: 13.5px; line-height: 1.6; word-wrap: break-word; white-space: pre-wrap; animation: bubbleIn 0.18s ease; }
    @keyframes bubbleIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    
    .hub-msg.user { background: linear-gradient(135deg, #2EF2C4 0%, #4D5DFF 100%); color: #0B1220; align-self: flex-end; border-bottom-right-radius: 4px; box-shadow: 0 2px 12px rgba(77,93,255,0.25); font-weight: 500; }
    .hub-msg.assistant { background: #121212; color: #f3f4f6; align-self: flex-start; border-bottom-left-radius: 4px; border: 1px solid #1a1a1a; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
    .hub-msg.loading { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #ffffff; font-style: italic; font-size: 13px; align-self: flex-start; border-bottom-left-radius: 4px; animation: pulse 1.6s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

    a.hub-link { color: #2EF2C4; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; word-break: break-all; font-weight: 500; }
    a.hub-link:hover { color: #4D5DFF; }

    .hub-input-area { padding: 12px 14px; background: #000000; border-top: 1px solid #121212; flex-shrink: 0; display: flex; flex-direction: column; gap: 9px; }
    #hub-input { width: 100%; padding: 10px 12px; border: 1.5px solid #1c1c1e; border-radius: 12px; resize: none; font-family: inherit; font-size: 13.5px; line-height: 1.5; outline: none; height: 64px; background: #0a0a0a; color: #fff; transition: border-color 0.15s, box-shadow 0.15s; }
    #hub-input::placeholder { color: #48484a; }
    #hub-input:focus { border-color: #2EF2C4; box-shadow: 0 0 0 3px rgba(46,242,196,0.15); }
    #hub-input:disabled { background: #000000; color: #444; border-color: #121212; }

    .hub-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    
    /* New Chat Toggle Button */
    #hub-new-chat-btn { display: flex; align-items: center; gap: 5px; padding: 7px 12px; border-radius: 9px; border: 1.5px solid #1c1c1e; background: #0a0a0a; color: #a1a1aa; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all 0.15s; }
    #hub-new-chat-btn:hover { background: #121212; color: #ffffff; border-color: #2c2c2e; }
    #hub-new-chat-btn.active { background: #ffffff; border-color: #ffffff; color: #000000; }

    #hub-send-btn { padding: 7px 20px; border-radius: 9px; border: none; background: linear-gradient(135deg, #2EF2C4 0%, #4D5DFF 100%); color: #0B1220; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: opacity 0.15s, transform 0.1s; box-shadow: 0 2px 8px rgba(77,93,255,0.3); letter-spacing: 0.01em; }
    #hub-send-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
    #hub-send-btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }

    /* Light Theme Overrides */
    #hub-panel.light-theme, #hub-panel.light-theme #hub-settings { background: #ffffff; }
    #hub-panel.light-theme { border: 1px solid rgba(0,0,0,0.15); box-shadow: 0 16px 48px rgba(0,0,0,0.2); }
    #hub-panel.light-theme .hub-header { background: #f4f4f5; border-bottom: 1px solid #e4e4e7; }
    #hub-panel.light-theme .hub-header h3 { color: #18181b; }
    #hub-panel.light-theme #hub-provider { background: #e4e4e7; color: #18181b; border-color: #d4d4d8; }
    #hub-panel.light-theme #hub-history { background: #fafafa; }
    #hub-panel.light-theme .hub-msg.assistant { background: #ffffff; color: #18181b; border: 1px solid #e4e4e7; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
    #hub-panel.light-theme .hub-msg.loading { color: #71717a; border-color: #e4e4e7; background: #f4f4f5; }
    #hub-panel.light-theme .hub-input-area { background: #ffffff; border-top: 1px solid #e4e4e7; }
    #hub-panel.light-theme #hub-input { background: #ffffff; color: #18181b; border-color: #d4d4d8; }
    #hub-panel.light-theme #hub-new-chat-btn { background: #f4f4f5; color: #3f3f46; border-color: #d4d4d8; }
    #hub-panel.light-theme #hub-new-chat-btn.active { background: #18181b; color: #ffffff; border-color: #18181b; }
    #hub-panel.light-theme .hub-empty-text, #hub-panel.light-theme .hub-empty-icon { color: #71717a; }
    #hub-panel.light-theme .hub-settings-btn { background: #f4f4f5; color: #18181b; border-color: #d4d4d8; }
    #hub-panel.light-theme .hub-settings-btn:hover { background: #e4e4e7; }
    #hub-panel.light-theme .hub-icon-btn { background: #e4e4e7; }

    /* Attachments & Lightbox */
    #hub-attach-preview { display: none; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px; background: #0a0a0a; border: 1px solid #1c1c1e; }
    #hub-attach-preview.show { display: flex; }
    #hub-panel.light-theme #hub-attach-preview { background: #f4f4f5; border-color: #d4d4d8; }
    #hub-attach-thumb { width: 36px; height: 36px; border-radius: 7px; object-fit: cover; cursor: pointer; border: 1px solid #2c2c2e; flex-shrink: 0; transition: transform 0.12s; }
    #hub-attach-label { flex: 1; font-size: 12px; color: #a1a1aa; font-weight: 500; }
    #hub-attach-remove { width: 22px; height: 22px; border-radius: 6px; border: none; background: #1c1c1e; color: #a1a1aa; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    
    #hub-lightbox { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.86); z-index: 2147483647; align-items: center; justify-content: center; pointer-events: auto; }
    #hub-lightbox.show { display: flex; }
    #hub-lightbox-img { max-width: 90vw; max-height: 90vh; border-radius: 12px; }
    #hub-lightbox-close { position: fixed; top: 20px; right: 20px; width: 38px; height: 38px; border-radius: 50%; border: none; background: rgba(255,255,255,0.12); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  `;
  shadow.appendChild(styleEl);

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.inset = "0";
  wrapper.style.pointerEvents = "none";
  wrapper.style.zIndex = "2147483647";

  wrapper.innerHTML = `
    <button id="hub-btn" title="Hulu Hub">
      ${LOGO_SVG}
      <span id="hub-badge"></span>
    </button>
    <div id="hub-panel">
      <div class="hub-header">
        <div class="hub-header-left">
          <div class="hub-logo-sm">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32">
              <defs>
                <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#2EF2C4"/><stop offset="100%" stop-color="#4D5DFF"/>
                </linearGradient>
              </defs>
              <path fill="url(#g2)" d="M18 8C12.5 8 8 12.5 8 18v22c0 5.5 4.5 10 10 10h10l6 6v-6h12c5.5 0 10-4.5 10-10V18c0-5.5-4.5-10-10-10H18z"/>
              <path fill="#0B1220" d="M20 12c-4.4 0-8 3.6-8 8v18c0 4.4 3.6 8 8 8h10v3.5l4-3.5h10c4.4 0 8-3.6 8-8V20c0-4.4-3.6-8-8-8H20z"/>
              <path fill="url(#g2)" d="M24 18h5v9h6v-9h5v22h-5v-8h-6v8h-5V18z"/>
            </svg>
          </div>
          <h3>Hulu Hub</h3>
        </div>
        <div class="hub-provider-wrap">
          <select id="hub-provider">
            <option value="chatgpt">ChatGPT</option>
            <option value="claude">Claude</option>
            <option value="gemini">Gemini</option>
          </select>
          <span class="hub-provider-arrow">▾</span>
        </div>
        <div style="display:flex; gap: 6px;">
          <button id="hub-settings-toggle" class="hub-icon-btn" title="Settings">⚙️</button>
          <button id="hub-close-btn" class="hub-icon-btn" title="Close">✕</button>
        </div>
      </div>
      
      <div id="hub-settings">
        <h4 style="color: inherit; margin-bottom: 5px;">Hulu Hub Settings</h4>
        <button id="hub-clear-win" class="hub-settings-btn">🧹 Clear Active Background Windows</button>
        <button id="hub-clear-chats" class="hub-settings-btn">🗑️ Clear All Chats History</button>
        <button id="hub-theme-btn" class="hub-settings-btn">🎨 Toggle Theme (Current: Dark)</button>
      </div>

      <div id="hub-history">
        <div class="hub-empty">
          <div class="hub-empty-icon">🤖</div>
          <div class="hub-empty-text">Start a conversation</div>
        </div>
      </div>
      <div class="hub-input-area">
        <div id="hub-attach-preview">
          <img id="hub-attach-thumb" alt="Attached image"/>
          <span id="hub-attach-label">Image attached</span>
          <button id="hub-attach-remove" title="Remove image">✕</button>
        </div>
        <textarea id="hub-input" placeholder="Ask anything… (Enter to send, Shift+Enter for new line)"></textarea>
        <div class="hub-actions">
          <button id="hub-new-chat-btn">✨ New Chat</button>
          <button id="hub-send-btn">Send →</button>
        </div>
      </div>
    </div>

    <div id="hub-lightbox">
      <button id="hub-lightbox-close" title="Close">✕</button>
      <img id="hub-lightbox-img" alt="Full size preview"/>
    </div>
  `;
  shadow.appendChild(wrapper);

  const hubBtn       = shadow.getElementById("hub-btn");
  const badge        = shadow.getElementById("hub-badge");
  const panel        = shadow.getElementById("hub-panel");
  const history      = shadow.getElementById("hub-history");
  const input        = shadow.getElementById("hub-input");
  const sendBtn      = shadow.getElementById("hub-send-btn");
  const newChatBtn   = shadow.getElementById("hub-new-chat-btn");
  const provider     = shadow.getElementById("hub-provider");
  const closeBtn     = shadow.getElementById("hub-close-btn");

  const attachPreview = shadow.getElementById("hub-attach-preview");
  const attachThumb   = shadow.getElementById("hub-attach-thumb");
  const attachLabel   = shadow.getElementById("hub-attach-label");
  const attachRemove  = shadow.getElementById("hub-attach-remove");
  const lightbox       = shadow.getElementById("hub-lightbox");
  const lightboxImg    = shadow.getElementById("hub-lightbox-img");
  const lightboxClose  = shadow.getElementById("hub-lightbox-close");

  // Settings
  const settingsToggle = shadow.getElementById("hub-settings-toggle");
  const settingsPanel  = shadow.getElementById("hub-settings");
  const clearWinBtn    = shadow.getElementById("hub-clear-win");
  const clearChatsBtn  = shadow.getElementById("hub-clear-chats");
  const themeBtn       = shadow.getElementById("hub-theme-btn");

  let panelOpen        = false;
  let messages         = [];
  let loadingEl        = null;
  let isBusy           = false;
  let unreadCount      = 0;
  let attachedImage    = null; 

  function setAttachedImage(dataUrl, source) {
    attachedImage  = dataUrl;
    attachThumb.src = dataUrl;
    attachLabel.textContent = source === "screenshot" ? "Screenshot attached" : "Image attached";
    attachPreview.classList.add("show");
  }
  function clearAttachedImage() {
    attachedImage = null; attachThumb.src = ""; attachPreview.classList.remove("show");
  }

  // --- DRAG SYSTEM ---
  let isDragging = false, startX = 0, startY = 0, btnLeft = 28, btnBottom = 28;
  let currentDragLeft = 0, currentDragTop = 0, ticking = false;

  function repositionPanel() {
    panel.style.left = `${btnLeft}px`;
    panel.style.bottom = `${btnBottom + 66}px`;
  }

  hubBtn.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return; 
    isDragging = false;
    startX = e.clientX; startY = e.clientY;
    const initialLeft = hubBtn.offsetLeft, initialTop = hubBtn.offsetTop;

    function updatePosition() {
      hubBtn.style.left = `${currentDragLeft}px`; hubBtn.style.top = `${currentDragTop}px`; hubBtn.style.bottom = "auto";
      panel.style.left = `${currentDragLeft}px`; panel.style.bottom = `${window.innerHeight - currentDragTop + 12}px`;
      ticking = false;
    }

    function onMouseMove(moveEvent) {
      const deltaX = moveEvent.clientX - startX, deltaY = moveEvent.clientY - startY;
      if (!isDragging && (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)) isDragging = true;
      if (isDragging) {
        currentDragLeft = Math.max(10, Math.min(window.innerWidth - 64, initialLeft + deltaX));
        currentDragTop = Math.max(10, Math.min(window.innerHeight - 64, initialTop + deltaY));
        if (!ticking) { window.requestAnimationFrame(updatePosition); ticking = true; }
      }
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", onMouseUp);
      if (isDragging) {
        btnLeft = hubBtn.offsetLeft; btnBottom = window.innerHeight - (hubBtn.offsetTop + 54);
        hubBtn.style.bottom = `${btnBottom}px`; hubBtn.style.top = "auto";
        repositionPanel();
        chrome.storage.local.set({ hubBtnLeft: btnLeft, hubBtnBottom: btnBottom });
      }
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  // --- INTERACTION FLOW ---
  function openPanel() {
    panelOpen = true;
    repositionPanel();
    panel.classList.add("visible");
    hubBtn.classList.add("open");
    unreadCount = 0; badge.classList.remove("show"); badge.textContent = "";
    setTimeout(() => input.focus(), 220);
    scrollBottom();
    chrome.storage.local.set({ hubPanelOpen: true });
  }
  
  function closePanel() {
    panelOpen = false;
    panel.classList.remove("visible");
    hubBtn.classList.remove("open");
    settingsPanel.classList.remove("show");
    chrome.storage.local.set({ hubPanelOpen: false });
  }

  hubBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); if (!isDragging) { panelOpen ? closePanel() : openPanel(); } });
  closeBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); closePanel(); });
  shadow.addEventListener("click", e => e.stopPropagation());

  // --- SETTINGS LOGIC ---
  settingsToggle.addEventListener("click", () => settingsPanel.classList.toggle("show"));
  
  clearWinBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "CLEAR_WINDOWS" });
    clearWinBtn.textContent = "✅ Cleared Active Windows!";
    setTimeout(() => clearWinBtn.textContent = "🧹 Clear Active Background Windows", 2000);
  });
  
  clearChatsBtn.addEventListener("click", () => {
    chrome.storage.local.remove(["history_chatgpt", "history_claude", "history_gemini"], () => {
      messages = []; renderAll();
      clearChatsBtn.textContent = "✅ History Wiped!";
      setTimeout(() => clearChatsBtn.textContent = "🗑️ Clear All Chats History", 2000);
    });
  });
  
  function applyTheme(isLight) {
    if (isLight) panel.classList.add("light-theme"); else panel.classList.remove("light-theme");
    themeBtn.textContent = isLight ? "🎨 Toggle Theme (Current: Light)" : "🎨 Toggle Theme (Current: Dark)";
  }

  themeBtn.addEventListener("click", () => {
    const isLight = !panel.classList.contains("light-theme");
    applyTheme(isLight);
    chrome.storage.local.set({ hubThemeLight: isLight });
  });

  function isContextValid() { return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id; }

  try {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request.action === "TOGGLE_HUB_PANEL") { panelOpen ? closePanel() : openPanel(); return; }
      if (request.action === "HIDE_HUB_WIDGET") { root.style.display = "none"; sendResponse({ ok: true }); return; }
      if (request.action === "SHOW_HUB_WIDGET") { root.style.display = ""; sendResponse({ ok: true }); return; }
    });
  } catch(e) {}

  async function loadHistory(p) {
    if (!isContextValid()) return;
    try {
      const data = await chrome.storage.local.get(`history_${p}`);
      messages = data[`history_${p}`] || []; renderAll();
    } catch (e) {}
  }

  async function saveHistory(p) {
    if (!isContextValid()) return;
    try { await chrome.storage.local.set({ [`history_${p}`]: messages }); } catch (e) {}
  }

  function renderAll() {
    history.innerHTML = "";
    if (messages.length === 0) { history.innerHTML = `<div class="hub-empty"><div class="hub-empty-icon">🤖</div><div class="hub-empty-text">Start a conversation</div></div>`; return; }
    for (const m of messages) appendBubble(m.role, m.content);
    scrollBottom();
  }
  
  function appendBubble(role, content) {
    const div = document.createElement("div");
    div.className = `hub-msg ${role}`;
    if (role === "assistant") div.innerHTML = content.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/(https?:\/\/[^\s<>"')\]]+)/g, '<a class="hub-link" data-url="$1">$1</a>');
    else div.textContent = content;
    history.appendChild(div); return div;
  }
  
  function scrollBottom() { requestAnimationFrame(() => { history.scrollTop = history.scrollHeight; }); }

  history.addEventListener("click", e => {
    const a = e.target.closest(".hub-link");
    if (!a) return;
    e.preventDefault();
    if (isContextValid()) chrome.tabs.create({ url: a.dataset.url, active: true }); else window.open(a.dataset.url, "_blank");
  });

  function showLoading() {
    if (loadingEl?.parentNode) loadingEl.parentNode.removeChild(loadingEl);
    loadingEl = document.createElement("div"); loadingEl.className = "hub-msg loading"; loadingEl.textContent = "Thinking…";
    history.appendChild(loadingEl); scrollBottom();
  }

  // Toggle state for New Chat button
  newChatBtn.addEventListener("click", () => {
    newChatBtn.classList.toggle("active");
  });

  async function handleSend() {
    if (isBusy) return;
    if (!isContextValid()) { alert("Hulu Hub has updated. Please refresh this page."); return; }
    
    const text = input.value.trim(); if (!text) return;
    const p = provider.value; 
    const imageToSend = attachedImage;
    const isNewChat = newChatBtn.classList.contains("active");

    // If starting a new chat, wipe the local UI history for this provider first
    if (isNewChat) {
      messages = [];
    }

    messages.push({ role: "user", content: text + (imageToSend ? "\n[Image attached]" : "") });
    renderAll(); await saveHistory(p);
    
    input.value = ""; isBusy = true; sendBtn.disabled = true; showLoading();

    try {
      const result = await new Promise(resolve => {
        chrome.runtime.sendMessage({ 
          action: "SEND_TO_PROVIDER", 
          provider: p, 
          prompt: text, 
          imageDataUrl: imageToSend,
          newChat: isNewChat 
        }, res => resolve(chrome.runtime.lastError ? { error: chrome.runtime.lastError.message } : res));
      });
      
      const content = !result ? "No response received." : result.error ? `Error: ${result.error}` : (result.response?.trim() || "[Empty response]");
      messages.push({ role: "assistant", content }); await saveHistory(p);
      
      if (!panelOpen) { unreadCount++; badge.textContent = unreadCount > 9 ? "9+" : unreadCount; badge.classList.add("show"); }
      
      // Auto-untoggle New Chat so the next message stays in this fresh chat
      if (isNewChat) {
        newChatBtn.classList.remove("active");
      }

    } catch (err) { 
      messages.push({ role: "assistant", content: `Error: ${err.message}` }); await saveHistory(p); 
    } finally {
      if (loadingEl?.parentNode) loadingEl.parentNode.removeChild(loadingEl); loadingEl = null;
      renderAll(); isBusy = false; sendBtn.disabled = false; clearAttachedImage();
    }
  }

  provider.addEventListener("change", () => {
    if (isContextValid()) { chrome.storage.local.set({ defaultProvider: provider.value }); loadHistory(provider.value); }
  });

  input.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items; if (!items) return;
    for (const item of items) {
      if (item.type?.startsWith("image/")) {
        e.preventDefault(); const file = item.getAsFile();
        if (!file) continue; const reader = new FileReader();
        reader.onload = () => setAttachedImage(reader.result, "paste"); reader.readAsDataURL(file);
        return;
      }
    }
  });

  attachThumb.addEventListener("click", () => { if (attachedImage) { lightboxImg.src = attachedImage; lightbox.classList.add("show"); } });
  attachRemove.addEventListener("click", (e) => { e.stopPropagation(); clearAttachedImage(); });
  lightboxClose.addEventListener("click", () => { lightbox.classList.remove("show"); lightboxImg.src = ""; });
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) { lightbox.classList.remove("show"); lightboxImg.src = ""; } });
  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } });

  (async () => {
    if (!isContextValid()) return;
    try {
      const data = await chrome.storage.local.get(["hubBtnLeft", "hubBtnBottom", "defaultProvider", "hubPanelOpen", "hubThemeLight"]);
      if (data.hubBtnLeft !== undefined) btnLeft = data.hubBtnLeft;
      if (data.hubBtnBottom !== undefined) btnBottom = data.hubBtnBottom;
      hubBtn.style.left = `${btnLeft}px`; hubBtn.style.bottom = `${btnBottom}px`;
      repositionPanel();

      const p = data.defaultProvider || "chatgpt";
      provider.value = p; await loadHistory(p);
      applyTheme(data.hubThemeLight === true);
      if (data.hubPanelOpen) openPanel();
    } catch(e) {}
  })();
})();