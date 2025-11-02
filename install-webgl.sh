#!/bin/bash

echo "Installing WebGL support for Tauri on Linux..."
echo "This will install WebKitGTK with WebGL and hardware acceleration support."
echo ""

sudo apt install -y libwebkit2gtk-4.1-0 libwebkit2gtk-4.1-dev gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-libav

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ WebGL support installed successfully!"
    echo ""
    echo "Now restart your Tauri app:"
    echo "  1. Stop the current dev server (Ctrl+C)"
    echo "  2. Run: npm run tauri dev"
    echo ""
    echo "You should see 'WebGL initialized successfully!' in the console."
else
    echo ""
    echo "❌ Installation failed. Please check the error messages above."
fi
