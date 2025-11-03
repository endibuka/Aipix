/**
 * Dirty Rectangle System - Aseprite Pattern
 *
 * Tracks and manages dirty regions that need redrawing,
 * minimizing unnecessary render operations.
 */

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class DirtyRectangleManager {
  private dirtyRects: Rectangle[] = [];
  private viewport: Rectangle | null = null;
  private isDirty: boolean = false;

  /**
   * Set the viewport bounds for limiting dirty regions during preview
   */
  setViewport(viewport: Rectangle): void {
    this.viewport = viewport;
  }

  /**
   * Add a dirty rectangle
   */
  addDirtyRect(rect: Rectangle): void {
    if (rect.width <= 0 || rect.height <= 0) return;

    this.dirtyRects.push({ ...rect });
    this.isDirty = true;
  }

  /**
   * Add a point with brush size as dirty region
   */
  addDirtyPoint(x: number, y: number, brushSize: number): void {
    const halfSize = Math.ceil(brushSize / 2);
    this.addDirtyRect({
      x: x - halfSize,
      y: y - halfSize,
      width: brushSize,
      height: brushSize
    });
  }

  /**
   * Add a stroke line segment as dirty region
   */
  addDirtyLine(x1: number, y1: number, x2: number, y2: number, brushSize: number): void {
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const maxX = Math.max(x1, x2);
    const maxY = Math.max(y1, y2);

    const halfSize = Math.ceil(brushSize / 2);

    this.addDirtyRect({
      x: minX - halfSize,
      y: minY - halfSize,
      width: (maxX - minX) + brushSize,
      height: (maxY - minY) + brushSize
    });
  }

  /**
   * Expand a rectangle by a given amount (for brush size, etc.)
   */
  private expandRect(rect: Rectangle, amount: number): Rectangle {
    return {
      x: rect.x - amount,
      y: rect.y - amount,
      width: rect.width + amount * 2,
      height: rect.height + amount * 2
    };
  }

  /**
   * Merge two rectangles into their union
   */
  private mergeRects(a: Rectangle, b: Rectangle): Rectangle {
    const minX = Math.min(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxX = Math.max(a.x + a.width, b.x + b.width);
    const maxY = Math.max(a.y + a.height, b.y + b.height);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Check if two rectangles overlap
   */
  private rectsOverlap(a: Rectangle, b: Rectangle): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    );
  }

  /**
   * Clip a rectangle to viewport bounds
   */
  private clipToViewport(rect: Rectangle): Rectangle | null {
    if (!this.viewport) return rect;

    const x1 = Math.max(rect.x, this.viewport.x);
    const y1 = Math.max(rect.y, this.viewport.y);
    const x2 = Math.min(rect.x + rect.width, this.viewport.x + this.viewport.width);
    const y2 = Math.min(rect.y + rect.height, this.viewport.y + this.viewport.height);

    if (x2 <= x1 || y2 <= y1) {
      return null; // Rectangle is completely outside viewport
    }

    return {
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1
    };
  }

  /**
   * Get the unified dirty region (all rects merged)
   * Optionally limit to viewport for preview mode
   */
  getDirtyRegion(limitToViewport: boolean = false): Rectangle | null {
    if (this.dirtyRects.length === 0) return null;

    // Merge all dirty rectangles
    let merged = this.dirtyRects[0];
    for (let i = 1; i < this.dirtyRects.length; i++) {
      merged = this.mergeRects(merged, this.dirtyRects[i]);
    }

    // Clip to viewport if requested (for preview mode)
    if (limitToViewport && this.viewport) {
      return this.clipToViewport(merged);
    }

    return merged;
  }

  /**
   * Get optimized dirty rectangles (merged overlapping rects)
   */
  getOptimizedDirtyRects(limitToViewport: boolean = false): Rectangle[] {
    if (this.dirtyRects.length === 0) return [];

    // Simple merge strategy: merge overlapping rectangles
    const merged: Rectangle[] = [];

    for (const rect of this.dirtyRects) {
      let didMerge = false;

      for (let i = 0; i < merged.length; i++) {
        if (this.rectsOverlap(merged[i], rect)) {
          merged[i] = this.mergeRects(merged[i], rect);
          didMerge = true;
          break;
        }
      }

      if (!didMerge) {
        merged.push({ ...rect });
      }
    }

    // Clip to viewport if requested
    if (limitToViewport && this.viewport) {
      return merged
        .map(rect => this.clipToViewport(rect))
        .filter((rect): rect is Rectangle => rect !== null);
    }

    return merged;
  }

  /**
   * Clear all dirty rectangles
   */
  clear(): void {
    this.dirtyRects = [];
    this.isDirty = false;
  }

  /**
   * Check if there are any dirty regions
   */
  hasDirtyRegions(): boolean {
    return this.isDirty && this.dirtyRects.length > 0;
  }

  /**
   * Get the total number of dirty rectangles
   */
  getDirtyRectCount(): number {
    return this.dirtyRects.length;
  }
}
