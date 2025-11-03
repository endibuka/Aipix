// Simplified Pixel Renderer - Thread-Safe for Tauri
//
// Instead of storing Skia surfaces (which aren't Send/Sync), we store
// raw pixel buffers and create Skia surfaces on-demand for rendering.

use super::dirty_region::{DirtyRegion, Rect};
use anyhow::{Context, Result};
use skia_safe::{Color, ImageInfo, Paint, Path, ColorType, AlphaType, surfaces};

/// Thread-safe pixel buffer renderer
pub struct PixelRenderer {
    /// Raw pixel data (RGBA8888)
    pixels: Vec<u8>,

    /// Canvas dimensions
    width: i32,
    height: i32,

    /// Dirty region tracking
    dirty_region: DirtyRegion,
}

// Implement Send + Sync for Tauri compatibility
unsafe impl Send for PixelRenderer {}
unsafe impl Sync for PixelRenderer {}

impl PixelRenderer {
    /// Create a new pixel renderer
    pub fn new(width: i32, height: i32) -> Result<Self> {
        let pixel_count = (width * height * 4) as usize; // RGBA = 4 bytes per pixel
        let pixels = vec![255u8; pixel_count]; // White background

        Ok(Self {
            pixels,
            width,
            height,
            dirty_region: DirtyRegion::new(),
        })
    }

    /// Draw a stroke (brush/pencil)
    pub fn draw_stroke(
        &mut self,
        points: &[(f32, f32)],
        brush_size: f32,
        color: Color,
        opacity: f32,
    ) -> Result<()> {
        if points.is_empty() {
            return Ok(());
        }

        // Create temporary Skia surface from our pixel buffer
        let image_info = ImageInfo::new(
            (self.width, self.height),
            ColorType::RGBA8888,
            AlphaType::Premul,
            None,
        );

        let row_bytes = (self.width * 4) as usize;

        // Create surface directly from our pixel data using modern Skia API
        let mut surface = surfaces::wrap_pixels(
            &image_info,
            self.pixels.as_mut_slice(),
            Some(row_bytes),
            None
        ).context("Failed to create surface")?;

        let canvas = surface.canvas();

        // Setup paint
        let mut paint = Paint::default();
        paint.set_color(color);
        paint.set_alpha_f(opacity);
        paint.set_stroke_width(brush_size);
        paint.set_stroke_cap(skia_safe::PaintCap::Round);
        paint.set_stroke_join(skia_safe::PaintJoin::Round);
        paint.set_anti_alias(false); // Pixel-perfect
        paint.set_style(skia_safe::PaintStyle::Stroke);

        // Create path
        let mut path = Path::new();
        if let Some(&first) = points.first() {
            path.move_to((first.0, first.1));
            for &(x, y) in &points[1..] {
                path.line_to((x, y));
            }
        }

        // Draw (directly modifies our pixel buffer)
        canvas.draw_path(&path, &paint);

        // Mark dirty region
        if let (Some(&first), Some(&last)) = (points.first(), points.last()) {
            self.dirty_region.add_line(
                first.0 as i32,
                first.1 as i32,
                last.0 as i32,
                last.1 as i32,
                brush_size as i32,
            );
        }

        Ok(())
    }

    /// Fill a rectangle
    pub fn fill_rect(&mut self, rect: Rect, color: Color, opacity: f32) -> Result<()> {
        let image_info = ImageInfo::new(
            (self.width, self.height),
            ColorType::RGBA8888,
            AlphaType::Premul,
            None,
        );

        let row_bytes = (self.width * 4) as usize;

        // Create surface directly from our pixel data using modern Skia API
        let mut surface = surfaces::wrap_pixels(
            &image_info,
            self.pixels.as_mut_slice(),
            Some(row_bytes),
            None
        ).context("Failed to create surface")?;

        let canvas = surface.canvas();

        let mut paint = Paint::default();
        paint.set_color(color);
        paint.set_alpha_f(opacity);
        paint.set_anti_alias(false);

        canvas.draw_rect(
            skia_safe::Rect::from_xywh(
                rect.x as f32,
                rect.y as f32,
                rect.width as f32,
                rect.height as f32,
            ),
            &paint,
        );

        self.dirty_region.add_rect(rect);
        Ok(())
    }

    /// Render viewport with culling
    pub fn render_viewport(
        &self,
        viewport_x: i32,
        viewport_y: i32,
        viewport_width: i32,
        viewport_height: i32,
        _zoom: f32,
    ) -> Result<Vec<u8>> {
        // For now, return a cropped region
        // TODO: Implement zoom scaling

        let src_x = viewport_x.max(0).min(self.width);
        let src_y = viewport_y.max(0).min(self.height);
        let src_width = viewport_width.min(self.width - src_x);
        let src_height = viewport_height.min(self.height - src_y);

        let mut result = vec![255u8; (viewport_width * viewport_height * 4) as usize];

        // Copy visible region
        for y in 0..src_height {
            let src_row_start = ((src_y + y) * self.width + src_x) as usize * 4;
            let dst_row_start = (y * viewport_width) as usize * 4;
            let row_len = (src_width * 4) as usize;

            if src_row_start + row_len <= self.pixels.len()
                && dst_row_start + row_len <= result.len()
            {
                result[dst_row_start..dst_row_start + row_len]
                    .copy_from_slice(&self.pixels[src_row_start..src_row_start + row_len]);
            }
        }

        Ok(result)
    }

    /// Get full image data
    pub fn get_image_data(&self) -> Vec<u8> {
        self.pixels.clone()
    }

    /// Clear canvas
    pub fn clear(&mut self, color: Color) {
        let r = color.r();
        let g = color.g();
        let b = color.b();
        let a = color.a();

        for chunk in self.pixels.chunks_exact_mut(4) {
            chunk[0] = r;
            chunk[1] = g;
            chunk[2] = b;
            chunk[3] = a;
        }

        self.dirty_region.add_rect(Rect::new(0, 0, self.width, self.height));
    }

    /// Get dirty bounds
    pub fn get_dirty_bounds(&self) -> Option<Rect> {
        self.dirty_region.get_bounds()
    }

    /// Clear dirty region
    pub fn clear_dirty_region(&mut self) {
        self.dirty_region.clear();
    }

    /// Resize
    pub fn resize(&mut self, width: i32, height: i32) -> Result<()> {
        self.width = width;
        self.height = height;
        self.pixels = vec![255u8; (width * height * 4) as usize];
        self.dirty_region.clear();
        self.dirty_region.add_rect(Rect::new(0, 0, width, height));
        Ok(())
    }
}
