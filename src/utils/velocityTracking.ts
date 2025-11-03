/**
 * Velocity Tracking and Stroke Smoothing - Aseprite Pattern
 *
 * Tracks mouse velocity for pressure-sensitive effects and
 * provides stroke stabilization for smoother drawing.
 */

export interface Point {
  x: number;
  y: number;
}

export interface VelocityVector {
  x: number;
  y: number;
  magnitude: number;
}

/**
 * Velocity Sensor - tracks and smooths mouse velocity
 */
export class VelocitySensor {
  private velocity: VelocityVector = { x: 0, y: 0, magnitude: 0 };
  private lastPosition: Point | null = null;
  private lastTimestamp: number = 0;
  private readonly kFullUpdateMSecs: number = 100; // Time constant for smoothing

  /**
   * Update velocity with a new position
   */
  updateWithPosition(x: number, y: number, timestamp?: number): VelocityVector {
    const now = timestamp ?? performance.now();

    if (this.lastPosition === null) {
      this.lastPosition = { x, y };
      this.lastTimestamp = now;
      return this.velocity;
    }

    const dt = now - this.lastTimestamp;
    if (dt <= 0) {
      return this.velocity;
    }

    // Calculate instantaneous velocity (pixels per millisecond)
    const dx = x - this.lastPosition.x;
    const dy = y - this.lastPosition.y;
    const newVelocity = {
      x: dx / dt,
      y: dy / dt,
      magnitude: Math.sqrt(dx * dx + dy * dy) / dt
    };

    // Exponential smoothing (Aseprite's algorithm)
    const a = Math.max(0, Math.min(1, dt / this.kFullUpdateMSecs));
    this.velocity.x = (1 - a) * this.velocity.x + a * newVelocity.x;
    this.velocity.y = (1 - a) * this.velocity.y + a * newVelocity.y;
    this.velocity.magnitude = Math.sqrt(
      this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y
    );

    this.lastPosition = { x, y };
    this.lastTimestamp = now;

    return this.velocity;
  }

  /**
   * Get current velocity
   */
  getVelocity(): VelocityVector {
    return { ...this.velocity };
  }

  /**
   * Get velocity magnitude (speed)
   */
  getSpeed(): number {
    return this.velocity.magnitude;
  }

  /**
   * Reset velocity tracking
   */
  reset(): void {
    this.velocity = { x: 0, y: 0, magnitude: 0 };
    this.lastPosition = null;
    this.lastTimestamp = 0;
  }
}

/**
 * Stroke Stabilizer - smooths input for steadier strokes
 */
export class StrokeStabilizer {
  private center: Point = { x: 0, y: 0 };
  private factor: number = 1.0; // 1.0 = no stabilization, higher = more stabilization
  private initialized: boolean = false;

  constructor(factor: number = 1.0) {
    this.factor = Math.max(1.0, factor);
  }

  /**
   * Set stabilization factor (1.0 = none, higher = more stabilization)
   */
  setFactor(factor: number): void {
    this.factor = Math.max(1.0, factor);
  }

  /**
   * Get current factor
   */
  getFactor(): number {
    return this.factor;
  }

  /**
   * Process a point through the stabilizer
   */
  stabilize(x: number, y: number): Point {
    if (!this.initialized || this.factor <= 1.0) {
      this.center = { x, y };
      this.initialized = true;
      return { x, y };
    }

    // Calculate vector from center to new point
    const dx = x - this.center.x;
    const dy = y - this.center.y;

    // Calculate distance
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 0.001) {
      return { ...this.center };
    }

    // Calculate angle
    const angle = Math.atan2(dy, dx);

    // Apply stabilization - move towards target point with dampening
    const newX = this.center.x + (distance / this.factor) * Math.cos(angle);
    const newY = this.center.y + (distance / this.factor) * Math.sin(angle);

    // Update center for next iteration
    this.center = { x: newX, y: newY };

    return { x: newX, y: newY };
  }

  /**
   * Reset stabilizer
   */
  reset(): void {
    this.initialized = false;
    this.center = { x: 0, y: 0 };
  }

  /**
   * Check if stabilization is enabled
   */
  isEnabled(): boolean {
    return this.factor > 1.0;
  }
}

/**
 * Combined stroke processor with velocity tracking and stabilization
 */
export class StrokeProcessor {
  private velocitySensor: VelocitySensor;
  private stabilizer: StrokeStabilizer;
  private lastProcessedPoint: Point | null = null;

  constructor(stabilizationFactor: number = 1.0) {
    this.velocitySensor = new VelocitySensor();
    this.stabilizer = new StrokeStabilizer(stabilizationFactor);
  }

  /**
   * Process a stroke point with velocity tracking and stabilization
   */
  processPoint(x: number, y: number, timestamp?: number): {
    point: Point;
    velocity: VelocityVector;
    originalPoint: Point;
  } {
    const originalPoint = { x, y };

    // Update velocity with original point
    const velocity = this.velocitySensor.updateWithPosition(x, y, timestamp);

    // Apply stabilization
    const stabilizedPoint = this.stabilizer.stabilize(x, y);

    this.lastProcessedPoint = stabilizedPoint;

    return {
      point: stabilizedPoint,
      velocity,
      originalPoint
    };
  }

  /**
   * Set stabilization factor
   */
  setStabilization(factor: number): void {
    this.stabilizer.setFactor(factor);
  }

  /**
   * Get current stabilization factor
   */
  getStabilization(): number {
    return this.stabilizer.getFactor();
  }

  /**
   * Get current velocity
   */
  getVelocity(): VelocityVector {
    return this.velocitySensor.getVelocity();
  }

  /**
   * Get last processed point
   */
  getLastPoint(): Point | null {
    return this.lastProcessedPoint;
  }

  /**
   * Reset all processing state
   */
  reset(): void {
    this.velocitySensor.reset();
    this.stabilizer.reset();
    this.lastProcessedPoint = null;
  }

  /**
   * Check if stabilization is enabled
   */
  isStabilizationEnabled(): boolean {
    return this.stabilizer.isEnabled();
  }
}

/**
 * Simple point smoothing using running average
 */
export class PointSmoother {
  private points: Point[] = [];
  private windowSize: number;

  constructor(windowSize: number = 3) {
    this.windowSize = Math.max(1, windowSize);
  }

  /**
   * Add a point and get smoothed result
   */
  smooth(x: number, y: number): Point {
    this.points.push({ x, y });

    // Keep only last N points
    if (this.points.length > this.windowSize) {
      this.points.shift();
    }

    // Calculate average
    let sumX = 0;
    let sumY = 0;
    for (const point of this.points) {
      sumX += point.x;
      sumY += point.y;
    }

    return {
      x: sumX / this.points.length,
      y: sumY / this.points.length
    };
  }

  /**
   * Reset smoother
   */
  reset(): void {
    this.points = [];
  }

  /**
   * Set window size
   */
  setWindowSize(size: number): void {
    this.windowSize = Math.max(1, size);
    if (this.points.length > this.windowSize) {
      this.points = this.points.slice(-this.windowSize);
    }
  }
}
