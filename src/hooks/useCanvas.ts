// Custom hook for canvas operations
import { useRef, useEffect } from 'react';

interface UseCanvasOptions {
  width: number;
  height: number;
  onDraw?: (ctx: CanvasRenderingContext2D) => void;
}

export const useCanvas = ({ width, height, onDraw }: UseCanvasOptions) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Call draw callback if provided
    if (onDraw) {
      onDraw(ctx);
    }
  }, [width, height, onDraw]);

  return canvasRef;
};
