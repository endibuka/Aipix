# Aipix UI Styling Guide

This document defines the visual and interaction language of **Aipix**, inspired by classic pixel-art editing tools such as Aseprite.  
The goal is to combine **retro pixel-software aesthetics** with **modern usability and clarity**.

---

## 🎨 1. Core Design Principles

- **Pixel-Perfect Precision:** All UI elements should align cleanly to a pixel grid (no subpixel rendering).
- **Minimal Distraction:** The workspace dominates the visual hierarchy; toolbars and palettes are secondary.
- **Consistent Contrast:** Clear distinction between interactive and passive elements using value contrast (light vs dark grey).
- **Retro-Modern Balance:** Nostalgic look (low-saturation colors, outlined panels) with smooth modern interaction.

---

## 🪟 2. Layout Overview

| Area | Description | Color |
|------|--------------|-------|
| **Top Menu Bar** | Flat horizontal menu (`File`, `Edit`, `Sprite`, `Layer`, etc.) | `#c8b79e` background, dark text |
| **Toolbar (Left)** | Vertical icon bar for tools (brush, eraser, fill, etc.) | Slightly darker grey `#2b2b2b` |
| **Palette Panel** | Small color swatches grid on left side | Background `#1d1d1d`, swatches 8×8 grid |
| **Canvas Area** | Main workspace background | Neutral purple-grey `#4d404f` |
| **Status Bar (Bottom)** | Displays sprite info, zoom, frame count | `#a5a4a1` background, dark text |

---

## 🎨 3. Color Palette

The palette uses muted midtones and a restrained accent system.

| Element | Hex | Notes |
|----------|-----|-------|
| Window Background | `#3e323b` | Deep mauve-grey |
| Toolbar / Panels | `#2b2b2b` | Neutral dark |
| Button Hover | `#505050` | Slightly lighter hover state |
| Divider Lines | `#1a1a1a` | Thin 1px separators |
| Text (Primary) | `#d6d2ca` | Warm light text |
| Text (Muted) | `#9b978e` | For inactive states |
| Accent (Selected / Active) | `#8aa7ff` | Subtle blue accent for highlights |
| Canvas Grid | `#3f3f3f` | Dark neutral grid |
| Canvas Background | `#4d404f` | Main workspace background |

---

## 🧩 4. Components

### **4.1 Buttons**
- **Shape:** Rectangular, 1px solid border.
- **States:**
  - Default: `background: #2b2b2b; border: #1a1a1a;`
  - Hover: `background: #404040;`
  - Active: `background: #606060;`
- **Text:** Uppercase, monospace, `#d6d2ca`.

### **4.2 Panels**
- **Layout:** Inset boxes with minimal shadows.
- **Border:** 1px inner line (`#1a1a1a`).
- **Header:** Slightly lighter shade than panel body.

### **4.3 Canvas**
- **Checkerboard background** for transparency preview:  
  - Light square: `#808080`
  - Dark square: `#606060`
- **Zoom indicator:** bottom right label (e.g. `800%`).

### **4.4 Color Palette Grid**
- **Swatch Size:** 12×12 px
- **Columns:** 8–12 per row
- **Selected Swatch Border:** 1px white border with 1px black outline.

### **4.5 Tool Icons**
- **Size:** 16×16 px, pixel art only.
- **Active Tool Highlight:** Outer border glow or slight tint (`#8aa7ff`).

---

## 🔤 5. Typography

| Element | Font | Size | Weight | Color |
|----------|------|------|--------|-------|
| **Logo / Branding** | `'Jersey 10'` (pixel font) | 32-48px | 400 | `#d6d2ca` |
| Menus / Labels | `'JetBrains Mono'`, `'Cascadia Mono'`, `'Courier New'` | 12px | 400 | `#d6d2ca` |
| Status Text | Same | 11px | 400 | `#9b978e` |
| Inputs | Monospace | 12px | 400 | `#ffffff` |

### **Pixel Font for Branding**
- **Font:** Jersey 10 (Google Fonts)
- **Usage:** Logo, app title, major headings
- **URL:** `https://fonts.google.com/specimen/Jersey+10`
- **Characteristics:** Clean pixel-style font with retro aesthetic
- **Best practices:**
  - Use sparingly for maximum impact
  - Pair with monospace fonts for body text
  - Larger sizes (32px+) for optimal readability
  - Works well for branding and titles

---

## 🧭 6. Interaction Behavior

- **Hover:** Subtle brightening (`+10%` lightness).
- **Active:** Inner shadow / darken by 10%.
- **Focus:** Blue accent border (`#8aa7ff`).
- **Click Feedback:** No animation; instant color change for old-school responsiveness.

---

## 🖌️ 7. Iconography

- Icons should be **8–16 px pixel art**, flat, and monochrome by default.
- Use single-color icons (`#d6d2ca`).
- Highlight active icons with tinted overlays or background rectangles.

---

## 🧱 8. Example Component Hierarchy

<Window> ├── <MenuBar> ├── <ToolbarLeft> ├── <PalettePanel> ├── <CanvasArea> ├── <LayerPanelRight> └── <StatusBar> ```
Each region uses a consistent border system (1px inset, dark-on-light contrast).

⚙️ 9. Modern Enhancements (Aipix)
While keeping retro fidelity, Aipix adds:

Smoother rounded corners (4px radius)

Subtle shadow under floating panels (box-shadow: rgba(0,0,0,0.3) 0 2px 4px)

Customizable themes (Dark / Retro / Light)

Optional vector icons for high-DPI displays