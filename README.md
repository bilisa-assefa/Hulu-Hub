# Hulu Hub ✦

An elegant, multi-provider AI sidekick extension for your browser. Chat with **ChatGPT**, **Claude**, and **Gemini** simultaneously from any open tab using a modern, floating interface without requiring any expensive API keys.

---

## 🚀 Key Features

* **Zero API Keys Required:** Runs directly through web automation in a dedicated, hidden popup workspace.
* **Persistent Chat Context:** Smart automated session handling prevents the browser engine from throttling or freezing AI tasks (even on strict platforms like Claude).
* **Lag-Free Floating UI:** Highly responsive, interactive drawer panel powered by hardware-accelerated `requestAnimationFrame` animations.
* **Smart Drag & Drop:** Move the launcher icon freely to any part of your viewport; positioning auto-saves seamlessly across tab switches.
* **Ultra Dark Theme:** High-contrast pitch-black palette designed carefully for legibility and minimal eye strain.
* **Translucent Styling:** Cohesive, color-matched dropdown controls blending cleanly with your brand colors.

---

## 🛠️ Project Structure

```text
├── manifest.json       # Extension configurations & execution scope rules
├── background.js       # Core automation engine & background window coordinator
├── content.js          # DOM payload injector and runtime AI text scraper
├── ui.js               # Shadow-DOM floating interface, animations & dragging engine
└── ui.css              # Reset layout container properties


💻 Installation & Setup
Clone or Download this repository onto your machine.

Open your browser and navigate to the extensions page:

Chrome/Edge: chrome://extensions/

Brave: brave://extensions/

Toggle Developer mode (usually a switch in the top-right corner).

Click Load unpacked in the upper left corner.

Select the folder containing your project files (where your manifest.json sits).

Navigate to any standard website, and the Hulu Hub launcher widget will instantly initialize!

🔍 Architecture Highlights
The "Off-Screen Popup" Strategy
Modern browser engines strictly throttle or freeze JavaScript code execution inside hidden tabs or windows configured to state: "minimized". This security layer frequently drops WebSocket pipelines on demanding AI platforms like Claude.

To bypass this restriction seamlessly, Hulu Hub maintains an internal window tracking pool. When processing prompts, it spins up an ultra-compact 120x120 popup window tracking bounds directly on your screen. Once the task submits, it instantly shifts coordinates out of bounds (left: 9999), preserving a raw state: "normal" structure. This forces Chrome to keep processing threads running at full performance while staying completely invisible to the user.

🛠️ Troubleshooting
1. "Lost connection to provider tab" or Timeouts
Make sure you are logged into your respective account on ChatGPT, Claude, or Gemini.

Open the web interface directly once, complete any multi-factor verification checks or greeting popups, and retry using the hub.

2. Dragging lags or jumps around
Ensure that your browser hardware acceleration is enabled under Settings > System > Use graphics acceleration when available. The tracking pipeline depends heavily on browser animation loops.
