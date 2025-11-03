/**
 * Canvas Optimization Integration Example
 *
 * This file demonstrates how to integrate all the Aseprite-inspired
 * optimizations into the existing Canvas component.
 */

import { OptimizedDrawingManager, DrawingConfig } from './optimizedDrawingManager';
import { Viewport } from './drawingStateMachine';

/**
 * Example: How to integrate into Canvas.tsx
 *
 * 1. Add to Canvas component state/refs:
 */
export interface CanvasOptimizationRefs {
  drawingManager: React.MutableRefObject<OptimizedDrawingManager | null>;
  viewport: React.MutableRefObject<Viewport>;
}

/**
 * 2. Initialize in useEffect:
 */
export function initializeOptimizedDrawing(
  canvas: HTMLCanvasElement,
  brushSize: number,
  color: string,
  opacity: number
): OptimizedDrawingManager {
  const viewport: Viewport = {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
    zoom: 1.0
  };

  const config: DrawingConfig = {
    brushSize,
    brushColor: color,
    opacity,
    stabilization: 1.0, // Can be exposed in UI as a slider
    usePreview: false
  };

  const manager = new OptimizedDrawingManager(canvas, config, viewport);

  // Set up custom drawing callback
  manager.setDrawCallback({
    drawToCanvas: (ctx, points) => {
      // Your existing drawing logic here
      if (points.length === 0) return;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = opacity / 100;

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }

      ctx.stroke();
      ctx.restore();
    },
    drawToPreview: (ctx, points) => {
      // Same logic for preview
      if (points.length === 0) return;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = opacity / 100;

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }

      ctx.stroke();
      ctx.restore();
    }
  });

  return manager;
}

/**
 * 3. Replace mouse event handlers:
 */
export function handleOptimizedMouseDown(
  manager: OptimizedDrawingManager,
  e: React.MouseEvent<HTMLCanvasElement>
): void {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const pressure = (e as any).pressure || 1.0;

  manager.startDrawing(x, y, pressure);
}

export function handleOptimizedMouseMove(
  manager: OptimizedDrawingManager,
  e: React.MouseEvent<HTMLCanvasElement>,
  isDrawing: boolean
): void {
  if (!isDrawing) return;

  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const pressure = (e as any).pressure || 1.0;

  manager.continueDrawing(x, y, pressure);
}

export function handleOptimizedMouseUp(
  manager: OptimizedDrawingManager,
  commit: boolean = true
): void {
  manager.endDrawing(commit);
}

/**
 * 4. Update viewport on zoom/pan:
 */
export function updateViewport(
  manager: OptimizedDrawingManager,
  viewport: Viewport
): void {
  manager.setViewport(viewport);
}

/**
 * 5. Update config when brush size or color changes:
 */
export function updateDrawingConfig(
  manager: OptimizedDrawingManager,
  changes: Partial<DrawingConfig>
): void {
  manager.setConfig(changes);
}

/**
 * 6. Switch tools:
 */
export function switchTool(
  manager: OptimizedDrawingManager,
  toolName: string
): void {
  manager.setTool(toolName);
}

/**
 * Complete integration example for Canvas.tsx:
 *
 * ```typescript
 * // Add to Canvas component:
 * const optimizedDrawingManagerRef = useRef<OptimizedDrawingManager | null>(null);
 * const viewportRef = useRef<Viewport>({
 *   x: 0,
 *   y: 0,
 *   width: width,
 *   height: height,
 *   zoom: 1.0
 * });
 *
 * // Initialize in useEffect:
 * useEffect(() => {
 *   if (!canvasRef.current) return;
 *
 *   const manager = initializeOptimizedDrawing(
 *     canvasRef.current,
 *     brushSize,
 *     selectedColor,
 *     colorOpacity
 *   );
 *
 *   optimizedDrawingManagerRef.current = manager;
 *
 *   return () => {
 *     manager.destroy();
 *   };
 * }, []);
 *
 * // Update config when settings change:
 * useEffect(() => {
 *   if (!optimizedDrawingManagerRef.current) return;
 *
 *   updateDrawingConfig(optimizedDrawingManagerRef.current, {
 *     brushSize,
 *     brushColor: selectedColor,
 *     opacity: colorOpacity
 *   });
 * }, [brushSize, selectedColor, colorOpacity]);
 *
 * // Replace mouse handlers:
 * const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
 *   if (!optimizedDrawingManagerRef.current) return;
 *
 *   if (selectedTool === 'pencil' || selectedTool === 'brush') {
 *     handleOptimizedMouseDown(optimizedDrawingManagerRef.current, e);
 *     setIsDrawing(true);
 *   }
 *   // ... other tool logic
 * };
 *
 * const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
 *   if (!optimizedDrawingManagerRef.current) return;
 *
 *   if (isDrawing && (selectedTool === 'pencil' || selectedTool === 'brush')) {
 *     handleOptimizedMouseMove(optimizedDrawingManagerRef.current, e, isDrawing);
 *   }
 *   // ... other tool logic
 * };
 *
 * const handleMouseUp = () => {
 *   if (!optimizedDrawingManagerRef.current) return;
 *
 *   if (isDrawing && (selectedTool === 'pencil' || selectedTool === 'brush')) {
 *     handleOptimizedMouseUp(optimizedDrawingManagerRef.current);
 *     setIsDrawing(false);
 *   }
 *   // ... other tool logic
 * };
 * ```
 */

/**
 * Performance monitoring utilities
 */
export class DrawingPerformanceMonitor {
  private frameCount: number = 0;
  private lastTime: number = performance.now();
  private fps: number = 0;
  private drawTime: number = 0;

  startFrame(): void {
    this.lastTime = performance.now();
  }

  endFrame(): void {
    const now = performance.now();
    this.drawTime = now - this.lastTime;
    this.frameCount++;

    if (this.frameCount % 60 === 0) {
      this.fps = 1000 / this.drawTime;
    }
  }

  getFPS(): number {
    return this.fps;
  }

  getDrawTime(): number {
    return this.drawTime;
  }

  reset(): void {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fps = 0;
    this.drawTime = 0;
  }
}
