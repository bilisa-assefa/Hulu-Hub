/**
 * Hulu Hub — Background Service Worker v3.9
 *
 * ── Fixes in this version ──────────────────────────────────────────────────
 *
 * 1. Window invisible + slow retrieval (occlusion throttling)
 *    Root cause: the window was created with focused:false. On virtually
 *    every desktop OS, a window created unfocused opens BEHIND whichever
 *    window currently has OS focus — the user's main (usually maximized)
 *    browser window. A window fully covered by another window is treated
 *    by Chrome exactly like a minimized/background tab: its page visibility
 *    state becomes "hidden", throttling timers AND slowing the target
 *    page's own React/JS rendering. This is why the window was never seen
 *    and why retrieval was slow.
 *    Fix: the window is now explicitly focused/raised (a) at creation,
 *    (b) when reused for a later message, and (c) immediately before the
 *    prompt is sent — so it is never occluded during automation. Focus is
 *    returned to the user's original tab once the response is back.
 *
 * 2. Position — window now opens at the bottom-right corner, computed from
 *    the real screen size (via chrome.scripting.executeScript on the sender
 *    tab), so the earlier "Invalid value for bounds" error cannot recur.
 *
 * No other functionality changed: window size stays 120x120, window type
 * stays "popup", tab-reuse/session-storage logic is unchanged.
 */

"use strict";

const PROVIDERS = {
  chatgpt: { url: "https://chatgpt.com/",          origin: "https://chatgpt.com"       },
  claude:  { url: "https://claude.ai/new",          origin: "https://claude.ai"         },
  gemini:  { url: "https://gemini.google.com/app", origin: "https://gemini.google.com" },
};

const WIN_WIDTH  = 120;
const WIN_HEIGHT = 120;
const MARGIN     = 12;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Compute a safe bottom-right position using the sender tab's real screen size.
// Falls back to (0,0) on any failure — always within bounds, never errors.
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
        // Raise + focus so it is not occluded behind the main browser window
        await chrome.windows.update(saved.windowId, { state: "normal", focused: true });
        return tab;
      }
    } catch { /* closed — fall through to create a new one */ }
  }

  const pos = await getBottomRightPosition(senderTabId);

  const win = await chrome.windows.create({
    url:     cfg.url,
    type:    "popup",
    width:   WIN_WIDTH,
    height:  WIN_HEIGHT,
    left:    pos.left,
    top:     pos.top,
    focused: true, // must be raised/unoccluded — this is what prevents throttling
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

// Hide/show the floating widget in the sender tab so it never appears
// in captured screenshots. Fire-and-forget with errors swallowed — if the
// content script isn't present on that page (e.g. a chrome:// page), there's
// simply nothing to hide, which is fine.
async function hideWidget(tabId) {
  try { await chrome.tabs.sendMessage(tabId, { action: "HIDE_HUB_WIDGET" }); } catch {}
}
async function showWidget(tabId) {
  try { await chrome.tabs.sendMessage(tabId, { action: "SHOW_HUB_WIDGET" }); } catch {}
}

// Capture the sender tab's visible area, hiding our own floating widget
// first so it never shows up in the resulting image. The 120ms pause after
// hiding gives the browser time to actually repaint without the widget
// before the frame is captured — a DOM change alone doesn't guarantee the
// compositor has produced a new frame yet.
async function captureScreenshotHidingWidget(senderTabId) {
  try {
    const tab = await chrome.tabs.get(senderTabId);
    await hideWidget(senderTabId);
    await sleep(120);
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    await showWidget(senderTabId);
    return dataUrl;
  } catch (e) {
    await showWidget(senderTabId); // always restore visibility, even on failure
    console.warn("[HuluHub BG] Screenshot failed:", e.message);
    return null;
  }
}

// Screenshot capture is now a standalone action, triggered the moment the
// user clicks the screenshot button in the UI — not deferred until Send.
// This lets the UI show the user a preview of what was captured immediately.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== "CAPTURE_SCREENSHOT") return false;

  (async () => {
    const senderTabId = sender.tab?.id;
    if (!senderTabId) { sendResponse({ error: "No active tab." }); return; }
    const dataUrl = await captureScreenshotHidingWidget(senderTabId);
    dataUrl ? sendResponse({ dataUrl }) : sendResponse({ error: "Screenshot capture failed." });
  })();

  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== "SEND_TO_PROVIDER") return false;

  (async () => {
    let targetWindowId = null;
    try {
      const senderTabId    = sender.tab?.id;
      const senderWindowId = sender.tab?.windowId;
      // Screenshot capture now happens on-demand when the button is clicked
      // (see the CAPTURE_SCREENSHOT listener above); pasted images already
      // arrive as data URLs from the UI. Either way, the image is simply
      // forwarded here — no capturing happens at send time anymore.
      const imageData = message.imageDataUrl || null;

      const providerTab = await getProviderTab(message.provider, senderTabId);
      targetWindowId = providerTab.windowId;

      // Belt-and-suspenders: re-raise right before automation starts,
      // guaranteeing the window is unoccluded for the entire operation.
      await chrome.windows.update(targetWindowId, { focused: true }).catch(() => {});

      await waitForTabLoad(providerTab.id);
      await waitForContentScript(providerTab.id);
      await sleep(200);

      chrome.tabs.sendMessage(
        providerTab.id,
        { action: "SEND_PROMPT", provider: message.provider, prompt: message.prompt, imageData },
        response => {
          // Response is back — return focus to the user's own tab/window.
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
      console.error("[HuluHub BG]", err);
      sendResponse({ error: err.message });
      if (sender?.tab?.windowId) {
        chrome.windows.update(sender.tab.windowId, { focused: true }).catch(() => {});
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
