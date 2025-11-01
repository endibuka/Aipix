# Aipix

Aipix is a modern, cross-platform pixel-art editor that combines classic precision with contemporary design and intelligent workflow tools.  
Built with **Rust**, **Tauri**, and **React**, it delivers native-level performance, fast startup, and a clean, extensible architecture for future creative features.

---

## 🧩 Overview

Aipix is designed to provide a focused, distraction-free pixel editing experience with modern engineering foundations.  
The goal is to bridge the simplicity of traditional tools (like Aseprite or GraphicsGale) with the flexibility and performance of modern frameworks.

**Key goals:**
- Native performance and small footprint  
- Clean, minimal UI for focused editing  
- Cross-platform builds (Windows, macOS, Linux)  
- Extensible engine written in Rust  
- Clear separation between UI and rendering logic  

---

## ⚙️ Tech Stack

| Layer | Technology | Purpose |
|--------|-------------|----------|
| App Shell | **Tauri** | Cross-platform desktop runtime with Rust backend and WebView UI |
| Core Engine | **Rust** | Pixel buffer, layers, frames, file I/O, and performance-critical logic |
| Frontend | **React + TypeScript** | UI components, toolbars, timeline, settings |
| Styling | **TailwindCSS + shadcn/ui** | Rapid and consistent interface design |
| Rendering | **Canvas API / WebGL** | Real-time pixel editing and preview |
| State Management | **Zustand** | Global app state (layers, tools, frames, palettes) |
| Packaging | **Cargo + Tauri CLI** | Building, bundling, and distribution |
| AI Integration (optional) | **onnxruntime / OpenAI API** | Smart tools like palette generation, brush guidance, or sprite automation |

---

## 🧠 Architecture

src/
├── frontend/
│ ├── components/ # React components (toolbar, timeline, etc.)
│ ├── canvas/ # Drawing engine and renderer
│ ├── state/ # Global app state (Zustand)
│ ├── hooks/ # Custom UI and logic hooks
│ ├── styles/ # Tailwind and UI styling
│ └── main.tsx # App entry point
│
├── backend/
│ ├── main.rs # Tauri main entry
│ ├── engine/ # Pixel buffer, layers, animation logic
│ ├── fileio.rs # Load / save images and sprite sheets
│ └── ai/ # Optional AI-assisted features
│
└── tauri.conf.json # App config and build settings


---

## 🚀 Getting Started

### Prerequisites
- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites/)