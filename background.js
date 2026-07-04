/**
 * Hulu Hub — Background Service Worker v3.1 (Stealth Mode)
 *
 * Fixed: Uses a 'popup' window type with 'focused: false' to bypass
 * aggressive background throttling without stealing the user's focus or flashing.
 */

"use strict";

const PROVIDERS = {
  chatgpt: { url: "https://chatgpt.com/",          origin: "https://chatgpt.com"       },
  claude:  { url: "https://claude.ai/new",          origin: "https://claude.ai"         },
  gemini:  { url: "https://gemini.google.com/app", origin: "https://gemini.google.com" },
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Get real screen dimensions from the sender tab ────────────────────────────
async function getScreenSize(senderTabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: senderTabId },
      func:   () => ({ w: window.screen.availWidth, h: window.screen.availHeight }),
    });
    if (results && results[0] && results[0].result) return results[0].result;
  } catch { /* fallback below */ }
  return { w: 1280, h: 800 }; // safe fallback
}

// ── Window / tab management (Stealth Mode) ───────────────────────────────────
async function getProviderTab(provider, senderTabId) {
  const cfg = PROVIDERS[provider];
  const key = `win_${provider}`;
  const stored = await chrome.storage.session.get(key);
  const saved  = stored[key];

  if (saved) {
    try {
      const tab = await chrome.tabs.get(saved.tabId);
      if (tab.url && tab.url.startsWith(cfg.origin)) {
        console.log(`[HuluHub BG] Reusing window for ${provider}`);
        return tab;
      }
    } catch { /* closed */ }
  }

  // Get dimensions to safely place it near the right edge
  let safeLeft = 0;
  try {
    const { w } = await getScreenSize(senderTabId);
    safeLeft = Math.max(0, w - 510);
  } catch { safeLeft = 800; }

  // Create the window as a 'popup' type and pass focused: false
  // Popups are lightweight and 'focused: false' prevents the window from stealing focus.
  const win = await chrome.windows.create({
    url:    cfg.url,
    type:   "popup", 
    width:  500,
    height: 740,
    left:   safeLeft,
    top:    0,
    focused: false, // 🤫 Do not steal the user's active focus on creation
  });

  const tab = win.tabs[0];
  await chrome.storage.session.set({ [key]: { windowId: win.id, tabId: tab.id } });

  console.log(`[HuluHub BG] Created stealth window ${win.id} for ${provider}`);
  return tab;
}

// ── Wait for page load ────────────────────────────────────────────────────────
function waitForTabLoad(tabId) {
  return new Promise(resolve => {
    chrome.tabs.get(tabId, tab => {
      if (!chrome.runtime.lastError && tab && tab.status === "complete") {
        resolve(); return;
      }
      function listener(id, info) {
        if (id === tabId && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

// ── Wait for content script ───────────────────────────────────────────────────
async function waitForContentScript(tabId) {
  for (let i = 0; i < 60; i++) {
    try {
      const reply = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { action: "PING" }, res => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(res);
        });
      });
      if (reply?.status === "OK") return;
    } catch { /* not ready yet */ }
    await sleep(500);
  }
  throw new Error("Provider page took too long to load. Please try again.");
}

// ── Screenshot capture ────────────────────────────────────────────────────────
async function captureScreenshot(senderTabId) {
  try {
    const tab = await chrome.tabs.get(senderTabId);
    return await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  } catch (e) {
    console.warn("[HuluHub BG] Screenshot failed:", e.message);
    return null;
  }
}

// ── Main handler (Stealth Throttling Bypass) ──────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== "SEND_TO_PROVIDER") return false;

  (async () => {
    try {
      const senderTabId = sender.tab?.id;
      const imageData   = message.attachScreenshot && senderTabId
        ? await captureScreenshot(senderTabId) : null;

      const providerTab = await getProviderTab(message.provider, senderTabId);
      
      await waitForTabLoad(providerTab.id);
      await waitForContentScript(providerTab.id);

      // Sent in the background. Because it is a popup window running with active execution,
      // it handles automation script requests seamlessly.
      chrome.tabs.sendMessage(
        providerTab.id,
        { action: "SEND_PROMPT", provider: message.provider,
          prompt: message.prompt, imageData },
        response => {
          if (chrome.runtime.lastError)
            sendResponse({ error: "Lost connection to provider tab. Please try again." });
          else
            sendResponse(response);
        }
      );
    } catch (err) {
      console.error("[HuluHub BG]", err);
      sendResponse({ error: err.message });
    }
  })();

  return true;
});

// ── Toolbar Icon Click Listener ──────────────────────────────────────────────
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_HUB_PANEL" }).catch(() => {
      /* Ignore pages where content scripts can't run */
    });
  }
});
