/**
 * Integrated Canvas Optimizations
 *
 * Combines drawing optimizations with large canvas optimizations
 * for complete performance coverage
 */

import {
  ViewportInfo,
  ViewportCuller,
  ZoomOptimizer,
  ZoomType,
  RenderBufferPool,
  LayerCuller,
  LayerInfo,
  OptimizedCanvasRenderer,
  LargeCanvasPerformanceMonitor,
  Rect
} from './largeCanvasOptimizations';

import {
  OptimizedDrawingManager,
  DrawingConfig
} from './optimizedDrawingManager';

import { Viewport } from './drawingStateMachine';

/**
 * Complete Canvas Optimization Manager
 * Combines both drawing and large canvas optimizations
 */
export class CompleteCanvasOptimizationManager {
  private drawingManager: OptimizedDrawingManager;
  private canvasRenderer: OptimizedCanvasRenderer;
  private performanceMonitor: LargeCanvasPerformanceMonitor;
  private viewport: ViewportInfo;
  private mainCanvas: HTMLCanvasElement;
  private displayCanvas: HTMLCanvasElement;

  constructor(
    mainCanvas: HTMLCanvasElement,
    displayCanvas: HTMLCanvasElement,
    initialConfig: DrawingConfig,
    initialViewport: ViewportInfo
  ) {
    this.mainCanvas = mainCanvas;
    this.displayCanvas = displayCanvas;
    this.viewport = initialViewport;

    // Initialize drawing optimizations
    const drawingViewport: Viewport = {
      x: initialViewport.x,
      y: initialViewport.y,
      width: initialViewport.width,
      height: initialViewport.height,
      zoom: initialViewport.zoom
    };

    this.drawingManager = new OptimizedDrawingManager(
      mainCanvas,
      initialConfig,
      drawingViewport
    );

    // Initialize large canvas rendering optimizations
    this.canvasRenderer = new OptimizedCanvasRenderer(displayCanvas, initialViewport);
    this.performanceMonitor = new LargeCanvasPerformanceMonitor();
  }

  /**
   * Update viewport (zoom/pan)
   */
  setViewport(viewport: ViewportInfo): void {
    this.viewport = viewport;

    // Update drawing manager viewport
    this.drawingManager.setViewport({
      x: viewport.x,
      y: viewport.y,
      width: viewport.width,
      height: viewport.height,
      zoom: viewport.zoom
    });

    // Update renderer viewport
    this.canvasRenderer.updateViewport(viewport);

    // Request full redraw with new viewport
    this.renderVisibleRegion();
  }

  /**
   * Render only the visible region to display canvas
   * CRITICAL: This is called after drawing operations complete
   */
  renderVisibleRegion(dirtyRect?: Rect): void {
    this.performanceMonitor.startFrame(this.viewport);

    // Render from main canvas to display canvas with viewport culling
    this.canvasRenderer.renderVisibleRegion(this.mainCanvas, dirtyRect);
  }

  /**
   * Start drawing operation
   */
  startDrawing(x: number, y: number, pressure: number = 1.0): void {
    // Convert screen coordinates to canvas coordinates
    const canvasCoords = ViewportCuller.screenToCanvas(x, y, this.viewport);
    this.drawingManager.startDrawing(canvasCoords.x, canvasCoords.y, pressure);
  }

  /**
   * Continue drawing operation
   */
  continueDrawing(x: number, y: number, pressure: number = 1.0): void {
    const canvasCoords = ViewportCuller.screenToCanvas(x, y, this.viewport);
    this.drawingManager.continueDrawing(canvasCoords.x, canvasCoords.y, pressure);
  }

  /**
   * End drawing operation and render result
   */
  endDrawing(commit: boolean = true): void {
    this.drawingManager.endDrawing(commit);

    // Render the updated region
    if (commit) {
      // Get dirty region from drawing manager
      const dirtyRegion = this.getDirtyRegion();
      this.renderVisibleRegion(dirtyRegion || undefined);
    }
  }

  /**
   * Get dirty region from last drawing operation
   */
  private getDirtyRegion(): Rect | null {
    // This would come from the drawing manager's dirty rectangle system
    // For now, return null to trigger full visible region render
    return null;
  }

  /**
   * Update drawing configuration
   */
  setDrawingConfig(config: Partial<DrawingConfig>): void {
    this.drawingManager.setConfig(config);
  }

  /**
   * Set active tool
   */
  setTool(toolName: string): void {
    this.drawingManager.setTool(toolName);
  }

