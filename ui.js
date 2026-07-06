// --- INTERACTION FLOW HOOKS ---
  function openPanel() {
    panelOpen = true;
    repositionPanel();
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
    if (isDragging) return;
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

  // Safety checker for extension background updates
  function isContextValid() {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  }

  // Wrap listener registration safely
  try {
    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === "TOGGLE_HUB_PANEL") {
        togglePanel();
      }
    });
  } catch(e) {}

  async function loadHistory(p) {
    if (!isContextValid()) return;
    try {
      const data = await chrome.storage.local.get(`history_${p}`);
      messages   = data[`history_${p}`] || [];
      renderAll();
    } catch (e) {
      console.warn("[HuluHub] Could not load history. Context may be invalidated.");
    }
  }

  async function saveHistory(p) {
    if (!isContextValid()) return;
    try {
      await chrome.storage.local.set({ [`history_${p}`]: messages });
    } catch (e) {
      if (e.message.includes("Extension context invalidated")) {
        console.warn("[HuluHub] Extension updated in background. Cannot save history until page reload.");
      } else {
        console.error("[HuluHub] Storage Error:", e);
      }
    }
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
    if (isContextValid()) {
      chrome.tabs.create({ url: a.dataset.url, active: true });
    } else {
      window.open(a.dataset.url, "_blank");
    }
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
    if (!isContextValid()) {
      alert("Hulu Hub has updated in the background. Please refresh this page to continue chatting.");
      return;
    }
    
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
    if (!isContextValid()) {
      alert("Hulu Hub has updated in the background. Please refresh this page.");
      return;
    }
    try {
      chrome.storage.local.set({ defaultProvider: provider.value });
      loadHistory(provider.value);
    } catch(e) {
      console.warn("[HuluHub] Failed to switch provider:", e);
    }
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
    if (!isContextValid()) return;
    try {
      const stored = await chrome.storage.local.get("defaultProvider");
      const p      = stored.defaultProvider || "chatgpt";
      provider.value = p;
      await loadHistory(p);
    } catch(e) {}
  })();

  console.log("[HuluHub] UI ready on", window.location.hostname);
})();
