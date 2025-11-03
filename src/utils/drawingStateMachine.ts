/**
 * Drawing State Machine and Tool Loop - Aseprite Pattern
 *
 * Manages drawing states, preview/commit phases, and viewport-based invalidation
 */

import { PreviewCanvas } from './previewCanvas';
import { DirtyRectangleManager, Rectangle } from './dirtyRectangle';
import { StrokeProcessor } from './velocityTracking';
import { DelayedMouseMove, ToolType } from './mouseEventCoalescing';

export enum DrawingState {
  IDLE = 'idle',
  DRAWING = 'drawing',
  PREVIEW = 'preview'
}

export enum TracePolicy {
  ACCUMULATE = 'accumulate',  // Pencil, Brush - accumulates all points
  LAST = 'last',               // Line, Rectangle - only shows last preview
  OVERLAP = 'overlap'          // Spray - each step overlaps previous
}

export interface ToolConfig {
  tracePolicy: TracePolicy;
  toolType: ToolType;
  brushSize: number;
  stabilization: number;
  usePreview: boolean;
}

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

/**
 * Main drawing state machine that orchestrates all optimizations
 */
export class DrawingStateMachine {
  private state: DrawingState = DrawingState.IDLE;
  private previewCanvas: PreviewCanvas;
  private dirtyRects: DirtyRectangleManager;
  private strokeProcessor: StrokeProcessor;
  private delayedMouseMove: DelayedMouseMove;

  private currentTool: ToolConfig;
  private viewport: Viewport;
  private strokePoints: Point[] = [];
  private lastPoint: Point | null = null;

  constructor(
    width: number,
    height: number,
    initialToolConfig: ToolConfig,
    viewport: Viewport
  ) {
    this.previewCanvas = new PreviewCanvas({ width, height });
    this.dirtyRects = new DirtyRectangleManager();
    this.strokeProcessor = new StrokeProcessor(initialToolConfig.stabilization);
    this.delayedMouseMove = new DelayedMouseMove(
      (event) => this.handleDelayedMouseMove(event),
      initialToolConfig.toolType
    );

    this.currentTool = initialToolConfig;
    this.viewport = viewport;

    this.updateViewport();
  }

  /**
   * Update viewport for dirty rectangle limiting
   */
  private updateViewport(): void {
    this.dirtyRects.setViewport({
      x: this.viewport.x,
      y: this.viewport.y,
      width: this.viewport.width,
      height: this.viewport.height
    });
  }

  /**
   * Set viewport (for zoom/pan changes)
   */
  setViewport(viewport: Viewport): void {
    this.viewport = viewport;
    this.updateViewport();
  }

  /**
   * Set tool configuration
   */
  setToolConfig(config: ToolConfig): void {
    this.currentTool = config;
    this.strokeProcessor.setStabilization(config.stabilization);
    this.delayedMouseMove.setToolType(config.toolType);
  }

  /**
   * Get current drawing state
   */
  getState(): DrawingState {
    return this.state;
  }

  /**
   * Start a drawing operation
   */
  startDrawing(x: number, y: number, pressure: number = 1.0): void {
    if (this.state !== DrawingState.IDLE) {
      this.endDrawing(true); // Commit any previous drawing
    }

    this.state = this.currentTool.usePreview ? DrawingState.PREVIEW : DrawingState.DRAWING;
    this.strokePoints = [];
    this.lastPoint = null;
    this.strokeProcessor.reset();
    this.dirtyRects.clear();

    if (this.currentTool.usePreview) {
      this.previewCanvas.start();
    }

    // Process first point
    this.addPoint(x, y, pressure);
  }

  /**
   * Continue drawing with a new point
   */
  continueDrawing(x: number, y: number, pressure: number = 1.0): void {
    if (this.state === DrawingState.IDLE) {
      return;
    }

    // Use delayed mouse move for event coalescing
    this.delayedMouseMove.onMouseMove(x, y, pressure);
  }

  /**
   * Handle delayed mouse move event (after coalescing)
   */
  private handleDelayedMouseMove(event: { x: number; y: number; pressure: number }): void {
    this.addPoint(event.x, event.y, event.pressure);
  }

