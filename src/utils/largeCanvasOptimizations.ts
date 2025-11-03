/**
 * Large Canvas Optimizations - Aseprite Pattern
 *
 * Critical optimizations for handling large canvases (4K, 8K, etc.)
 * Based on Aseprite's viewport culling and zoom-optimized rendering
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Viewport Culling - Only render visible area (CRITICAL for large canvases)
 */
export class ViewportCuller {
  /**
   * Get the visible sprite bounds (intersection of viewport and canvas)
   * This is THE key optimization - never render outside this area!
   */
  static getVisibleSpriteBounds(viewport: ViewportInfo): Rect {
    // Convert viewport screen coordinates to canvas coordinates
    const canvasX = viewport.x / viewport.zoom;
    const canvasY = viewport.y / viewport.zoom;
    const canvasW = viewport.width / viewport.zoom;
    const canvasH = viewport.height / viewport.zoom;

    // Clamp to actual canvas bounds
    const x = Math.max(0, Math.floor(canvasX));
    const y = Math.max(0, Math.floor(canvasY));
    const maxX = Math.min(viewport.canvasWidth, Math.ceil(canvasX + canvasW));
    const maxY = Math.min(viewport.canvasHeight, Math.ceil(canvasY + canvasH));

    return {
      x,
      y,
      width: Math.max(0, maxX - x),
      height: Math.max(0, maxY - y)
    };
  }

  /**
   * Check if a rectangle is visible in the viewport
   */
  static isRectVisible(rect: Rect, viewport: ViewportInfo): boolean {
    const visibleBounds = this.getVisibleSpriteBounds(viewport);
    return this.rectsIntersect(rect, visibleBounds);
  }

  /**
   * Check if two rectangles intersect
   */
  static rectsIntersect(a: Rect, b: Rect): boolean {
    return !(
      a.x + a.width <= b.x ||
      b.x + b.width <= a.x ||
      a.y + a.height <= b.y ||
      b.y + b.height <= a.y
    );
  }

  /**
   * Get intersection of two rectangles
   */
  static rectIntersection(a: Rect, b: Rect): Rect | null {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const maxX = Math.min(a.x + a.width, b.x + b.width);
    const maxY = Math.min(a.y + a.height, b.y + b.height);

    if (maxX <= x || maxY <= y) {
      return null;
    }

    return {
      x,
      y,
      width: maxX - x,
      height: maxY - y
    };
  }

  /**
   * Convert canvas coordinates to screen coordinates
   */
  static canvasToScreen(x: number, y: number, viewport: ViewportInfo): { x: number; y: number } {
    return {
      x: (x * viewport.zoom) - viewport.x,
      y: (y * viewport.zoom) - viewport.y
    };
  }

  /**
   * Convert screen coordinates to canvas coordinates
   */
  static screenToCanvas(x: number, y: number, viewport: ViewportInfo): { x: number; y: number } {
    return {
      x: (x + viewport.x) / viewport.zoom,
      y: (y + viewport.y) / viewport.zoom
    };
  }
}

/**
 * Zoom-Optimized Rendering Paths (Aseprite pattern)
 * Different algorithms for different zoom levels for maximum performance
 */
export enum ZoomType {
  NO_SCALE = 'no_scale',           // 1:1 - fastest path
  SCALE_UP_INTEGER = 'scale_up',   // 2x, 3x, 4x - optimized
  SCALE_DOWN_INTEGER = 'scale_down', // 1/2, 1/3, 1/4 - optimized
  SCALE_GENERAL = 'general'         // Fractional - general case
}

export class ZoomOptimizer {
  /**
   * Detect zoom type for optimization path selection
   */
  static detectZoomType(zoom: number): ZoomType {
    // 1:1 zoom - fastest path (direct copy)
    if (zoom === 1.0) {
      return ZoomType.NO_SCALE;
    }

    // Integer scale up (2x, 3x, 4x, etc.)
    if (zoom > 1.0 && Number.isInteger(zoom)) {
      return ZoomType.SCALE_UP_INTEGER;
    }

    // Integer scale down (1/2, 1/3, 1/4, etc.)
    if (zoom < 1.0 && zoom > 0) {
      const inverse = 1.0 / zoom;
      if (Number.isInteger(inverse)) {
        return ZoomType.SCALE_DOWN_INTEGER;
      }
    }

    // General case (fractional zoom)
    return ZoomType.SCALE_GENERAL;
  }

