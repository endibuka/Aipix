/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Aipix retro color palette from STYLING.md
        aipix: {
          bg: '#3e323b',           // Window background
          panel: '#2b2b2b',        // Toolbar/panels
          panelLight: '#404040',   // Panel headers
          hover: '#505050',        // Button hover
          active: '#606060',       // Button active
          divider: '#1a1a1a',      // Divider lines
          input: '#1d1d1d',        // Input backgrounds
          text: '#d6d2ca',         // Primary text
          textMuted: '#9b978e',    // Muted text
          accent: '#8aa7ff',       // Selected/active accent
          canvasGrid: '#3f3f3f',   // Canvas grid
          canvasBg: '#4d404f',     // Canvas background
          menuBar: '#c8b79e',      // Top menu bar
        },
      },
      fontFamily: {
        pixel: ['"Jersey 10"', 'monospace'],
        mono: ['"JetBrains Mono"', '"Cascadia Mono"', '"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
}
