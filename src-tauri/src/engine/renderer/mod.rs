// Native Skia-based renderer module (Aseprite pattern)
//
// This replaces WebGL/Canvas2D with native GPU-accelerated rendering
// using the Skia graphics library, just like Aseprite does.

pub mod dirty_region;
pub mod pixel_renderer;

pub use dirty_region::{DirtyRegion, Rect};
pub use pixel_renderer::PixelRenderer;
