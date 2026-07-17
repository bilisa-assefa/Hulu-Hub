/**
 * Hulu Hub — Background Service Worker v4.2
 */

"use strict";

const PROVIDERS = {
  chatgpt: { url: "https://chatgpt.com/",          origin: "https://chatgpt.com"       },
  claude:  { url: "https://claude.ai/new",         origin: "https://claude.ai"         },
  gemini:  { url: "https://gemini.google.com/app", origin: "https://gemini.google.com" },
};

const WIN_WIDTH  = 120;
const WIN_HEIGHT = 120;
const MARGIN     = 12;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getBottomRightPosition(senderTabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: senderTabId },
      func: () => ({ w: window.screen.availWidth, h: window.screen.availHeight }),
    });
    const { w, h } = results?.[0]?.result || { w: 1280, h: 800 };
    return {
      left: Math.max(0, w - WIN_WIDTH  - MARGIN),
      top:  Math.max(0, h - WIN_HEIGHT - MARGIN),
    };
  } catch {
    return { left: 0, top: 0 };
  }
}

async function getProviderTab(provider, senderTabId) {
  const cfg = PROVIDERS[provider];
  const key = `win_${provider}`;
  const stored = await chrome.storage.session.get(key);
  const saved  = stored[key];

  if (saved) {
    try {
      const win = await chrome.windows.get(saved.windowId, { populate: true });
      const tab = win.tabs.find(t => t.id === saved.tabId);
      if (tab && tab.url && tab.url.startsWith(cfg.origin)) {
        await chrome.windows.update(saved.windowId, { state: "normal", focused: true });
        return tab;
      }
    } catch { }
  }

  const pos = await getBottomRightPosition(senderTabId);

  const win = await chrome.windows.create({
    url:     cfg.url,
    type:    "popup",
    width:   WIN_WIDTH,
    height:  WIN_HEIGHT,
    left:    pos.left,
    top:     pos.top,
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
    } catch { }
    await sleep(300);
  }
  throw new Error("Provider page took too long to load.");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ROBUST CLEAR WINDOWS FIX
  if (message.action === "CLEAR_WINDOWS") {
    (async () => {
      const keys = await chrome.storage.session.get(null);
      for (const key of Object.keys(keys)) {
        if (key.startsWith("win_")) {
          const data = keys[key];
          if (data && data.windowId) {
            try {
              await chrome.windows.remove(data.windowId);
            } catch (e) {
              // Ignore errors if the window was already closed manually
            }
          }
          await chrome.storage.session.remove(key);
        }
      }
      sendResponse({ status: "ok" });
    })();
    return true;
  }

  if (message.action === "SEND_TO_PROVIDER") {
    (async () => {
      let targetWindowId = null;
      try {
        const senderTabId    = sender.tab?.id;
        const senderWindowId = sender.tab?.windowId;
        const imageData = message.imageDataUrl || null;

        // NEW CHAT LOGIC: If flag is true, destroy the existing window for this provider first
        if (message.newChat) {
          const key = `win_${message.provider}`;
          const stored = await chrome.storage.session.get(key);
          if (stored[key] && stored[key].windowId) {
            try {
              await chrome.windows.remove(stored[key].windowId);
            } catch(e) {}
          }
          await chrome.storage.session.remove(key);
        }

        const providerTab = await getProviderTab(message.provider, senderTabId);
        targetWindowId = providerTab.windowId;

        await chrome.windows.update(targetWindowId, { focused: true }).catch(() => {});
        await waitForTabLoad(providerTab.id);
        await waitForContentScript(providerTab.id);
        await sleep(200);

        chrome.tabs.sendMessage(
          providerTab.id,
          { action: "SEND_PROMPT", provider: message.provider, prompt: message.prompt, imageData },
          response => {
            if (senderWindowId) {
              chrome.windows.update(senderWindowId, { focused: true }).catch(() => {});
            }
            if (chrome.runtime.lastError) {
              sendResponse({ error: "Lost connection to provider tab. Please try again." });
            } else {
              sendResponse(response);
            }
          }
        );
      } catch (err) {
        sendResponse({ error: err.message });
        if (sender?.tab?.windowId) {
          chrome.windows.update(sender.tab.windowId, { focused: true }).catch(() => {});
        }
      }
    })();
    return true;
  }
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_HUB_PANEL" }).catch(() => {});
  }
});