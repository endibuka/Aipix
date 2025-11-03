import { invoke } from '@tauri-apps/api/core';

/**
 * Native Skia Renderer Bridge
 *
 * This provides a TypeScript interface to the native Skia rendering backend.
 * All rendering is done in Rust using GPU acceleration (OpenGL) for maximum performance.
 */
export class NativeSkiaRenderer {
  private width: number;
  private height: number;
  private initialized: boolean = false;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Initialize the native renderer
   */
  async init(): Promise<void> {
    await invoke('init_renderer', {
      width: this.width,
      height: this.height
    });
    this.initialized = true;
  }

  /**
   * Draw a stroke (pencil/brush)
   * @param points Array of [x, y] coordinates
   * @param brushSize Size of the brush in pixels
   * @param color Color in hex format (e.g., "#FF0000")
   * @param opacity Opacity from 0.0 to 1.0
   */
  async drawStroke(
    points: [number, number][],
    brushSize: number,
    color: string,
    opacity: number
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Renderer not initialized. Call init() first.');
    }

    await invoke('draw_stroke', {
      points,
      brushSize,
      color,
      opacity
    });
  }

  /**
   * Fill a rectangle
   * @param x X coordinate
   * @param y Y coordinate
   * @param width Width of rectangle
   * @param height Height of rectangle
   * @param color Color in hex format
   * @param opacity Opacity from 0.0 to 1.0
   */
  async fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    opacity: number
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Renderer not initialized. Call init() first.');
    }

    await invoke('fill_rect', {
      x,
      y,
      width,
      height,
      color,
      opacity
    });
  }

  /**
   * Render viewport with culling (only render visible pixels)
   * This is the KEY optimization for large canvases!
   *
   * @param viewportX X offset of viewport
   * @param viewportY Y offset of viewport
   * @param viewportWidth Width of viewport
   * @param viewportHeight Height of viewport
   * @param zoom Zoom level (1.0 = 100%)
   * @returns Pixel data as Uint8Array (RGBA format)
   */
  async renderViewport(
    viewportX: number,
    viewportY: number,
    viewportWidth: number,
    viewportHeight: number,
    zoom: number
  ): Promise<Uint8Array> {
    if (!this.initialized) {
      throw new Error('Renderer not initialized. Call init() first.');
    }

    const pixels = await invoke<number[]>('render_viewport', {
      viewportX,
      viewportY,
      viewportWidth,
      viewportHeight,
      zoom
    });

    return new Uint8Array(pixels);
  }

  /**
   * Get the full canvas image (use sparingly - prefer renderViewport!)
   * @returns Full canvas pixel data
   */
  async getCanvasImage(): Promise<Uint8Array> {
    if (!this.initialized) {
      throw new Error('Renderer not initialized. Call init() first.');
    }

    const pixels = await invoke<number[]>('get_canvas_image');
    return new Uint8Array(pixels);
  }

  /**
   * Clear the canvas with a solid color
   * @param color Color in hex format
   */
  async clearCanvas(color: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Renderer not initialized. Call init() first.');
    }

    await invoke('clear_canvas', { color });
  }

  /**
   * Resize the canvas
   * @param width New width
   * @param height New height
   */
  async resize(width: number, height: number): Promise<void> {
    if (!this.initialized) {
      throw new Error('Renderer not initialized. Call init() first.');
    }

    this.width = width;
    this.height = height;
    await invoke('resize_canvas', { width, height });
  }

  /**
   * Get dirty bounds (rectangle that needs redrawing)
   * Returns null if nothing is dirty
   */
  async getDirtyBounds(): Promise<{ x: number; y: number; width: number; height: number } | null> {
    if (!this.initialized) {
      throw new Error('Renderer not initialized. Call init() first.');
    }

    return await invoke('get_dirty_bounds');
  }

  /**
   * Clear the dirty region (call after rendering)
   */
  async clearDirtyRegion(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Renderer not initialized. Call init() first.');
    }

    await invoke('clear_dirty_region');
  }

  /**
   * Get canvas dimensions
   */
  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * Check if renderer is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
