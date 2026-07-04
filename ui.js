/**
 * Hulu Hub — Floating UI v3.2 (Color Matched)
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
      cursor: pointer;
      pointer-events: auto;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
      background: none;
      z-index: 2147483647;
      transition: transform 0.2s cubic-bezier(.34,1.56,.64,1);
      filter: drop-shadow(0 4px 12px rgba(77,93,255,0.45));
    }
    #hub-btn:hover  { transform: scale(1.1);  }
    #hub-btn:active { transform: scale(0.95); }
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
      background: rgba(11, 18, 32, 0.85);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: 0 24px 64px rgba(0,0,0,0.3), 0 4px 16px rgba(77,93,255,0.15);
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

    /* MATCHED BRAND COLOR GRADIENT */
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
    .hub-logo-sm { width: 28px; height: 28px; border-radius: 8px; background: rgba(11,18,32,0.3); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .hub-logo-sm svg { width: 18px; height: 18px; }
    .hub-header h3 { font-size: 15px; font-weight: 600; color: #0B1220; letter-spacing: -0.01em; }
    .hub-provider-wrap { position: relative; }
    #hub-provider { appearance: none; -webkit-appearance: none; padding: 5px 26px 5px 10px; border-radius: 8px; border: 1px solid rgba(11,18,32,0.2); font-size: 12px; font-weight: 600; background: rgba(255,255,255,0.25); color: #0B1220; cursor: pointer; outline: none; font-family: inherit; }
    #hub-provider option { background: #4D5DFF; color: #fff; }
    .hub-provider-arrow { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #0B1220; font-size: 10px; }
    #hub-close-btn { width: 28px; height: 28px; border-radius: 8px; border: none; background: rgba(11,18,32,0.15); color: #0B1220; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; transition: background 0.15s; font-family: inherit; }
    #hub-close-btn:hover { background: rgba(11,18,32,0.3); }

    #hub-history { flex: 1; overflow-y: auto; padding: 16px 14px; display: flex; flex-direction: column; gap: 10px; scroll-behavior: smooth; }
    #hub-history::-webkit-scrollbar { width: 4px; }
    #hub-history::-webkit-scrollbar-track { background: transparent; }
    #hub-history::-webkit-scrollbar-thumb { background: rgba(46,242,196,0.2); border-radius: 4px; }

    .hub-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; opacity: 0.45; pointer-events: none; user-select: none; }
    .hub-empty-icon { font-size: 32px; color: #2EF2C4; }
    .hub-empty-text { font-size: 13px; color: #2EF2C4; font-weight: 500; }

    .hub-msg { max-width: 84%; padding: 10px 14px; border-radius: 16px; font-size: 13.5px; line-height: 1.6; word-wrap: break-word; white-space: pre-wrap; animation: bubbleIn 0.18s ease; }
    @keyframes bubbleIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    
    /* GRADIENT USER BUBBLE */
    .hub-msg.user { 
      background: linear-gradient(135deg, #2EF2C4 0%, #4D5DFF 100%); 
      color: #0B1220; 
      align-self: flex-end; 
      border-bottom-right-radius: 4px; 
      box-shadow: 0 2px 12px rgba(77,93,255,0.25); 
      font-weight: 500;
    }
    .hub-msg.assistant { background: rgba(255,255,255,0.08); color: #f3f4f6; align-self: flex-start; border-bottom-left-radius: 4px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
    .hub-msg.loading { background: rgba(46,242,196,0.1); border: 1px solid rgba(46,242,196,0.2); color: #2EF2C4; font-style: italic; font-size: 13px; align-self: flex-start; border-bottom-left-radius: 4px; animation: pulse 1.6s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

    a.hub-link { color: #2EF2C4; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; word-break: break-all; font-weight: 500; }
    a.hub-link:hover { color: #4D5DFF; }

    .hub-input-area { padding: 12px 14px; background: rgba(11,18,32,0.9); border-top: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; display: flex; flex-direction: column; gap: 9px; }
    #hub-input { width: 100%; padding: 10px 12px; border: 1.5px solid rgba(77,93,255,0.3); border-radius: 12px; resize: none; font-family: inherit; font-size: 13.5px; line-height: 1.5; outline: none; height: 64px; background: rgba(255,255,255,0.05); color: #fff; transition: border-color 0.15s, box-shadow 0.15s; }
    #hub-input::placeholder { color: #6b7280; }
    #hub-input:focus { border-color: #2EF2C4; box-shadow: 0 0 0 3px rgba(46,242,196,0.15); }
    #hub-input:disabled { background: rgba(0,0,0,0.3); color: #666; }

    .hub-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    #hub-ss-btn { display: flex; align-items: center; gap: 5px; padding: 7px 12px; border-radius: 9px; border: 1.5px solid rgba(46,242,196,0.3); background: transparent; color: #2EF2C4; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all 0.15s; }
    #hub-ss-btn:hover { background: rgba(46,242,196,0.1); border-color: #2EF2C4; }
    #hub-ss-btn.active { background: rgba(46,242,196,0.2); border-color: #2EF2C4; color: #fff; }

    /* GRADIENT SEND BUTTON */
    #hub-send-btn { 
      padding: 7px 20px; 
      border-radius: 9px; 
      border: none; 
      background: linear-gradient(135deg, #2EF2C4 0%, #4D5DFF 100%); 
      color: #0B1220; 
      font-size: 13px; 
      font-weight: 600; 
      cursor: pointer; 
      font-family: inherit; 
      transition: opacity 0.15s, transform 0.1s; 
      box-shadow: 0 2px 8px rgba(77,93,255,0.3); 
      letter-spacing: 0.01em; 
    }
    #hub-send-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
    #hub-send-btn:active:not(:disabled){ transform: translateY(0); }
    #hub-send-btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
              <rect x="10" y="16" width="4" height="20" rx="1.5" fill="#0B1220"/>
              <rect x="10" y="24" width="10" height="4"  rx="1.5" fill="#0B1220"/>
              <rect x="16" y="16" width="4" height="20" rx="1.5" fill="#0B1220"/>
              <rect x="22" y="16" width="4" height="20" rx="1.5" fill="#0B1220"/>
              <rect x="22" y="24" width="10" height="4"  rx="1.5" fill="#0B1220"/>
              <rect x="28" y="16" width="4" height="20" rx="1.5" fill="#0B1220"/>
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
        <button id="hub-close-btn" title="Close">✕</button>
      </div>
      <div id="hub-history">
        <div class="hub-empty">
          <div class="hub-empty-icon">✦</div>
          <div class="hub-empty-text">Start a conversation</div>
        </div>
      </div>
      <div class="hub-input-area">
        <textarea id="hub-input" placeholder="Ask anything… (Enter to send, Shift+Enter for new line)"></textarea>
        <div class="hub-actions">
          <button id="hub-ss-btn">📷 Screenshot</button>
          <button id="hub-send-btn">Send →</button>
        </div>
      </div>
    </div>
  `;
  shadow.appendChild(wrapper);

  const hubBtn   = shadow.getElementById("hub-btn");
  const badge    = shadow.getElementById("hub-badge");
  const panel    = shadow.getElementById("hub-panel");
  const history  = shadow.getElementById("hub-history");
  const input    = shadow.getElementById("hub-input");
  const sendBtn  = shadow.getElementById("hub-send-btn");
  const ssBtn    = shadow.getElementById("hub-ss-btn");
  const provider = shadow.getElementById("hub-provider");
  const closeBtn = shadow.getElementById("hub-close-btn");

  let panelOpen        = false;
  let screenshotActive = false;
  let messages         = [];
  let loadingEl        = null;
  let isBusy           = false;
  let unreadCount      = 0;

  function openPanel() {
    panelOpen = true;
    panel.classList.add("visible");
    hubBtn.classList.add("open");
    unreadCount = 0;
    badge.classList.remove("show");
    badge.textContent = "";
    setTimeout(() => input.focus(), 220);
    scrollBottom();
  }
  function closePanel() {
    panelOpen = false;
    panel.classList.remove("visible");
    hubBtn.classList.remove("open");
  }
  function togglePanel() {
    if (panelOpen) closePanel();
    else openPanel();
  }

  hubBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePanel();
  });

  closeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closePanel();
  });

  shadow.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "TOGGLE_HUB_PANEL") {
      togglePanel();
    }
  });

  async function loadHistory(p) {
    const data = await chrome.storage.local.get(`history_${p}`);
    messages   = data[`history_${p}`] || [];
    renderAll();
  }
  async function saveHistory(p) {
    await chrome.storage.local.set({ [`history_${p}`]: messages });
  }

  function escapeHTML(s) {
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function linkify(text) {
    return escapeHTML(text).replace(/(https?:\/\/[^\s<>"')\]]+)/g, '<a class="hub-link" data-url="$1">$1</a>');
  }

  function renderAll() {
    history.innerHTML = "";
    if (messages.length === 0) {
      history.innerHTML = `
        <div class="hub-empty">
          <div class="hub-empty-icon">✦</div>
          <div class="hub-empty-text">Start a conversation</div>
        </div>`;
      return;
    }
    for (const m of messages) appendBubble(m.role, m.content);
    scrollBottom();
  }
  function appendBubble(role, content) {
    const div       = document.createElement("div");
    div.className   = `hub-msg ${role}`;
    if (role === "assistant") div.innerHTML = linkify(content);
    else                      div.textContent = content;
    history.appendChild(div);
    return div;
  }
  function scrollBottom() {
    requestAnimationFrame(() => { history.scrollTop = history.scrollHeight; });
  }

  history.addEventListener("click", e => {
    const a = e.target.closest(".hub-link");
    if (!a) return;
    e.preventDefault();
    chrome.tabs.create({ url: a.dataset.url, active: true });
  });

  function showLoading() {
    removeLoading();
    loadingEl           = document.createElement("div");
    loadingEl.className = "hub-msg loading";
    loadingEl.textContent = "Thinking…";
    history.appendChild(loadingEl);
    scrollBottom();
  }
  function removeLoading() {
    if (loadingEl?.parentNode) loadingEl.parentNode.removeChild(loadingEl);
    loadingEl = null;
  }

  function setLocked(v) {
    isBusy = v;
    sendBtn.disabled  = v;
    input.disabled    = v;
    provider.disabled = v;
  }

  async function handleSend() {
    if (isBusy) return;
    const text = input.value.trim();
    if (!text) return;
    const p = provider.value;

    messages.push({ role: "user", content: text + (screenshotActive ? "\n[Screenshot attached]" : "") });
    renderAll();
    await saveHistory(p);
    input.value = "";
    setLocked(true);
    showLoading();

    try {
      const result = await new Promise(resolve => {
        chrome.runtime.sendMessage(
          { action: "SEND_TO_PROVIDER", provider: p, prompt: text, attachScreenshot: screenshotActive },
          res => resolve(chrome.runtime.lastError ? { error: chrome.runtime.lastError.message } : res)
        );
      });

      const content =
        !result                             ? "No response received. Please try again."   :
        result.error                        ? `Error: ${result.error}`                    :
        typeof result.response === "string" ? (result.response.trim() || "[Empty response]") :
                                              "Unexpected response. Please try again.";

      messages.push({ role: "assistant", content });
      await saveHistory(p);

      if (!panelOpen) {
        unreadCount++;
        badge.textContent = unreadCount > 9 ? "9+" : unreadCount;
        badge.classList.add("show");
      }
    } catch (err) {
      messages.push({ role: "assistant", content: `Error: ${err.message}` });
      await saveHistory(p);
    } finally {
      removeLoading();
      renderAll();
      setLocked(false);
      screenshotActive = false;
      ssBtn.classList.remove("active");
    }
  }

  provider.addEventListener("change", () => {
    chrome.storage.local.set({ defaultProvider: provider.value });
    loadHistory(provider.value);
  });
  ssBtn.addEventListener("click", () => {
    screenshotActive = !screenshotActive;
    ssBtn.classList.toggle("active", screenshotActive);
  });
  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });

  (async () => {
    const stored = await chrome.storage.local.get("defaultProvider");
    const p      = stored.defaultProvider || "chatgpt";
    provider.value = p;
    await loadHistory(p);
  })();

  console.log("[HuluHub] UI ready on", window.location.hostname);
})();
