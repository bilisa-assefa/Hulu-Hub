/**
 * Hulu Hub — Background Service Worker v3.2
 */

"use strict";

const PROVIDERS = {
  chatgpt: { url: "https://chatgpt.com/",          origin: "https://chatgpt.com"       },
  claude:  { url: "https://claude.ai/new",          origin: "https://claude.ai"         },
  gemini:  { url: "https://gemini.google.com/app", origin: "https://gemini.google.com" },
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getScreenSize(senderTabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: senderTabId },
      func:   () => ({ w: window.screen.availWidth, h: window.screen.availHeight }),
    });
    if (results && results[0] && results[0].result) return results[0].result;
  } catch { /* fallback below */ }
  return { w: 1280, h: 800 };
}

async function getProviderTab(provider, senderTabId) {
  const cfg = PROVIDERS[provider];
  const key = `win_${provider}`;
  const stored = await chrome.storage.session.get(key);
  const saved  = stored[key];

  if (saved) {
    try {
      const tab = await chrome.tabs.get(saved.tabId);
      if (tab.url && tab.url.startsWith(cfg.origin)) {
        return tab;
      }
    } catch { /* closed */ }
  }

  let screenW = 1280;
  try {
    const size = await getScreenSize(senderTabId);
    screenW = size.w;
  } catch {}

  // Position it right at the absolute edge boundary line 
  // keeping it alive without disrupting focus flow hooks.
  const win = await chrome.windows.create({
    url:    cfg.url,
    type:   "popup", 
    width:  450,
    height: 700,
    left:   Math.max(0, screenW - 460),
    top:    40,
    focused: false, 
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
    } catch { /* not ready yet */ }
    await sleep(400);
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
    try {
      const senderTabId = sender.tab?.id;
      const imageData   = message.attachScreenshot && senderTabId
        ? await captureScreenshot(senderTabId) : null;

      const providerTab = await getProviderTab(message.provider, senderTabId);
      await waitForTabLoad(providerTab.id);
      await waitForContentScript(providerTab.id);

      chrome.tabs.sendMessage(
        providerTab.id,
        { action: "SEND_PROMPT", provider: message.provider, prompt: message.prompt, imageData },
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
    chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_HUB_PANEL" }).catch(() => {});
  }
});
