/**
 * Hulu Hub — Background Service Worker v3.2 (Auto-Close Fix)
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
    let createdWindowId = null;
    try {
      const senderTabId = sender.tab?.id;
      const imageData   = message.attachScreenshot && senderTabId
        ? await captureScreenshot(senderTabId) : null;

      const cfg = PROVIDERS[message.provider];
      let screenW = 1280;
      try {
        const size = await getScreenSize(senderTabId);
        screenW = size.w;
      } catch {}

      // Optimized small size so DOM elements render correctly but stay out of the way
      const win = await chrome.windows.create({
        url:     cfg.url,
        type:    "popup", 
        width:   380,
        height:  520,
        left:    Math.max(0, screenW - 390),
        top:     50,
        focused: true, // Must be true to prevent browser engine throttling
      });

      createdWindowId = win.id;
      const providerTab = win.tabs[0];

      await waitForTabLoad(providerTab.id);
      await waitForContentScript(providerTab.id);

      chrome.tabs.sendMessage(
        providerTab.id,
        { action: "SEND_PROMPT", provider: message.provider, prompt: message.prompt, imageData },
        response => {
          // Always clean up the temporary window when tab responds
          if (createdWindowId) {
            chrome.windows.remove(createdWindowId).catch(() => {});
            createdWindowId = null;
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
      
      // Cleanup window in case of setup failure
      if (createdWindowId) {
        chrome.windows.remove(createdWindowId).catch(() => {});
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
