// Dirty Region Tracking - Aseprite Pattern
//
// Tracks which regions of the canvas have changed and need redrawing.
// This is critical for performance on large canvases.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

impl Rect {
    pub fn new(x: i32, y: i32, width: i32, height: i32) -> Self {
        Self { x, y, width, height }
    }

    pub fn is_empty(&self) -> bool {
        self.width <= 0 || self.height <= 0
    }

    pub fn intersects(&self, other: &Rect) -> bool {
        !(self.x + self.width <= other.x
            || other.x + other.width <= self.x
            || self.y + self.height <= other.y
            || other.y + other.height <= self.y)
    }

    pub fn union(&self, other: &Rect) -> Rect {
        let x = self.x.min(other.x);
        let y = self.y.min(other.y);
        let max_x = (self.x + self.width).max(other.x + other.width);
        let max_y = (self.y + self.height).max(other.y + other.height);

        Rect {
            x,
            y,
            width: max_x - x,
            height: max_y - y,
        }
    }
}

#[derive(Debug)]
pub struct DirtyRegion {
    rects: Vec<Rect>,
}

impl DirtyRegion {
    pub fn new() -> Self {
        Self { rects: Vec::new() }
    }

    /// Add a dirty rectangle
    pub fn add_rect(&mut self, rect: Rect) {
        if !rect.is_empty() {
            self.rects.push(rect);
        }
    }

    /// Add a point with brush size as dirty region
    pub fn add_point(&mut self, x: i32, y: i32, brush_size: i32) {
        let half = brush_size / 2;
        self.add_rect(Rect::new(
            x - half,
            y - half,
            brush_size,
            brush_size,
        ));
    }

    /// Add a line segment as dirty region
    pub fn add_line(&mut self, x1: i32, y1: i32, x2: i32, y2: i32, brush_size: i32) {
        let min_x = x1.min(x2);
        let min_y = y1.min(y2);
        let max_x = x1.max(x2);
        let max_y = y1.max(y2);
        let half = brush_size / 2;

        self.add_rect(Rect::new(
            min_x - half,
            min_y - half,
            (max_x - min_x) + brush_size,
            (max_y - min_y) + brush_size,
        ));
    }

    /// Check if there are dirty regions
    pub fn is_empty(&self) -> bool {
        self.rects.is_empty()
    }

    /// Get all dirty rectangles
    pub fn rects(&self) -> &[Rect] {
        &self.rects
    }

    /// Get the union of all dirty rectangles (bounding box)
    pub fn get_bounds(&self) -> Option<Rect> {
        if self.rects.is_empty() {
            return None;
        }

        let mut result = self.rects[0];
        for rect in &self.rects[1..] {
            result = result.union(rect);
        }

        Some(result)
    }

    /// Clear all dirty regions
    pub fn clear(&mut self) {
        self.rects.clear();
    }

    /// Optimize by merging overlapping rectangles
    pub fn optimize(&mut self) {
        if self.rects.len() <= 1 {
            return;
        }

        let mut optimized = Vec::new();

        for rect in &self.rects {
            let mut merged = false;

            for existing in &mut optimized {
                if rect.intersects(existing) {
                    *existing = existing.union(rect);
                    merged = true;
                    break;
                }
            }

            if !merged {
                optimized.push(*rect);
            }
        }

        self.rects = optimized;
    }
}

impl Default for DirtyRegion {
    fn default() -> Self {
        Self::new()
    }
}
