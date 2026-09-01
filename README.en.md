# 🗺️ dsh-conversation-map

English · [中文](README.md)

> Conversation Minimap — a DeepSeek Harness (`dsh`) Web client plugin.

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-conversation-map"><img alt="npm version" src="https://img.shields.io/npm/v/dsh-conversation-map?style=flat-square&label=version&color=4c8dff"></a>
  <a href="https://www.npmjs.com/package/dsh-conversation-map"><img alt="npm downloads" src="https://img.shields.io/npm/dm/dsh-conversation-map?style=flat-square&label=downloads&color=3fa46a"></a>
  <a href="https://github.com/afoxsss/dsh-conversation-map/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-3fa46a?style=flat-square"></a>
  <a href="https://github.com/afoxsss/dsh-conversation-map"><img alt="platform" src="https://img.shields.io/badge/platform-Web%20%E2%80%A2%20dsh-blueviolet?style=flat-square"></a>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img alt="DeepSeek Harness" src="https://img.shields.io/badge/DeepSeek%20Harness-GitHub-181717?style=flat-square&logo=github"></a>
  <a href="https://awesome-dsh-plugin.com"><img alt="Awesome DSH Plugin" src="https://awesome-dsh-plugin.com/badge.svg"></a>
</p>

Current version: **0.1.6**

Renders a draggable **conversation minimap** on the right side of the chat area — preview the whole conversation like an editor minimap and scroll with a flick:

## ✨ Features

- 🎨 **Dual modes**: below 50px wide, **color-block mode** colors rows by message type (🔵 user / ⚪ assistant / 🟡 tool call / 🟢 command / 🔴 error, hover for a content preview); at ≥ 50px it automatically switches to **thumbnail mode**, which renders the entire conversation scaled down so you can see the real structure of messages, code blocks, and cards.
- ↔️ **Drag to resize**: drag the left handle (10–320px); the right edge stays pinned and a live width badge appears while dragging.
- ⚡ **Fast scrolling**: click anywhere to jump, press and drag for continuous scrolling; a translucent viewport indicator shows the current visible region in real time.
- 🔍 **Hover loupe**: in thumbnail mode, hovering anywhere opens a live magnified preview beside the cursor showing the **full row**, following the mouse in real time.
- 📌 **Collapse/expand**: hover the top of the map and click `»` to collapse into a 4px strip; a persistent `«` label stays on the strip, and clicking either the label or the strip expands it again.
- 🔄 **Live sync**: refreshes automatically while messages stream, tools run, or sessions switch; follows sidebar/detail-panel toggles and window resizes.
- 📐 **Adaptive height**: the map height scales with the conversation — thumbnails always keep their true aspect ratio and never stretch vertically; the height grows continuously with content until it caps at the available height, and once content exceeds the track the miniature pans vertically with scrolling (minimap semantics) so the visible region always stays inside the track.

## 📸 Screenshots

**Thumbnail mode** (widened, the whole conversation scaled down):

![Thumbnail mode](assets/screenshots/ex1.jpg)

**Color-block mode** (narrow strip, colored by message type, hover to preview):

![Color-block mode](assets/screenshots/ex2.jpg)

## 🚀 Installation

Install the latest version (default):

```sh
dsh plugin --profile web add dsh-conversation-map
```

Install a specific version (`dsh plugin add` forwards to pnpm, so any npm version spec works):

```sh
# Pin an exact version
dsh plugin --profile web add dsh-conversation-map@0.1.6

# Upgrade to the latest version
dsh plugin --profile web update dsh-conversation-map@latest
```

Verify the layer is mounted, then start:

```sh
dsh --profile web --dump-config   # should show a "# == dsh-conversation-map" layer
dsh --profile web
```

🗑️ Uninstall: `dsh plugin --profile web remove dsh-conversation-map`

## 🧩 Compatibility

- 🧭 **DOM contract**: DeepSeek Harness is in **developer preview** and its interfaces change breakingly; this plugin builds on the `dsh` 0.1.x Web conversation DOM contract:
  - `[data-conversation-scroll]` the conversation scroll container (note: the framework rebuilds the conversation column on every session switch, so this container is a fresh DOM node each time — the plugin observes a stable ancestor and re-resolves on every computation instead of holding the old node)
  - `[data-chat-anchor-key]` / `[data-chat-flow-kind]` conversation node rows
  - `[data-composer-seat]` the bottom input area
- 🧲 **Persistent map**: no refresh needed when switching sessions; the color-block/thumbnail content follows the current session automatically, and an empty track shows while a new session loads.
- 💾 **State persistence**: width and collapsed state persist in the browser's `localStorage` (keys `dsh-conversation-map:width` / `dsh-conversation-map:collapsed`) across session switches and page reloads.
- 🔒 **Pure client**: the Host half is a no-op; the browser half mounts through the `shell.overlay` slot and only uses the `react` and `slots` platform services — no network requests, no telemetry (no persistence beyond the localStorage state above).

## 🛠️ Development

```sh
pnpm install
pnpm run build    # tsdown → lib/client.js (__ModuleLoader__ factory wrapper)
```

Build artifact contract: CJS wrapped in `window.__ModuleLoader__.load({ id, factory })`; platform modules like `react` stay external, everything else is inlined (the plugin has no dependencies besides `react`).

## ⚙️ Customization

- Thumbnail threshold: `THUMB_MIN_WIDTH` in `src/client/index.ts` (default 50)
- Width range: `WIDTH_MIN` / `WIDTH_MAX` (default 10 / 320)
- Thumbnail refresh throttle: `THUMB_CLONE_INTERVAL` (default 200ms)
- Loupe parameters: `LOUPE_W` / `LOUPE_H` (default 854 / 200, whole row scaled to panel width), `LOUPE_SCALE` (zoom cap, default 1 = real scale)

## 📄 License

MIT

---

<p align="center">🧰 Recommended plugin hub: <a href="https://github.com/dsh-market/dsh-market">dsh-market</a></p>

<p align="center">Made with ❤️ for DeepSeek Harness · <a href="https://github.com/afoxsss/dsh-conversation-map">GitHub</a> · <a href="https://www.npmjs.com/package/dsh-conversation-map">npm</a></p>
