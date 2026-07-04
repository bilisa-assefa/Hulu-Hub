/**
 * Hulu Hub — AI Provider Content Script
 * Injected ONLY into chatgpt.com, claude.ai, gemini.google.com
 *
 * Handles prompt injection, submission, and response retrieval.
 * Uses MutationObserver (never throttled, even in background windows)
 * for all response detection.
 */

"use strict";

if (!window.__HULU_HUB_INJECTED) {
  window.__HULU_HUB_INJECTED = true;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const toCSS = s  => Array.isArray(s) ? s.join(", ") : s;

  // ── System instruction ────────────────────────────────────────────────────
  const SYSTEM_INSTRUCTION =
    "[IMPORTANT FORMATTING RULES — follow for every reply: " +
    "1. Plain text only. No markdown tables, no HTML, no embedded images, videos, or graphs. " +
    "2. Write links as full raw URLs (e.g. https://example.com). " +
    "3. Bullet points as simple dashes. " +
    "4. These rules override all other formatting instructions.]\n\n";

  // ── Provider configs ──────────────────────────────────────────────────────

  const ChatGPT = {
    name: "chatgpt",
    selectors: {
      input:            "#prompt-textarea",
      sendButton:       ['button[data-testid="send-button"]', 'button[aria-label="Send prompt"]'],
      stopButton:       ['button[data-testid="stop-button"]', 'button[aria-label="Stop"]', 'button[aria-label="Stop generating"]'],
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
      input:            ['div[contenteditable="true"].ProseMirror', '[contenteditable="true"]'],
      sendButton:       ['button[aria-label="Send Message"]', 'button[aria-label="Send message"]'],
      stopButton:       ['button[aria-label="Stop"]', 'button[aria-label="Stop Response"]', 'button[aria-label*="Stop" i]'],
      assistantMessage: ['[data-is-streaming]', 'div[data-testid="assistant-message"]', '.font-claude-message'],
    },
    extractText(el) {
      if (!el) return "";
      const container = el.querySelector('[class*="prose"]') || el;
      return (container.innerText || container.textContent || "").replace(/[▋●■]$/, "").trim();
    },
    isNodeStreaming(node) {
      return node ? node.getAttribute("data-is-streaming") === "true" : false;
    },
  };

  const Gemini = {
    name: "gemini",
    selectors: {
      input:            ['rich-textarea div[contenteditable="true"]', 'div[contenteditable="true"]'],
      sendButton:       ['button[aria-label="Send message"]', 'button[aria-label="Send Message"]'],
      stopButton:       ['button[aria-label="Stop response"]', 'button[aria-label*="Stop" i]'],
      assistantMessage: ["model-response", ".response-content", ".model-response-text"],
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

  // ── Streaming check ───────────────────────────────────────────────────────

  function isStreaming(provider, node) {
    if (provider.isNodeStreaming(node)) return true;
    const stops = Array.isArray(provider.selectors.stopButton)
      ? provider.selectors.stopButton : [provider.selectors.stopButton];
    for (const s of stops) if (document.querySelector(s)) return true;
    if (provider.name === "gemini" && document.querySelector("mat-progress-bar")) return true;
    return false;
  }

  // ── Element finder ────────────────────────────────────────────────────────

  async function findElement(sel, ms = 10000) {
    const list = Array.isArray(sel) ? sel : [sel];
    const end  = Date.now() + ms;
    while (Date.now() < end) {
      for (const s of list) {
        const el = document.querySelector(s);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 || r.height > 0 || el.tagName === "TEXTAREA" || el.isContentEditable)
            return el;
        }
      }
      await sleep(200);
    }
    throw new Error(`[HuluHub] Not found: ${toCSS(sel)}`);
  }

  // ── Text injection ────────────────────────────────────────────────────────

  async function injectText(el, text) {
    el.focus();
    await sleep(80);
    if (el.tagName === "TEXTAREA") {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      if (setter) setter.call(el, text); else el.value = text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: text }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      document.execCommand("selectAll", false, null);
      document.execCommand("delete",    false, null);
      await sleep(30);
      el.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: text }));
      const ok = document.execCommand("insertText", false, text);
      if (!ok || !el.textContent.includes(text.slice(0, 20))) {
        el.innerText = text;
        el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      }
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await sleep(200);
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function clickSend(provider) {
    const btns = Array.isArray(provider.selectors.sendButton)
      ? provider.selectors.sendButton : [provider.selectors.sendButton];
    const end  = Date.now() + 5000;
    while (Date.now() < end) {
      for (const s of btns) {
        const btn = document.querySelector(s);
        if (btn && !btn.disabled && btn.getAttribute("aria-disabled") !== "true") {
          btn.click(); return;
        }
      }
      await sleep(100);
    }
    // Fallback: Enter on input
    const inp = document.querySelector(toCSS(provider.selectors.input));
    if (inp) { inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true, cancelable: true })); return; }
    throw new Error("[HuluHub] Could not submit.");
  }

  // ── Response monitor (MutationObserver) ───────────────────────────────────
  //
  // MutationObserver fires immediately on DOM changes — never throttled.
  // Phase 1: watch body for a response node to appear (Case A or Case B).
  //   maxSeen tracks peak node count — survives ChatGPT's placeholder swap.
  // Phase 2: watch the target node; 2500ms silence + not streaming = done.

  function waitForResponse(provider, startCount) {
    const msgCSS      = toCSS(provider.selectors.assistantMessage);
    const SILENCE_MS  = 2500;
    const CASE_B_WAIT = 1500;
    const TIMEOUT_MS  = 90_000;

    const nodesBefore    = document.querySelectorAll(msgCSS);
    const lastNodeBefore = nodesBefore.length > 0 ? nodesBefore[nodesBefore.length - 1] : null;
    const textBefore     = lastNodeBefore ? provider.extractText(lastNodeBefore) : "";
    let   maxSeen        = startCount;

    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      let settled = false, obs1 = null, obs2 = null, silenceT = null, hardT = null;

      function cleanup() {
        if (obs1)    { obs1.disconnect();    obs1    = null; }
        if (obs2)    { obs2.disconnect();    obs2    = null; }
        if (silenceT){ clearTimeout(silenceT); silenceT = null; }
        if (hardT)   { clearTimeout(hardT);    hardT   = null; }
      }
      function done(text)  { if (!settled) { settled=true; cleanup(); resolve(text); } }
      function fail(msg)   { if (!settled) { settled=true; cleanup(); reject(new Error(msg)); } }

      // Hard timeout
      hardT = setTimeout(() => {
        const nodes = document.querySelectorAll(msgCSS);
        const node  = nodes.length > 0 ? nodes[nodes.length-1] : lastNodeBefore;
        const text  = node ? provider.extractText(node) : "";
        text.length > 0 ? done(text) : fail("[HuluHub] Timed out.");
      }, TIMEOUT_MS);

      // Phase 2: silence debounce on target node
      function startPhase2(target) {
        if (obs1) { obs1.disconnect(); obs1 = null; }
        function arm() {
          if (silenceT) clearTimeout(silenceT);
          silenceT = setTimeout(() => {
            if (settled) return;
            const text = provider.extractText(target);
            if (!isStreaming(provider, target) && text.length > 0) done(text);
            // still streaming — next mutation will re-arm
          }, SILENCE_MS);
        }
        obs2 = new MutationObserver(() => { if (!settled) arm(); });
        obs2.observe(target, { childList: true, subtree: true, characterData: true, attributes: true });
        arm(); // arm immediately in case already done
      }

      // Phase 1: find the response node
      function check() {
        if (settled) return;
        const elapsed = Date.now() - t0;
        const nodes   = document.querySelectorAll(msgCSS);
        if (nodes.length > maxSeen) maxSeen = nodes.length;

        // Case A: new node appeared with actual text content
        if (maxSeen > startCount && nodes.length > 0) {
          const candidate = nodes[nodes.length - 1];
          if (provider.extractText(candidate).length > 0) {
            console.log("[HuluHub] Case A — new node with text");
            startPhase2(candidate); return;
          }
        }
        // Case B: existing last node mutated — after delay to avoid false triggers
        if (lastNodeBefore && elapsed > CASE_B_WAIT) {
          const cur = provider.extractText(lastNodeBefore);
          if (cur.length > 0 && cur !== textBefore) {
            console.log("[HuluHub] Case B — existing node mutated");
            startPhase2(lastNodeBefore); return;
          }
        }
      }

      obs1 = new MutationObserver(() => { if (!settled) check(); });
      obs1.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
      check(); // check immediately
    });
  }

  // ── Screenshot upload ─────────────────────────────────────────────────────

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

  // ── Orchestrator ──────────────────────────────────────────────────────────

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
    await sleep(350);
    await clickSend(provider);
    const response = await waitForResponse(provider, startCount);
    return { response };
  }

  // ── Message listener ──────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "PING") { sendResponse({ status: "OK" }); return; }
    if (msg.action === "SEND_PROMPT") {
      handleSendPrompt(msg).then(sendResponse).catch(err => {
        console.error("[HuluHub]", err);
        sendResponse({ error: err.message });
      });
      return true;
    }
  });

  console.log("[HuluHub] Provider script ready on", window.location.hostname);
}