  /**
   * Check if currently drawing
   */
  isDrawing(): boolean {
    return this.drawingManager.isDrawing();
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      largeCanvas: this.performanceMonitor.getMetrics(),
      drawing: {
        velocity: this.drawingManager.getVelocity()
      }
    };
  }

  /**
   * Get viewport culling percentage
   */
  getCullPercentage(): number {
    return this.performanceMonitor.getCullPercentage();
  }

  /**
   * Clear buffer pools (call when changing canvas size)
   */
  clearBufferPools(): void {
    RenderBufferPool.clearPool();
  }

  /**
   * Resize canvases
   */
  resize(width: number, height: number): void {
    this.mainCanvas.width = width;
    this.mainCanvas.height = height;
    this.drawingManager.resize(width, height);

    // Update viewport dimensions
    this.viewport.canvasWidth = width;
    this.viewport.canvasHeight = height;

    // Clear buffer pools
    this.clearBufferPools();

    // Render with new size
    this.renderVisibleRegion();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.drawingManager.destroy();
    this.clearBufferPools();
  }
}

/**
 * Helper functions for Canvas.tsx integration
 */

/**
 * Create viewport info from Canvas component state
 */
export function createViewportInfo(
  scrollX: number,
  scrollY: number,
  viewportWidth: number,
  viewportHeight: number,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number
): ViewportInfo {
  return {
    x: scrollX,
    y: scrollY,
    width: viewportWidth,
    height: viewportHeight,
    zoom,
    canvasWidth,
    canvasHeight
  };
}

/**
 * Calculate optimal viewport for canvas container
 */
export function calculateViewport(
  containerElement: HTMLElement,
  canvasWidth: number,
  canvasHeight: number,
  zoom: number,
  panX: number = 0,
  panY: number = 0
): ViewportInfo {
  const containerRect = containerElement.getBoundingClientRect();

  return {
    x: panX,
    y: panY,
    width: containerRect.width,
    height: containerRect.height,
    zoom,
    canvasWidth,
    canvasHeight
  };
}

/**
 * Layer culling helper for Canvas.tsx
 */
export function cullLayersForRendering(
  layers: any[],
  viewport: ViewportInfo
): any[] {
  const layerInfos: LayerInfo[] = layers.map(layer => ({
    visible: layer.visible,
    opacity: layer.opacity,
    bounds: {
      x: 0,
      y: 0,
      width: viewport.canvasWidth,
      height: viewport.canvasHeight
    }
  }));

  const visibleLayers = LayerCuller.cullLayers(layerInfos, viewport);

  // Return only layers that should be rendered
  return layers.filter((_, index) => {
    return layerInfos[index] && visibleLayers.includes(layerInfos[index]);
  });
}

/**
 * Get recommended zoom levels for large canvases
 * Prefer integer zoom levels for best performance
 */
export function getRecommendedZoomLevels(): number[] {
  return [
    // Scale down (integer ratios)
    0.0625,  // 1/16
    0.125,   // 1/8
    0.25,    // 1/4
    0.5,     // 1/2
    // No scale
    1.0,     // 1:1 (fastest)
    // Scale up (integer multiples)
    2.0,     // 2x
    3.0,     // 3x
    4.0,     // 4x
    8.0,     // 8x
    16.0     // 16x
  ];
}

/**
 * Get zoom type description for UI
 */
export function getZoomTypeDescription(zoom: number): string {
  const zoomType = ZoomOptimizer.detectZoomType(zoom);

  switch (zoomType) {
    case ZoomType.NO_SCALE:
      return '1:1 (Fastest - No Scaling)';
    case ZoomType.SCALE_UP_INTEGER:
      return `${zoom}x (Optimized - Integer Scale Up)`;
    case ZoomType.SCALE_DOWN_INTEGER:
      return `1/${Math.round(1 / zoom)} (Optimized - Integer Scale Down)`;
    case ZoomType.SCALE_GENERAL:
      return `${zoom.toFixed(2)}x (General - Fractional Zoom)`;
  }
}

/**
 * Performance tip generator
 */
export function getPerformanceTip(viewport: ViewportInfo): string | null {
  const zoomType = ZoomOptimizer.detectZoomType(viewport.zoom);

  // Suggest integer zoom for better performance
  if (zoomType === ZoomType.SCALE_GENERAL) {
    const nearestInteger = Math.round(viewport.zoom);
    if (nearestInteger > 0 && Math.abs(viewport.zoom - nearestInteger) < 0.2) {
      return `Tip: Use ${nearestInteger}x zoom for better performance`;
    }

    const nearestFraction = Math.round(1 / viewport.zoom);
    if (nearestFraction > 1) {
      const fractionZoom = 1 / nearestFraction;
      if (Math.abs(viewport.zoom - fractionZoom) < 0.05) {
        return `Tip: Use 1/${nearestFraction} zoom for better performance`;
      }
    }
  }

  return null;
}

/**
 * Export all large canvas utilities
 */
export {
  ViewportInfo,
  ViewportCuller,
  ZoomOptimizer,
  ZoomType,
  RenderBufferPool,
  LayerCuller,
  LayerInfo,
  OptimizedCanvasRenderer,
  LargeCanvasPerformanceMonitor,
  Rect
} from './largeCanvasOptimizations';