  /**
   * Check if zoom is simple (1:1 or integer ratio)
   */
  static isSimpleZoom(zoom: number): boolean {
    const type = this.detectZoomType(zoom);
    return type !== ZoomType.SCALE_GENERAL;
  }

  /**
   * Get the step size for scale down optimization
   */
  static getScaleDownStep(zoom: number): number {
    return Math.floor(1.0 / zoom);
  }

  /**
   * Get the repeat count for scale up optimization
   */
  static getScaleUpRepeat(zoom: number): number {
    return Math.floor(zoom);
  }
}

/**
 * Render Buffer Pool - Avoid allocations during rendering (Aseprite pattern)
 */
export class RenderBufferPool {
  private static buffers: Map<string, ImageData> = new Map();
  private static maxBuffers: number = 5;

  /**
   * Get or create a buffer of the specified size
   * Reuses existing buffer if large enough
   */
  static getBuffer(width: number, height: number, ctx: CanvasRenderingContext2D): ImageData {
    const key = `${width}x${height}`;
    let buffer = this.buffers.get(key);

    if (!buffer) {
      // Create new buffer
      buffer = ctx.createImageData(width, height);
      this.buffers.set(key, buffer);

      // Limit buffer count to prevent memory bloat
      if (this.buffers.size > this.maxBuffers) {
        // Remove oldest buffer
        const firstKey = this.buffers.keys().next().value;
        this.buffers.delete(firstKey);
      }
    }

    return buffer;
  }

  /**
   * Get a buffer that's at least the specified size
   * May return a larger buffer to avoid reallocation
   */
  static getBufferAtLeast(width: number, height: number, ctx: CanvasRenderingContext2D): ImageData {
    const neededSize = width * height;

    // Find an existing buffer that's large enough
    for (const [key, buffer] of this.buffers) {
      if (buffer.width * buffer.height >= neededSize) {
        return buffer;
      }
    }

    // Create new buffer
    return this.getBuffer(width, height, ctx);
  }

  /**
   * Clear all pooled buffers
   */
  static clearPool(): void {
    this.buffers.clear();
  }

  /**
   * Get pool statistics
   */
  static getStats(): { count: number; totalSize: number } {
    let totalSize = 0;
    for (const buffer of this.buffers.values()) {
      totalSize += buffer.width * buffer.height * 4;
    }
    return {
      count: this.buffers.size,
      totalSize
    };
  }
}

/**
 * Layer Culling - Skip rendering of invisible/transparent layers
 */
export interface LayerInfo {
  visible: boolean;
  opacity: number;
  bounds: Rect;
}

export class LayerCuller {
  /**
   * Check if layer should be rendered
   */
  static shouldRenderLayer(layer: LayerInfo, viewport: ViewportInfo): boolean {
    // Skip invisible layers
    if (!layer.visible) {
      return false;
    }

    // Skip fully transparent layers
    if (layer.opacity === 0) {
      return false;
    }

    // Skip layers completely outside viewport
    if (!ViewportCuller.isRectVisible(layer.bounds, viewport)) {
      return false;
    }

    return true;
  }

  /**
   * Filter layers to only those that need rendering
   */
  static cullLayers(layers: LayerInfo[], viewport: ViewportInfo): LayerInfo[] {
    return layers.filter(layer => this.shouldRenderLayer(layer, viewport));
  }
}

/**
 * Optimized Canvas Renderer - Combines all large canvas optimizations
 */
