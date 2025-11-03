/**
 * Drawing Optimizations - Entry Point
 *
 * Main export file for all Aseprite-inspired drawing optimizations.
 * Import from this file to use the optimizations in your components.
 */

// Core systems
export { PreviewCanvas } from './previewCanvas';
export type { PreviewCanvasOptions } from './previewCanvas';

export { DirtyRectangleManager } from './dirtyRectangle';
export type { Rectangle } from './dirtyRectangle';

export {
  DelayedMouseMove,
  MouseEventBatcher,
  ToolType
} from './mouseEventCoalescing';
export type { MouseEventData, MouseEventCallback } from './mouseEventCoalescing';

export {
  VelocitySensor,
  StrokeStabilizer,
  StrokeProcessor,
  PointSmoother
} from './velocityTracking';
export type { Point, VelocityVector } from './velocityTracking';

export {
  DrawingStateMachine,
  DrawingState,
  TracePolicy
} from './drawingStateMachine';
export type { ToolConfig, Viewport } from './drawingStateMachine';

// High-level manager
export {
  OptimizedDrawingManager,
  createOptimizedDrawingManager
} from './optimizedDrawingManager';
export type { DrawingConfig, DrawCallback } from './optimizedDrawingManager';

// Integration helpers
export {
  initializeOptimizedDrawing,
  handleOptimizedMouseDown,
  handleOptimizedMouseMove,
  handleOptimizedMouseUp,
  updateViewport,
  updateDrawingConfig,
  switchTool,
  DrawingPerformanceMonitor
} from './canvasOptimizationIntegration';
export type { CanvasOptimizationRefs } from './canvasOptimizationIntegration';

// Testing
export {
  runAllTests,
  printTestResults,
  runTestSuite,
  testPreviewCanvas,
  testDirtyRectangles,
  testVelocityTracking,
  testStrokeStabilization,
  testMouseEventCoalescing,
  testStrokeProcessor
} from './optimizationTests';
export type { TestResult } from './optimizationTests';

/**
 * Quick Start Example:
 *
 * ```typescript
 * import {
 *   OptimizedDrawingManager,
 *   DrawingConfig,
 *   Viewport
 * } from './utils/drawingOptimizations';
 *
 * // In your component:
 * const viewport: Viewport = {
 *   x: 0, y: 0,
 *   width: canvas.width,
 *   height: canvas.height,
 *   zoom: 1.0
 * };
 *
 * const config: DrawingConfig = {
 *   brushSize: 5,
 *   brushColor: '#000000',
 *   opacity: 100,
 *   stabilization: 1.5,
 *   usePreview: false
 * };
 *
 * const manager = new OptimizedDrawingManager(canvas, config, viewport);
 *
 * // Mouse handlers:
 * onMouseDown = (e) => {
 *   const {x, y} = getMousePos(e);
 *   manager.startDrawing(x, y, e.pressure || 1.0);
 * };
 *
 * onMouseMove = (e) => {
 *   if (!manager.isDrawing()) return;
 *   const {x, y} = getMousePos(e);
 *   manager.continueDrawing(x, y, e.pressure || 1.0);
 * };
 *
 * onMouseUp = () => {
 *   manager.endDrawing(true); // commit
 * };
 * ```
 */

/**
 * Performance Tuning Guide:
 *
 * 1. **Stabilization**: Higher values = smoother but more lag
 *    - 1.0: No smoothing (raw input)
 *    - 1.5-2.0: Light smoothing (recommended)
 *    - 2.5-3.5: Medium smoothing (tablets)
 *    - 4.0+: Heavy smoothing (shaky input)
 *
 * 2. **Tool Type**:
 *    - FREEHAND: 0ms delay, immediate response
 *    - SHAPE: 5ms delay, coalesces events
 *
 * 3. **Preview Mode**:
 *    - Enable for shape tools (line, rectangle, etc.)
 *    - Disable for freehand (pencil, brush)
 *
 * 4. **Viewport Optimization**:
 *    - Update viewport on zoom/pan
 *    - Limits dirty regions to visible area
 *    - Critical for large canvases
 */

/**
 * Architecture Overview:
 *
 *                    ┌─────────────────────────┐
 *                    │  Canvas Component       │
 *                    └───────────┬─────────────┘
 *                                │
 *                                ▼
 *                    ┌─────────────────────────┐
 *                    │ OptimizedDrawingManager │ ◄── High-level API
 *                    └───────────┬─────────────┘
 *                                │
 *                ┌───────────────┼───────────────┐
 *                ▼               ▼               ▼
 *     ┌──────────────┐  ┌───────────────┐  ┌──────────────┐
 *     │ Preview      │  │ State Machine │  │ Dirty Rects  │
 *     │ Canvas       │  │               │  │ Manager      │
 *     └──────────────┘  └───────┬───────┘  └──────────────┘
 *                               │
 *                   ┌───────────┼───────────┐
 *                   ▼           ▼           ▼
 *          ┌────────────┐ ┌──────────┐ ┌──────────────┐
 *          │ Velocity   │ │ Delayed  │ │ Stroke       │
 *          │ Tracking   │ │ Mouse    │ │ Stabilizer   │
 *          └────────────┘ └──────────┘ └──────────────┘
 *
 * Each layer is independent and can be used separately or combined.
 */
