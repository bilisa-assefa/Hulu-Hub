/**
 * Hulu Hub — AI Provider Content Script v3.5 (Selector Fixes)
 */

"use strict";

if (!window.__HULU_HUB_INJECTED) {
  window.__HULU_HUB_INJECTED = true;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const toCSS = s  => Array.isArray(s) ? s.join(", ") : s;

  const SYSTEM_INSTRUCTION =
    "[IMPORTANT FORMATTING RULES — follow for every reply: " +
    "1. Plain text only. No markdown tables, no HTML, no embedded images, videos, or graphs. " +
    "2. Write links as full raw URLs (e.g. https://example.com). " +
    "3. Bullet points as simple dashes. " +
    "4. These rules override all other formatting instructions.]\n\n";

  const ChatGPT = {
    name: "chatgpt",
    selectors: {
      input:            ["#prompt-textarea", "textarea", "[contenteditable='true']"],
      sendButton:       ['button[data-testid="send-button"]', 'button[aria-label="Send prompt"]', 'button.mb-1'],
      stopButton:       ['button[data-testid="stop-button"]', 'button[aria-label="Stop"]'],
      assistantMessage: 'div[data-message-author-role="assistant"]',
    },
    extractText(el) {
      if (!el) return "";
      const inner = el.querySelector(".markdown, [class*='prose'], .whitespace-pre-wrap") || el;
      return (inner.innerText || inner.textContent || "").trim();
    },
    isNodeStreaming() { return false; },
  };

  const Claude = {
    name: "claude",
    selectors: {
      input:            ['div[contenteditable="true"]', '.ProseMirror', '[role="textbox"]'],
      sendButton:       ['button[aria-label="Send Message"]', 'button[aria-label="Send message"]', 'button:has(svg path[d*="M"])'],
      stopButton:       ['button[aria-label="Stop"]', 'button[aria-label="Stop Response"]'],
      assistantMessage: ['div.font-claude-message', '[data-testid="assistant-message"]', '.font-user-message + div'],
    },
    extractText(el) {
      if (!el) return "";
      let container = el.querySelector('.grid-cols-1 .whitespace-pre-wrap') || el.querySelector('[class*="prose"]') || el;
      let raw = (container.innerText || container.textContent || "");
      return raw.replace(/[▋●■]$/, "").replace(/^Claude responded:\s*/i, "").trim();
    },
    isNodeStreaming(node) {
      return node ? node.hasAttribute("data-is-streaming") || !!document.querySelector('button[aria-label*="Stop"]') : false;
    },
  };

  const Gemini = {
    name: "gemini",
    selectors: {
      input:            ['rich-textarea div[contenteditable="true"]', 'div[contenteditable="true"]', 'textarea'],
      sendButton:       ['button[aria-label="Send message"]', 'button[aria-label="Send Message"]'],
      stopButton:       ['button[aria-label="Stop response"]'],
      assistantMessage: ["model-response", ".response-content"],
    },
    extractText(el) {
      if (!el) return "";
      if (el.shadowRoot) {
        const inner = el.shadowRoot.querySelector(".response-content, .markdown, p");
        if (inner) return (inner.innerText || inner.textContent || "").trim();
      }
      const inner = el.querySelector(".response-content, .markdown") || el;
      return (inner.innerText || inner.textContent || "").trim();
    },
    isNodeStreaming() { return false; },
  };

  function getProvider() {
    const h = window.location.hostname;
    if (h.includes("chatgpt.com"))       return ChatGPT;
    if (h.includes("claude.ai"))         return Claude;
    if (h.includes("gemini.google.com")) return Gemini;
    return null;
  }

  function isStreaming(provider, node) {
    if (provider.isNodeStreaming(node)) return true;
    const stops = Array.isArray(provider.selectors.stopButton) ? provider.selectors.stopButton : [provider.selectors.stopButton];
    for (const s of stops) if (document.querySelector(s)) return true;
    if (provider.name === "gemini" && document.querySelector("mat-progress-bar")) return true;
    return false;
  }

  async function findElement(sel, ms = 15000) {
    const list = Array.isArray(sel) ? sel : [sel];
    const end  = Date.now() + ms;
    while (Date.now() < end) {
      for (const s of list) {
        const el = document.querySelector(s);
        if (el) return el;
      }
      await sleep(250);
    }
    throw new Error(`[HuluHub] Not found: ${toCSS(sel)}`);
  }

  async function injectText(el, text) {
    el.focus();
    await sleep(150);
    if (el.tagName === "TEXTAREA") {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      if (setter) setter.call(el, text); else el.value = text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    } else {
      document.execCommand("selectAll", false, null);
      document.execCommand("delete",    false, null);
      await sleep(50);
      el.innerText = text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    }
    await sleep(200);
  }

  async function clickSend(provider) {
    const btns = Array.isArray(provider.selectors.sendButton) ? provider.selectors.sendButton : [provider.selectors.sendButton];
    for (let i = 0; i < 40; i++) {
      for (const s of btns) {
        const btn = document.querySelector(s);
        if (btn && !btn.disabled && btn.getAttribute("aria-disabled") !== "true") {
          btn.focus();
          btn.click(); 
          return;
        }
      }
      await sleep(150);
    }
    throw new Error("[HuluHub] Could not submit prompt.");
  }

  function waitForResponse(provider, startCount) {
    const msgCSS      = toCSS(provider.selectors.assistantMessage);
    const SILENCE_MS  = 1500; 
    const TIMEOUT_MS  = 120_000;

    const nodesBefore    = document.querySelectorAll(msgCSS);
    const lastNodeBefore = nodesBefore.length > 0 ? nodesBefore[nodesBefore.length - 1] : null;
    let maxSeen        = startCount;

    return new Promise((resolve, reject) => {
      let settled = false, obs1 = null, obs2 = null, silenceT = null, hardT = null;

      function cleanup() {
        if (obs1)    obs1.disconnect();
        if (obs2)    obs2.disconnect();
        if (silenceT) clearTimeout(silenceT);
        if (hardT)   clearTimeout(hardT);
      }
      function done(text)  { if (!settled) { settled=true; cleanup(); resolve(text); } }
      function fail(msg)   { if (!settled) { settled=true; cleanup(); reject(new Error(msg)); } }

      hardT = setTimeout(() => {
        const nodes = document.querySelectorAll(msgCSS);
        const node  = nodes.length > 0 ? nodes[nodes.length-1] : lastNodeBefore;
        const text  = node ? provider.extractText(node) : "";
        text.length > 0 ? done(text) : fail("[HuluHub] Timed out waiting for response.");
      }, TIMEOUT_MS);

      function startPhase2(target) {
        if (obs1) { obs1.disconnect(); obs1 = null; }
        function arm() {
          if (silenceT) clearTimeout(silenceT);
          silenceT = setTimeout(() => {
            if (settled) return;
            const text = provider.extractText(target);
            if (!isStreaming(provider, target) && text.length > 0) done(text);
          }, SILENCE_MS);
        }
        obs2 = new MutationObserver(() => { if (!settled) arm(); });
        obs2.observe(target, { childList: true, subtree: true, characterData: true, attributes: true });
        arm();
      }

      function check() {
        if (settled) return;
        const nodes   = document.querySelectorAll(msgCSS);
        if (nodes.length > maxSeen) maxSeen = nodes.length;

        if (nodes.length > startCount) {
          const candidate = nodes[nodes.length - 1];
          if (provider.extractText(candidate).length > 0) {
            startPhase2(candidate);
          }
        }
      }

      obs1 = new MutationObserver(() => { if (!settled) check(); });
      obs1.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
      check();
    });
  }

  async function uploadScreenshot(dataUrl) {
    const inputs = document.querySelectorAll('input[type="file"]');
    if (!inputs.length) return false;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "screenshot.png", { type: "image/png" });
      const dt   = new DataTransfer();
      dt.items.add(file);
      const fi = inputs[inputs.length - 1];
      fi.files = dt.files;
      fi.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    } catch { return false; }
  }

  async function handleSendPrompt({ prompt, imageData }) {
    const provider = getProvider();
    if (!provider) throw new Error("Unsupported provider.");

    let text = SYSTEM_INSTRUCTION + prompt;
    if (imageData) {
      const ok = await uploadScreenshot(imageData);
      if (ok) await sleep(1500);
      else text = `[Screenshot could not be attached]\n\n${text}`;
    }

    const msgCSS     = toCSS(provider.selectors.assistantMessage);
    const startCount = document.querySelectorAll(msgCSS).length;

    const inputEl = await findElement(provider.selectors.input);
    await injectText(inputEl, text);
    await sleep(250);
    await clickSend(provider);
    return { response: await waitForResponse(provider, startCount) };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "PING") { sendResponse({ status: "OK" }); return; }
    if (msg.action === "SEND_PROMPT") {
      handleSendPrompt(msg).then(sendResponse).catch(err => {
        sendResponse({ error: err.message });
      });
      return true;
    }
  });
}
