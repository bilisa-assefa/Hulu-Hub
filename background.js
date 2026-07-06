/**
 * Hulu Hub — Background Service Worker v3.7 (Instant Bottom-Right Workspace Fix)
 */

"use strict";

const PROVIDERS = {
  chatgpt: { url: "https://chatgpt.com/",          origin: "https://chatgpt.com"       },
  claude:  { url: "https://claude.ai/new",          origin: "https://claude.ai"         },
  gemini:  { url: "https://gemini.google.com/app", origin: "https://gemini.google.com" },
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getProviderTab(provider) {
  const cfg = PROVIDERS[provider];
  const key = `win_${provider}`;
  const stored = await chrome.storage.session.get(key);
  const saved  = stored[key];

  // Fallback safe monitor sizing coordinates
  const screenW = 1920;
  const screenH = 1080;
  const winLeft = Math.max(0, screenW - 160);
  const winTop = Math.max(0, screenH - 160);

  if (saved) {
    try {
      const win = await chrome.windows.get(saved.windowId, { populate: true });
      const tab = win.tabs.find(t => t.id === saved.tabId);
      if (tab && tab.url && tab.url.startsWith(cfg.origin)) {
        // Pop back to active visibility bounds inside the bottom right corner
        await chrome.windows.update(saved.windowId, { left: winLeft, top: winTop, state: "normal", focused: true });
        return tab;
      }
    } catch { /* closed, recreate */ }
  }

  // Create popup directly at the absolute bottom right corner
  const win = await chrome.windows.create({
    url:     cfg.url,
    type:    "popup", 
    width:   120,
    height:  120,
    left:    winLeft,
    top:     winTop,
    focused: true, 
  });

  const tab = win.tabs[0];
  await chrome.storage.session.set({ [key]: { windowId: win.id, tabId: tab.id } });
  return tab;
}

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
    } catch { /* not ready */ }
    await sleep(300);
  }
  throw new Error("Provider page took too long to load.");
}

async function captureScreenshot(senderTabId) {
  try {
    const tab = await chrome.tabs.get(senderTabId);
    return await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  } catch (e) {
    return null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== "SEND_TO_PROVIDER") return false;

  (async () => {
    let targetWindowId = null;
    try {
      const senderTabId = sender.tab?.id;
      const imageData   = message.attachScreenshot && senderTabId
        ? await captureScreenshot(senderTabId) : null;

      const providerTab = await getProviderTab(message.provider);
      targetWindowId = providerTab.windowId;

      await waitForTabLoad(providerTab.id);
      await waitForContentScript(providerTab.id);

      await sleep(200); 

      chrome.tabs.sendMessage(
        providerTab.id,
        { action: "SEND_PROMPT", provider: message.provider, prompt: message.prompt, imageData },
        response => {
          // IMMEDIATE DISMISSAL: Move window offscreen immediately without any artificial delay blocks
          if (targetWindowId) {
            chrome.windows.update(targetWindowId, { left: 9999, top: 9999, focused: false }).catch(() => {});
          }

          if (chrome.runtime.lastError) {
            sendResponse({ error: "Lost connection to provider tab. Please try again." });
          } else {
            sendResponse(response);
          }
        }
      );
    } catch (err) {
      console.error("[HuluHub BG]", err);
      sendResponse({ error: err.message });
      if (targetWindowId) {
        chrome.windows.update(targetWindowId, { left: 9999, top: 9999, focused: false }).catch(() => {});
      }
    }
  })();

  return true;
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_HUB_PANEL" }).catch(() => {});
  }
});
