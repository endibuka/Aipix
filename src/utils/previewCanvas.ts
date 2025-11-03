/**
 * Preview Canvas System - Aseprite Pattern
 *
 * Provides a separate preview layer for real-time drawing feedback
 * without modifying the actual canvas until commit.
 */

export interface PreviewCanvasOptions {
  width: number;
  height: number;
}

export class PreviewCanvas {
  private previewCanvas: HTMLCanvasElement;
  private previewCtx: CanvasRenderingContext2D;
  private isActive: boolean = false;

  constructor(options: PreviewCanvasOptions) {
    this.previewCanvas = document.createElement('canvas');
    this.previewCanvas.width = options.width;
    this.previewCanvas.height = options.height;

    const ctx = this.previewCanvas.getContext('2d', {
      willReadFrequently: false,
      alpha: true
    });

    if (!ctx) {
      throw new Error('Failed to create preview canvas context');
    }

    this.previewCtx = ctx;
  }

  /**
   * Start a preview operation - clears the preview canvas
   */
  start(): void {
    this.isActive = true;
    this.clear();
  }

  /**
   * Clear the preview canvas
   */
  clear(): void {
    this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
  }

  /**
   * Get the preview canvas for drawing operations
   */
  getCanvas(): HTMLCanvasElement {
    return this.previewCanvas;
  }

  /**
   * Get the preview context for drawing
   */
  getContext(): CanvasRenderingContext2D {
    return this.previewCtx;
  }

  /**
   * Commit the preview to a target canvas
   */
  commit(targetCtx: CanvasRenderingContext2D, x: number = 0, y: number = 0): void {
    if (this.isActive) {
      targetCtx.drawImage(this.previewCanvas, x, y);
      this.end();
    }
  }

  /**
   * End preview without committing (rollback)
   */
  end(): void {
    this.isActive = false;
    this.clear();
  }

  /**
   * Check if preview is currently active
   */
  active(): boolean {
    return this.isActive;
  }

  /**
   * Resize the preview canvas
   */
  resize(width: number, height: number): void {
    this.previewCanvas.width = width;
    this.previewCanvas.height = height;
  }

  /**
   * Render preview on top of target canvas (non-destructive)
   */
  renderPreview(targetCtx: CanvasRenderingContext2D, x: number = 0, y: number = 0): void {
    if (this.isActive) {
      targetCtx.drawImage(this.previewCanvas, x, y);
    }
  }
}
