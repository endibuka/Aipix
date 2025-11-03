/**
 * Optimized Drawing Manager - Integration Layer
 *
 * Provides a high-level interface that combines all Aseprite-inspired optimizations:
 * - Preview canvas system
 * - Mouse event coalescing
 * - Dirty rectangle tracking
 * - Velocity tracking and stroke smoothing
 * - Viewport-based invalidation
 * - Two-phase commit (preview + commit)
 */

import {
  DrawingStateMachine,
  TracePolicy,
  ToolConfig,
  Viewport,
  Point
} from './drawingStateMachine';
import { ToolType } from './mouseEventCoalescing';

export interface DrawingConfig {
  brushSize: number;
  brushColor: string;
  opacity: number;
  stabilization: number; // 1.0 = none, higher = more smoothing
  usePreview: boolean;
}

export interface DrawCallback {
  drawToCanvas: (ctx: CanvasRenderingContext2D, points: Point[]) => void;
  drawToPreview: (ctx: CanvasRenderingContext2D, points: Point[]) => void;
}

/**
 * Manages optimized drawing with all Aseprite patterns integrated
 */
export class OptimizedDrawingManager {
  private stateMachine: DrawingStateMachine;
  private mainCanvas: HTMLCanvasElement;
  private mainCtx: CanvasRenderingContext2D;
  private config: DrawingConfig;
  private drawCallback: DrawCallback | null = null;

