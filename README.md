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
- [Rust](https://www.rust-lang.org/tools/install) (v1.90.0 or higher)
- [Node.js](https://nodejs.org/) (v22.14.0 or higher)
- [npm](https://www.npmjs.com/) (v10.9.2 or higher)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/endibuka/Aipix.git
   cd Aipix
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run tauri:dev
   ```

   This will start both the Vite development server and the Tauri application window.

### Available Scripts

- `npm run dev` - Start Vite development server only (frontend)
- `npm run build` - Build the frontend for production
- `npm run preview` - Preview the production build
- `npm run tauri:dev` - Start Tauri application in development mode
- `npm run tauri:build` - Build the Tauri application for production
- `npm run lint` - Run ESLint to check code quality
- `npm run format` - Format code with Prettier

### Project Structure

```
Aipix/
├── src/                          # Frontend source code
│   ├── components/               # React components
│   │   └── Toolbar.tsx          # Drawing tools toolbar
│   ├── canvas/                   # Canvas rendering
│   │   └── PixelCanvas.tsx      # Main pixel canvas component
│   ├── state/                    # State management
│   │   └── store.ts             # Zustand global store
│   ├── hooks/                    # Custom React hooks
│   │   └── useCanvas.ts         # Canvas utilities hook
│   ├── styles/                   # CSS and styling
│   │   ├── index.css            # Global styles
│   │   └── App.css              # App-specific styles
│   ├── App.tsx                  # Main app component
│   └── main.tsx                 # React entry point
│
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs              # Tauri application entry
│   │   ├── lib.rs               # Library exports
│   │   ├── engine/              # Pixel art engine
│   │   │   ├── mod.rs           # Engine module exports
│   │   │   ├── pixel_buffer.rs  # Pixel buffer implementation
│   │   │   ├── layer.rs         # Layer management
│   │   │   └── animation.rs     # Frame/animation system
│   │   └── fileio/              # File I/O operations
│   │       └── mod.rs           # Image load/save
│   ├── icons/                   # Application icons
│   ├── Cargo.toml               # Rust dependencies
│   ├── tauri.conf.json          # Tauri configuration
│   └── build.rs                 # Build script
│
├── package.json                  # Node.js dependencies
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite build configuration
├── tailwind.config.js            # TailwindCSS configuration
├── eslint.config.js              # ESLint configuration
└── README.md                     # This file
```

### Development Workflow

1. **Making Changes:**
   - Frontend changes in `src/` will hot-reload automatically
   - Rust backend changes in `src-tauri/src/` require restarting the dev server

2. **Adding Dependencies:**
   - Frontend: `npm install <package-name>`
   - Backend: Add to `src-tauri/Cargo.toml` and run `cargo build`

3. **Building for Production:**
   ```bash
   npm run tauri:build
   ```
   This creates platform-specific installers in `src-tauri/target/release/bundle/`