/**
 * Hulu Hub — Background Service Worker v3.5 (Delay Minimization Fix)
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
      const win = await chrome.windows.get(saved.windowId, { populate: true });
      const tab = win.tabs.find(t => t.id === saved.tabId);
      if (tab && tab.url && tab.url.startsWith(cfg.origin)) {
        await chrome.windows.update(saved.windowId, { state: "normal", focused: true });
        return tab;
      }
    } catch { /* closed, recreate */ }
  }

  let screenW = 1280, screenH = 800;
  try {
    const size = await getScreenSize(senderTabId);
    screenW = size.w;
    screenH = size.h;
  } catch {}

  const win = await chrome.windows.create({
    url:     cfg.url,
    type:    "popup", 
    width:   150,
    height:  150,
    left:    Math.max(0, screenW - 170),
    top:     Math.max(0, screenH - 170),
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
    let targetWindowId = null;
    try {
      const senderTabId = sender.tab?.id;
      const imageData   = message.attachScreenshot && senderTabId
        ? await captureScreenshot(senderTabId) : null;

      const providerTab = await getProviderTab(message.provider, senderTabId);
      targetWindowId = providerTab.windowId;

      await waitForTabLoad(providerTab.id);
      await waitForContentScript(providerTab.id);

      // Give window a short delay to focus completely
      await sleep(400); 

      chrome.tabs.sendMessage(
        providerTab.id,
        { action: "SEND_PROMPT", provider: message.provider, prompt: message.prompt, imageData },
        async (response) => {
          // Provide an execution window for content.js to finalize variables before hiding
          await sleep(1000); 
          if (targetWindowId) {
            chrome.windows.update(targetWindowId, { state: "minimized" }).catch(() => {});
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
        await sleep(500);
        chrome.windows.update(targetWindowId, { state: "minimized" }).catch(() => {});
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