  // Render loop
  private renderLoopId: number | null = null;
  private needsRender: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    config: DrawingConfig,
    viewport: Viewport
  ) {
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }

    this.mainCanvas = canvas;
    this.mainCtx = ctx;
    this.config = config;

    // Initialize state machine with tool configuration
    const toolConfig = this.getToolConfig('pencil');
    this.stateMachine = new DrawingStateMachine(
      canvas.width,
      canvas.height,
      toolConfig,
      viewport
    );

    // Start render loop
    this.startRenderLoop();
  }

  /**
   * Get tool configuration for a given tool name
   */
  private getToolConfig(toolName: string): ToolConfig {
    // Determine trace policy and tool type based on tool
    let tracePolicy: TracePolicy;
    let toolType: ToolType;
    let usePreview: boolean;

    switch (toolName) {
      case 'line':
      case 'rectangle':
      case 'circle':
      case 'ellipse':
        tracePolicy = TracePolicy.LAST;
        toolType = ToolType.SHAPE;
        usePreview = true;
        break;

      case 'spray':
      case 'jumble':
        tracePolicy = TracePolicy.OVERLAP;
        toolType = ToolType.FREEHAND;
        usePreview = false;
        break;

      case 'pencil':
      case 'brush':
      case 'eraser':
      default:
        tracePolicy = TracePolicy.ACCUMULATE;
        toolType = ToolType.FREEHAND;
        usePreview = false;
        break;
    }

    return {
      tracePolicy,
      toolType,
      brushSize: this.config.brushSize,
      stabilization: this.config.stabilization,
      usePreview
    };
  }

  /**
   * Set the drawing configuration
   */
  setConfig(config: Partial<DrawingConfig>): void {
    this.config = { ...this.config, ...config };

    // Update tool config
    const currentTool = this.getToolConfig('pencil'); // TODO: Track current tool name
    currentTool.brushSize = this.config.brushSize;
    currentTool.stabilization = this.config.stabilization;
    this.stateMachine.setToolConfig(currentTool);
  }

  /**
   * Set the active tool
   */
  setTool(toolName: string): void {
    const toolConfig = this.getToolConfig(toolName);
    this.stateMachine.setToolConfig(toolConfig);
  }

  /**
   * Set viewport (for zoom/pan changes)
   */
  setViewport(viewport: Viewport): void {
    this.stateMachine.setViewport(viewport);
  }

  /**
   * Set the draw callback for custom drawing
   */
  setDrawCallback(callback: DrawCallback): void {
    this.drawCallback = callback;
  }

  /**
   * Start drawing
   */
  startDrawing(x: number, y: number, pressure: number = 1.0): void {
    this.stateMachine.startDrawing(x, y, pressure);
    this.needsRender = true;
  }

  /**
   * Continue drawing
   */
  continueDrawing(x: number, y: number, pressure: number = 1.0): void {
    this.stateMachine.continueDrawing(x, y, pressure);
    this.needsRender = true;
  }

  /**
   * End drawing and commit
   */
  endDrawing(commit: boolean = true): void {
    if (commit) {
      this.commitDrawing();
    }
    this.stateMachine.endDrawing(commit);
    this.needsRender = true;
  }

  /**
   * Commit the current drawing to the main canvas
   */
  private commitDrawing(): void {
    const points = this.stateMachine.getStrokePoints();
    if (points.length === 0) return;

    // Get dirty region for optimization
    const dirtyRegion = this.stateMachine.getDirtyRegion(false); // Don't limit to viewport for commit

    if (this.drawCallback) {
      // Use callback for custom drawing
      this.drawCallback.drawToCanvas(this.mainCtx, points);
    } else {
      // Default drawing
      this.drawStrokeToContext(this.mainCtx, points);
    }

    // Commit preview if active
    if (this.stateMachine.isPreviewActive()) {
      this.stateMachine.commitPreview(this.mainCtx);
    }
  }

  /**
   * Default stroke drawing implementation
   */
  private drawStrokeToContext(ctx: CanvasRenderingContext2D, points: Point[]): void {
    if (points.length === 0) return;

    ctx.save();
    ctx.strokeStyle = this.config.brushColor;
    ctx.lineWidth = this.config.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = this.config.opacity / 100;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Render loop - only redraws when needed and uses dirty rectangles
   */
  private renderLoop = (): void => {
    if (this.needsRender) {
      this.render();
      this.needsRender = false;
    }

    this.renderLoopId = requestAnimationFrame(this.renderLoop);
  };

  /**
   * Render current state
   */
  private render(): void {
    // Only redraw dirty regions
    const dirtyRegion = this.stateMachine.getDirtyRegion(
      this.stateMachine.isPreviewActive() // Limit to viewport in preview mode
    );

    if (!dirtyRegion && !this.stateMachine.isPreviewActive()) {
      return; // Nothing to render
    }

    // If preview is active, render it
    if (this.stateMachine.isPreviewActive()) {
      const previewCtx = this.stateMachine.getPreviewCanvas().getContext();
      const points = this.stateMachine.getStrokePoints();

      if (this.drawCallback) {
        this.drawCallback.drawToPreview(previewCtx, points);
      } else {
        this.drawStrokeToContext(previewCtx, points);
      }

      // Render preview on top of main canvas (non-destructive)
      this.stateMachine.renderPreview(this.mainCtx);
    }
  }

  /**
   * Start the render loop
   */
  private startRenderLoop(): void {
    if (!this.renderLoopId) {
      this.renderLoopId = requestAnimationFrame(this.renderLoop);
    }
  }

  /**
   * Stop the render loop
   */
  stopRenderLoop(): void {
    if (this.renderLoopId) {
      cancelAnimationFrame(this.renderLoopId);
      this.renderLoopId = null;
    }
  }

  /**
   * Request a render on next frame
   */
  requestRender(): void {
    this.needsRender = true;
  }

  /**
   * Resize canvases
   */
  resize(width: number, height: number): void {
    this.mainCanvas.width = width;
    this.mainCanvas.height = height;
    this.stateMachine.resize(width, height);
    this.needsRender = true;
  }

  /**
   * Get current velocity (for debugging or dynamic effects)
   */
  getVelocity() {
    return this.stateMachine.getVelocity();
  }

  /**
   * Check if currently drawing
   */
  isDrawing(): boolean {
    return this.stateMachine.getState() !== 'idle';
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopRenderLoop();
  }
}

/**
 * Factory function to create an optimized drawing manager
 */
export function createOptimizedDrawingManager(
  canvas: HTMLCanvasElement,
  config: DrawingConfig,
  viewport: Viewport
): OptimizedDrawingManager {
  return new OptimizedDrawingManager(canvas, config, viewport);
}