  /**
   * Add a point to the current stroke
   */
  private addPoint(x: number, y: number, pressure: number = 1.0): void {
    // Process point through velocity tracking and stabilization
    const processed = this.strokeProcessor.processPoint(x, y);

    const point: Point = {
      x: processed.point.x,
      y: processed.point.y,
      pressure
    };

    // Add dirty region for this stroke segment
    if (this.lastPoint) {
      this.dirtyRects.addDirtyLine(
        this.lastPoint.x,
        this.lastPoint.y,
        point.x,
        point.y,
        this.currentTool.brushSize
      );
    } else {
      this.dirtyRects.addDirtyPoint(point.x, point.y, this.currentTool.brushSize);
    }

    // Handle different trace policies
    switch (this.currentTool.tracePolicy) {
      case TracePolicy.ACCUMULATE:
        // Add to stroke accumulation
        this.strokePoints.push(point);
        break;

      case TracePolicy.LAST:
        // Only keep last point for preview (e.g., line tool)
        if (this.strokePoints.length === 0) {
          this.strokePoints.push(this.lastPoint || point); // Keep start point
        }
        if (this.strokePoints.length === 1) {
          this.strokePoints.push(point); // Keep end point
        } else {
          this.strokePoints[1] = point; // Update end point
        }

        // Clear and redraw preview for shape tools
        if (this.state === DrawingState.PREVIEW) {
          this.previewCanvas.clear();
        }
        break;

      case TracePolicy.OVERLAP:
        // Each step overlaps previous
        this.strokePoints.push(point);
        break;
    }

    this.lastPoint = point;
  }

  /**
   * End drawing operation
   * @param commit - true to commit to main canvas, false to cancel
   */
  endDrawing(commit: boolean = true): void {
    if (this.state === DrawingState.IDLE) {
      return;
    }

    // Flush any pending delayed events
    this.delayedMouseMove.flush();

    if (commit && this.strokePoints.length > 0) {
      // This will be handled by the caller to commit to actual canvas
      // The state machine just manages the preview and dirty rects
    }

    if (this.state === DrawingState.PREVIEW) {
      if (commit) {
        // Preview will be committed by caller
      } else {
        this.previewCanvas.end(); // Rollback
      }
    }

    this.state = DrawingState.IDLE;
    this.strokePoints = [];
    this.lastPoint = null;
    this.strokeProcessor.reset();
    this.delayedMouseMove.clear();
  }

  /**
   * Get dirty region for rendering optimization
   * @param limitToViewport - true for preview mode, false for final commit
   */
  getDirtyRegion(limitToViewport: boolean = false): Rectangle | null {
    // For preview mode with LAST trace policy, limit to viewport
    const shouldLimit = limitToViewport ||
      (this.state === DrawingState.PREVIEW && this.currentTool.tracePolicy === TracePolicy.LAST);

    return this.dirtyRects.getDirtyRegion(shouldLimit);
  }

  /**
   * Get optimized dirty rectangles
   */
  getOptimizedDirtyRects(limitToViewport: boolean = false): Rectangle[] {
    const shouldLimit = limitToViewport ||
      (this.state === DrawingState.PREVIEW && this.currentTool.tracePolicy === TracePolicy.LAST);

    return this.dirtyRects.getOptimizedDirtyRects(shouldLimit);
  }

  /**
   * Get current stroke points
   */
  getStrokePoints(): Point[] {
    return [...this.strokePoints];
  }

  /**
   * Get preview canvas
   */
  getPreviewCanvas(): PreviewCanvas {
    return this.previewCanvas;
  }

  /**
   * Check if preview is active
   */
  isPreviewActive(): boolean {
    return this.state === DrawingState.PREVIEW && this.previewCanvas.active();
  }

  /**
   * Commit preview to target context
   */
  commitPreview(targetCtx: CanvasRenderingContext2D): void {
    if (this.isPreviewActive()) {
      this.previewCanvas.commit(targetCtx);
    }
  }

  /**
   * Render preview on target context (non-destructive)
   */
  renderPreview(targetCtx: CanvasRenderingContext2D): void {
    if (this.isPreviewActive()) {
      this.previewCanvas.renderPreview(targetCtx);
    }
  }

  /**
   * Clear dirty rectangles
   */
  clearDirtyRects(): void {
    this.dirtyRects.clear();
  }

  /**
   * Check if there are dirty regions to render
   */
  hasDirtyRegions(): boolean {
    return this.dirtyRects.hasDirtyRegions();
  }

  /**
   * Resize canvases
   */
  resize(width: number, height: number): void {
    this.previewCanvas.resize(width, height);
  }

  /**
   * Get current velocity
   */
  getVelocity() {
    return this.strokeProcessor.getVelocity();
  }
}