export class OptimizedCanvasRenderer {
  private viewport: ViewportInfo;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement, viewport: ViewportInfo) {
    const ctx = canvas.getContext('2d', {
      willReadFrequently: false,
      alpha: true
    });
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    this.ctx = ctx;
    this.viewport = viewport;
  }

  /**
   * Update viewport (call on zoom/pan)
   */
  updateViewport(viewport: ViewportInfo): void {
    this.viewport = viewport;
  }

  /**
   * Render only the visible region with zoom optimization
   */
  renderVisibleRegion(
    sourceCanvas: HTMLCanvasElement,
    dirtyRect?: Rect
  ): void {
    // Get visible bounds
    const visibleBounds = ViewportCuller.getVisibleSpriteBounds(this.viewport);

    // If dirty rect provided, intersect with visible bounds
    const renderBounds = dirtyRect
      ? ViewportCuller.rectIntersection(dirtyRect, visibleBounds)
      : visibleBounds;

    if (!renderBounds) {
      return; // Nothing to render
    }

    // Detect zoom type
    const zoomType = ZoomOptimizer.detectZoomType(this.viewport.zoom);

    // Use optimized rendering path based on zoom
    switch (zoomType) {
      case ZoomType.NO_SCALE:
        this.renderNoScale(sourceCanvas, renderBounds);
        break;

      case ZoomType.SCALE_UP_INTEGER:
        this.renderScaleUpInteger(sourceCanvas, renderBounds);
        break;

      case ZoomType.SCALE_DOWN_INTEGER:
        this.renderScaleDownInteger(sourceCanvas, renderBounds);
        break;

      case ZoomType.SCALE_GENERAL:
        this.renderScaleGeneral(sourceCanvas, renderBounds);
        break;
    }
  }

  /**
   * Optimized path 1: No scaling (1:1 zoom) - FASTEST
   */
  private renderNoScale(source: HTMLCanvasElement, bounds: Rect): void {
    // Direct pixel copy - no scaling calculations
    this.ctx.drawImage(
      source,
      bounds.x, bounds.y, bounds.width, bounds.height,
      bounds.x - this.viewport.x, bounds.y - this.viewport.y, bounds.width, bounds.height
    );
  }

  /**
   * Optimized path 2: Integer scale up (2x, 3x, 4x) - OPTIMIZED
   * Use imageSmoothingEnabled = false for pixel-perfect scaling
   */
  private renderScaleUpInteger(source: HTMLCanvasElement, bounds: Rect): void {
    const scale = this.viewport.zoom;

    // Disable smoothing for pixel-perfect scaling
    this.ctx.imageSmoothingEnabled = false;

    this.ctx.drawImage(
      source,
      bounds.x, bounds.y, bounds.width, bounds.height,
      (bounds.x * scale) - this.viewport.x,
      (bounds.y * scale) - this.viewport.y,
      bounds.width * scale,
      bounds.height * scale
    );

    this.ctx.imageSmoothingEnabled = true;
  }

  /**
   * Optimized path 3: Integer scale down (1/2, 1/3, 1/4) - OPTIMIZED
   */
  private renderScaleDownInteger(source: HTMLCanvasElement, bounds: Rect): void {
    const scale = this.viewport.zoom;

    // Use high-quality smoothing for scale down
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    this.ctx.drawImage(
      source,
      bounds.x, bounds.y, bounds.width, bounds.height,
      (bounds.x * scale) - this.viewport.x,
      (bounds.y * scale) - this.viewport.y,
      bounds.width * scale,
      bounds.height * scale
    );
  }

  /**
   * General path: Fractional zoom - FALLBACK
   */
  private renderScaleGeneral(source: HTMLCanvasElement, bounds: Rect): void {
    const scale = this.viewport.zoom;

    // Use medium quality for balance
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'medium';

    this.ctx.drawImage(
      source,
      bounds.x, bounds.y, bounds.width, bounds.height,
      (bounds.x * scale) - this.viewport.x,
      (bounds.y * scale) - this.viewport.y,
      bounds.width * scale,
      bounds.height * scale
    );
  }

  /**
   * Get context for manual rendering
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }
}

/**
 * Performance monitor for large canvas rendering
 */
export class LargeCanvasPerformanceMonitor {
  private metrics = {
    visiblePixels: 0,
    totalPixels: 0,
    cullRatio: 0,
    renderTime: 0,
    zoomType: ZoomType.NO_SCALE
  };

  startFrame(viewport: ViewportInfo): void {
    const visibleBounds = ViewportCuller.getVisibleSpriteBounds(viewport);
    this.metrics.visiblePixels = visibleBounds.width * visibleBounds.height;
    this.metrics.totalPixels = viewport.canvasWidth * viewport.canvasHeight;
    this.metrics.cullRatio = 1 - (this.metrics.visiblePixels / this.metrics.totalPixels);
    this.metrics.zoomType = ZoomOptimizer.detectZoomType(viewport.zoom);
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getCullPercentage(): number {
    return this.metrics.cullRatio * 100;
  }
}
