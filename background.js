/**
 * Hulu Hub — Background Service Worker v3.1
 *
 * Fix: removed hardcoded left:1920 from chrome.windows.create().
 * That value pushed the window fully off-screen on 1920-wide monitors,
 * causing Chrome to throw "Invalid value for bounds. Bounds must be at
 * least 50% within visible screen space."
 *
 * New approach:
 *   1. Create the window without left/top (Chrome picks a safe default).
 *   2. Immediately after creation, move it to the top-right corner using
 *      the actual screen dimensions reported by the sender's tab via
 *      chrome.scripting.executeScript — so we always use real screen size.
 *   3. The window is kept non-minimized so the tab inside it is always
 *      the active tab of its window → no Chrome timer throttling.
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

// ── Window / tab management ───────────────────────────────────────────────────
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

  // Create window without explicit position — Chrome picks a safe default.
  // This avoids the "bounds must be 50% within screen" error entirely.
  const win = await chrome.windows.create({
    url:    cfg.url,
    type:   "normal",
    width:  500,
    height: 740,
    state:  "normal",  // must NOT be "minimized" — minimized tabs get throttled
  });

  const tab = win.tabs[0];
  await chrome.storage.session.set({ [key]: { windowId: win.id, tabId: tab.id } });

  // Now reposition to top-right using actual screen size (never causes bounds error
  // because we compute the left value to guarantee the window is fully on-screen)
  try {
    const { w } = await getScreenSize(senderTabId);
    const winWidth = 500;
    const safeLeft = Math.max(0, w - winWidth - 10); // 10px margin from right edge
    await chrome.windows.update(win.id, { left: safeLeft, top: 0 });
  } catch { /* repositioning is cosmetic — ignore errors */ }

  console.log(`[HuluHub BG] Created window ${win.id} tab ${tab.id} for ${provider}`);
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

// ── Main handler ──────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== "SEND_TO_PROVIDER") return false;

  (async () => {
    try {
      const senderTabId = sender.tab?.id;
      const imageData   = message.attachScreenshot && senderTabId
        ? await captureScreenshot(senderTabId) : null;

      const tab = await getProviderTab(message.provider, senderTabId);
      await waitForTabLoad(tab.id);
      await waitForContentScript(tab.id);

      chrome.tabs.sendMessage(
        tab.id,
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



chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_HUB_PANEL" }).catch(() => {
     
    });
  }
});
