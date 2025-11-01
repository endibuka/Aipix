// Main pixel canvas component
import React, { useRef, useEffect } from "react";

interface PixelCanvasProps {
  width: number;
  height: number;
}

export const PixelCanvas: React.FC<PixelCanvasProps> = ({ width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize canvas with a checkerboard pattern (transparency indicator)
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = "#E5E7EB";
    ctx.lineWidth = 0.5;

    for (let x = 0; x <= width; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y += 10) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }, [width, height]);

  return (
    <div className="flex items-center justify-center bg-gray-900 p-4">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="pixel-canvas border border-gray-700 shadow-lg"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
};
