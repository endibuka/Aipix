// Core pixel art engine
// This module will handle pixel buffers, layers, frames, and core rendering logic

pub mod pixel_buffer;
pub mod layer;
pub mod animation;
pub mod tools;
pub mod history;
pub mod renderer;  // Native Skia renderer (replaces WebGL)

pub use pixel_buffer::PixelBuffer;
pub use layer::Layer;
pub use animation::Frame;
pub use history::CanvasHistory;
pub use tools::{Selection, SelectionMode, SelectionBounds};
pub use renderer::{PixelRenderer, DirtyRegion, Rect};
