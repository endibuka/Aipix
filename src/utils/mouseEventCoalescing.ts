/**
 * Mouse Event Coalescing - Aseprite Pattern
 *
 * Groups rapid mouse events together to prevent redundant redraws.
 * Uses configurable delay based on tool type.
 */

export interface MouseEventData {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

export type MouseEventCallback = (event: MouseEventData) => void;

export enum ToolType {
  FREEHAND = 'freehand',  // 0ms delay - immediate response
  SHAPE = 'shape'          // 5ms delay - coalesce events
}

export class DelayedMouseMove {
  private lastEvent: MouseEventData | null = null;
  private timer: number | null = null;
  private callback: MouseEventCallback;
  private delay: number;
  private lastProcessedPosition: { x: number; y: number } | null = null;

  constructor(callback: MouseEventCallback, toolType: ToolType = ToolType.FREEHAND) {
    this.callback = callback;
    this.delay = toolType === ToolType.FREEHAND ? 0 : 5; // 5ms for shape tools, 0ms for freehand
  }

  /**
   * Update the tool type and adjust delay accordingly
   */
  setToolType(toolType: ToolType): void {
    this.delay = toolType === ToolType.FREEHAND ? 0 : 5;
  }

  /**
   * Handle a mouse move event
   */
  onMouseMove(x: number, y: number, pressure: number = 1.0): void {
    const event: MouseEventData = {
      x,
      y,
      pressure,
      timestamp: performance.now()
    };

    this.lastEvent = event;

    // Clear existing timer
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }

    if (this.delay === 0) {
      // Immediate processing for freehand tools
      this.processEvent(event);
    } else {
      // Delayed processing for shape tools
      this.timer = window.setTimeout(() => {
        if (this.lastEvent) {
          this.processEvent(this.lastEvent);
        }
      }, this.delay);
    }
  }

  /**
   * Process the event - only if position has changed
   */
  private processEvent(event: MouseEventData): void {
    // Only process if position has changed (avoid redundant redraws)
    if (
      this.lastProcessedPosition &&
      this.lastProcessedPosition.x === event.x &&
      this.lastProcessedPosition.y === event.y
    ) {
      return;
    }

    this.lastProcessedPosition = { x: event.x, y: event.y };
    this.callback(event);
  }

  /**
   * Flush any pending events immediately
   */
  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.lastEvent) {
      this.processEvent(this.lastEvent);
    }
  }

  /**
   * Clear any pending events without processing
   */
  clear(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.lastEvent = null;
    this.lastProcessedPosition = null;
  }

  /**
   * Get the last event data
   */
  getLastEvent(): MouseEventData | null {
    return this.lastEvent;
  }
}

/**
 * Mouse Event Batcher - collects multiple events and processes them in batches
 */
export class MouseEventBatcher {
  private events: MouseEventData[] = [];
  private callback: (events: MouseEventData[]) => void;
  private batchSize: number;
  private timer: number | null = null;
  private maxDelay: number;

  constructor(
    callback: (events: MouseEventData[]) => void,
    batchSize: number = 5,
    maxDelay: number = 16 // ~60fps
  ) {
    this.callback = callback;
    this.batchSize = batchSize;
    this.maxDelay = maxDelay;
  }

  /**
   * Add an event to the batch
   */
  addEvent(x: number, y: number, pressure: number = 1.0): void {
    this.events.push({
      x,
      y,
      pressure,
      timestamp: performance.now()
    });

    // Process immediately if batch is full
    if (this.events.length >= this.batchSize) {
      this.flush();
      return;
    }

    // Otherwise, schedule processing
    if (this.timer === null) {
      this.timer = window.setTimeout(() => {
        this.flush();
      }, this.maxDelay);
    }
  }

  /**
   * Process all pending events
   */
  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.events.length > 0) {
      this.callback([...this.events]);
      this.events = [];
    }
  }

  /**
   * Clear all pending events without processing
   */
  clear(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.events = [];
  }

  /**
   * Get the number of pending events
   */
  getPendingCount(): number {
    return this.events.length;
  }
}
