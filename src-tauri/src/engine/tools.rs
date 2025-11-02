// Drawing tools implementation
use super::pixel_buffer::PixelBuffer;
use std::collections::VecDeque;

/// Convert hex color string to RGBA
pub fn hex_to_rgba(hex: &str) -> Result<[u8; 4], String> {
    let hex = hex.trim_start_matches('#');

    if hex.len() != 6 {
        return Err("Invalid hex color format".to_string());
    }

    let r = u8::from_str_radix(&hex[0..2], 16).map_err(|_| "Invalid hex color")?;
    let g = u8::from_str_radix(&hex[2..4], 16).map_err(|_| "Invalid hex color")?;
    let b = u8::from_str_radix(&hex[4..6], 16).map_err(|_| "Invalid hex color")?;

    Ok([r, g, b, 255])
}

/// Convert RGBA to hex color string
pub fn rgba_to_hex(rgba: [u8; 4]) -> String {
    format!("#{:02x}{:02x}{:02x}", rgba[0], rgba[1], rgba[2])
}

/// Pencil tool - draws a single pixel
pub fn pencil(buffer: &mut PixelBuffer, x: u32, y: u32, color: [u8; 4]) -> Result<(), String> {
    buffer.set_pixel(x, y, color)
}

/// Eraser tool - sets pixel to transparent
pub fn eraser(buffer: &mut PixelBuffer, x: u32, y: u32) -> Result<(), String> {
    buffer.set_pixel(x, y, [0, 0, 0, 0])
}

/// Eyedropper tool - gets color at position
pub fn eyedropper(buffer: &PixelBuffer, x: u32, y: u32) -> Option<[u8; 4]> {
    buffer.get_pixel(x, y)
}

/// Line tool - draws a line using Bresenham's algorithm
pub fn line(
    buffer: &mut PixelBuffer,
    x0: i32,
    y0: i32,
    x1: i32,
    y1: i32,
    color: [u8; 4],
) -> Result<(), String> {
    let dx = (x1 - x0).abs();
    let dy = -(y1 - y0).abs();
    let sx = if x0 < x1 { 1 } else { -1 };
    let sy = if y0 < y1 { 1 } else { -1 };
    let mut err = dx + dy;

    let mut x = x0;
    let mut y = y0;

    loop {
        if x >= 0 && y >= 0 {
            buffer.set_pixel(x as u32, y as u32, color)?;
        }

        if x == x1 && y == y1 {
            break;
        }

        let e2 = 2 * err;
        if e2 >= dy {
            err += dy;
            x += sx;
        }
        if e2 <= dx {
            err += dx;
            y += sy;
        }
    }

    Ok(())
}

/// Rectangle tool - draws a filled or outlined rectangle
pub fn rectangle(
    buffer: &mut PixelBuffer,
    x0: u32,
    y0: u32,
    x1: u32,
    y1: u32,
    color: [u8; 4],
    filled: bool,
) -> Result<(), String> {
    let min_x = x0.min(x1);
    let max_x = x0.max(x1);
    let min_y = y0.min(y1);
    let max_y = y0.max(y1);

    if filled {
        // Fill the rectangle
        for y in min_y..=max_y {
            for x in min_x..=max_x {
                buffer.set_pixel(x, y, color)?;
            }
        }
    } else {
        // Draw outline
        for x in min_x..=max_x {
            buffer.set_pixel(x, min_y, color)?;
            buffer.set_pixel(x, max_y, color)?;
        }
        for y in min_y..=max_y {
            buffer.set_pixel(min_x, y, color)?;
            buffer.set_pixel(max_x, y, color)?;
        }
    }

    Ok(())
}

/// Fill/Bucket tool - flood fill using BFS
pub fn fill(
    buffer: &mut PixelBuffer,
    x: u32,
    y: u32,
    new_color: [u8; 4],
) -> Result<(), String> {
    let target_color = match buffer.get_pixel(x, y) {
        Some(c) => c,
        None => return Err("Invalid starting position".to_string()),
    };

    // If the target color is the same as new color, nothing to do
    if target_color == new_color {
        return Ok(());
    }

    let mut queue = VecDeque::new();
    queue.push_back((x, y));

    let width = buffer.width;
    let height = buffer.height;

    while let Some((px, py)) = queue.pop_front() {
        // Check bounds
        if px >= width || py >= height {
            continue;
        }

        // Check if pixel matches target color
        if let Some(current_color) = buffer.get_pixel(px, py) {
            if current_color != target_color {
                continue;
            }
        } else {
            continue;
        }

        // Fill this pixel
        buffer.set_pixel(px, py, new_color)?;

        // Add neighbors to queue
        if px > 0 {
            queue.push_back((px - 1, py));
        }
        if px < width - 1 {
            queue.push_back((px + 1, py));
        }
        if py > 0 {
            queue.push_back((px, py - 1));
        }
        if py < height - 1 {
            queue.push_back((px, py + 1));
        }
    }

    Ok(())
}

/// Circle tool - draws a filled or outlined circle using Bresenham's algorithm
pub fn circle(
    buffer: &mut PixelBuffer,
    center_x: i32,
    center_y: i32,
    end_x: i32,
    end_y: i32,
    color: [u8; 4],
    filled: bool,
) -> Result<(), String> {
    // Calculate radius from center to end point
    let dx = end_x - center_x;
    let dy = end_y - center_y;
    let radius = ((dx * dx + dy * dy) as f64).sqrt().round() as i32;

    if radius == 0 {
        return Ok(());
    }

    if filled {
        // Filled circle - draw all pixels within radius
        for y in -radius..=radius {
            for x in -radius..=radius {
                if x * x + y * y <= radius * radius {
                    let px = center_x + x;
                    let py = center_y + y;
                    if px >= 0 && py >= 0 {
                        buffer.set_pixel(px as u32, py as u32, color)?;
                    }
                }
            }
        }
    } else {
        // Bresenham's circle algorithm for outline
        let mut x = radius;
        let mut y = 0;
        let mut decision_over_2 = 1 - x;

        while y <= x {
            // Draw 8-way symmetry points
            let points = [
                (center_x + x, center_y + y),
                (center_x - x, center_y + y),
                (center_x + x, center_y - y),
                (center_x - x, center_y - y),
                (center_x + y, center_y + x),
                (center_x - y, center_y + x),
                (center_x + y, center_y - x),
                (center_x - y, center_y - x),
            ];

            for (px, py) in points.iter() {
                if *px >= 0 && *py >= 0 {
                    buffer.set_pixel(*px as u32, *py as u32, color)?;
                }
            }

            y += 1;
            if decision_over_2 <= 0 {
                decision_over_2 += 2 * y + 1;
            } else {
                x -= 1;
                decision_over_2 += 2 * (y - x) + 1;
            }
        }
    }

    Ok(())
}

/// Color Replace tool - replaces all instances of a target color with a new color
pub fn replace_all_color(
    buffer: &mut PixelBuffer,
    target_color: [u8; 4],
    new_color: [u8; 4],
) {
    let width = buffer.width;
    let height = buffer.height;

    // Iterate through all pixels
    for y in 0..height {
        for x in 0..width {
            if let Some(current_color) = buffer.get_pixel(x, y) {
                // Compare RGB values (ignore alpha for comparison)
                if current_color[0] == target_color[0]
                    && current_color[1] == target_color[1]
                    && current_color[2] == target_color[2]
                {
                    // Replace with new color
                    let _ = buffer.set_pixel(x, y, new_color);
                }
            }
        }
    }
}

/// Selection types
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum SelectionMode {
    Replace,   // New selection replaces current
    Add,       // Add to current selection
    Subtract,  // Remove from current selection
    Intersect, // Keep only overlap
}

/// Selection data structure - stores which pixels are selected
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Selection {
    pub width: u32,
    pub height: u32,
    pub mask: Vec<bool>, // true = selected, false = not selected
    pub bounds: Option<SelectionBounds>,
}

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct SelectionBounds {
    pub min_x: u32,
    pub max_x: u32,
    pub min_y: u32,
    pub max_y: u32,
}

impl Selection {
    pub fn new(width: u32, height: u32) -> Self {
        Selection {
            width,
            height,
            mask: vec![false; (width * height) as usize],
            bounds: None,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.bounds.is_none()
    }

    pub fn clear(&mut self) {
        self.mask.fill(false);
        self.bounds = None;
    }

    pub fn select_pixel(&mut self, x: u32, y: u32, selected: bool) {
        if x < self.width && y < self.height {
            let index = (y * self.width + x) as usize;
            self.mask[index] = selected;
        }
    }

    pub fn is_selected(&self, x: u32, y: u32) -> bool {
        if x < self.width && y < self.height {
            let index = (y * self.width + x) as usize;
            self.mask[index]
        } else {
            false
        }
    }

    /// Update selection bounds after modifying mask
    pub fn update_bounds(&mut self) {
        let mut min_x = self.width;
        let mut max_x = 0;
        let mut min_y = self.height;
        let mut max_y = 0;
        let mut has_selection = false;

        for y in 0..self.height {
            for x in 0..self.width {
                if self.is_selected(x, y) {
                    has_selection = true;
                    min_x = min_x.min(x);
                    max_x = max_x.max(x);
                    min_y = min_y.min(y);
                    max_y = max_y.max(y);
                }
            }
        }

        if has_selection {
            self.bounds = Some(SelectionBounds {
                min_x,
                max_x,
                min_y,
                max_y,
            });
        } else {
            self.bounds = None;
        }
    }

    /// Select all pixels
    pub fn select_all(&mut self) {
        self.mask.fill(true);
        self.bounds = Some(SelectionBounds {
            min_x: 0,
            max_x: self.width - 1,
            min_y: 0,
            max_y: self.height - 1,
        });
    }

    /// Invert selection
    pub fn invert(&mut self) {
        for pixel in self.mask.iter_mut() {
            *pixel = !*pixel;
        }
        self.update_bounds();
    }
}

/// Rectangular selection tool
pub fn select_rectangle(
    selection: &mut Selection,
    x0: u32,
    y0: u32,
    x1: u32,
    y1: u32,
    mode: SelectionMode,
) {
    let min_x = x0.min(x1);
    let max_x = x0.max(x1);
    let min_y = y0.min(y1);
    let max_y = y0.max(y1);

    // Create temporary mask for this operation
    let mut temp_mask = vec![false; (selection.width * selection.height) as usize];

    // Mark pixels in rectangle
    for y in min_y..=max_y {
        for x in min_x..=max_x {
            if x < selection.width && y < selection.height {
                let index = (y * selection.width + x) as usize;
                temp_mask[index] = true;
            }
        }
    }

    // Apply selection mode
    apply_selection_mode(selection, &temp_mask, mode);
    selection.update_bounds();
}

/// Elliptical selection tool
pub fn select_ellipse(
    selection: &mut Selection,
    center_x: i32,
    center_y: i32,
    end_x: i32,
    end_y: i32,
    mode: SelectionMode,
) {
    // Calculate radius from center to end point
    let dx = (end_x - center_x).abs();
    let dy = (end_y - center_y).abs();

    if dx == 0 && dy == 0 {
        return;
    }

    // Create temporary mask for this operation
    let mut temp_mask = vec![false; (selection.width * selection.height) as usize];

    // Use ellipse equation: (x/a)^2 + (y/b)^2 <= 1
    for y in 0..selection.height as i32 {
        for x in 0..selection.width as i32 {
            let rel_x = x - center_x;
            let rel_y = y - center_y;

            // Ellipse test
            let x_term = if dx > 0 {
                (rel_x as f64 / dx as f64).powi(2)
            } else {
                0.0
            };
            let y_term = if dy > 0 {
                (rel_y as f64 / dy as f64).powi(2)
            } else {
                0.0
            };

            if x_term + y_term <= 1.0 {
                let index = (y as u32 * selection.width + x as u32) as usize;
                temp_mask[index] = true;
            }
        }
    }

    // Apply selection mode
    apply_selection_mode(selection, &temp_mask, mode);
    selection.update_bounds();
}

/// Lasso/freehand selection tool - adds a point to the selection path
pub fn select_lasso_add_point(
    selection: &mut Selection,
    points: &[(i32, i32)],
    mode: SelectionMode,
) {
    if points.len() < 3 {
        return; // Need at least 3 points to form a polygon
    }

    // Create temporary mask for this operation
    let mut temp_mask = vec![false; (selection.width * selection.height) as usize];

    // Use scanline fill algorithm for polygon
    for y in 0..selection.height as i32 {
        let mut intersections: Vec<i32> = Vec::new();

        // Find intersections with polygon edges at this y coordinate
        for i in 0..points.len() {
            let p1 = points[i];
            let p2 = points[(i + 1) % points.len()];

            let y1 = p1.1;
            let y2 = p2.1;

            // Check if edge crosses this scanline
            if (y1 <= y && y < y2) || (y2 <= y && y < y1) {
                let x1 = p1.0 as f64;
                let x2 = p2.0 as f64;
                let y1_f = y1 as f64;
                let y2_f = y2 as f64;
                let y_f = y as f64;

                // Calculate intersection x coordinate
                let x = x1 + (y_f - y1_f) / (y2_f - y1_f) * (x2 - x1);
                intersections.push(x.round() as i32);
            }
        }

        // Sort intersections
        intersections.sort();

        // Fill between pairs of intersections
        for i in (0..intersections.len()).step_by(2) {
            if i + 1 < intersections.len() {
                let x_start = intersections[i].max(0);
                let x_end = intersections[i + 1].min(selection.width as i32 - 1);

                for x in x_start..=x_end {
                    if x >= 0 && x < selection.width as i32 && y >= 0 && y < selection.height as i32 {
                        let index = (y as u32 * selection.width + x as u32) as usize;
                        temp_mask[index] = true;
                    }
                }
            }
        }
    }

    // Apply selection mode
    apply_selection_mode(selection, &temp_mask, mode);
    selection.update_bounds();
}

/// Magic wand selection - select contiguous pixels of similar color
pub fn select_magic_wand(
    buffer: &PixelBuffer,
    selection: &mut Selection,
    x: u32,
    y: u32,
    tolerance: u8,
    mode: SelectionMode,
) -> Result<(), String> {
    let target_color = match buffer.get_pixel(x, y) {
        Some(c) => c,
        None => return Err("Invalid starting position".to_string()),
    };

    // Create temporary mask for this operation
    let mut temp_mask = vec![false; (selection.width * selection.height) as usize];
    let mut visited = vec![false; (selection.width * selection.height) as usize];

    let mut queue = VecDeque::new();
    queue.push_back((x, y));

    let width = selection.width;
    let height = selection.height;

    while let Some((px, py)) = queue.pop_front() {
        if px >= width || py >= height {
            continue;
        }

        let index = (py * width + px) as usize;
        if visited[index] {
            continue;
        }
        visited[index] = true;

        // Check if pixel color is within tolerance
        if let Some(current_color) = buffer.get_pixel(px, py) {
            if color_distance(current_color, target_color) <= tolerance {
                temp_mask[index] = true;

                // Add neighbors to queue
                if px > 0 {
                    queue.push_back((px - 1, py));
                }
                if px < width - 1 {
                    queue.push_back((px + 1, py));
                }
                if py > 0 {
                    queue.push_back((px, py - 1));
                }
                if py < height - 1 {
                    queue.push_back((px, py + 1));
                }
            }
        }
    }

    // Apply selection mode
    apply_selection_mode(selection, &temp_mask, mode);
    selection.update_bounds();

    Ok(())
}

/// Helper function to calculate color distance
fn color_distance(c1: [u8; 4], c2: [u8; 4]) -> u8 {
    let dr = (c1[0] as i32 - c2[0] as i32).abs();
    let dg = (c1[1] as i32 - c2[1] as i32).abs();
    let db = (c1[2] as i32 - c2[2] as i32).abs();
    ((dr + dg + db) / 3).min(255) as u8
}

/// Apply selection mode (add, subtract, intersect, replace)
fn apply_selection_mode(selection: &mut Selection, new_mask: &[bool], mode: SelectionMode) {
    match mode {
        SelectionMode::Replace => {
            selection.mask.copy_from_slice(new_mask);
        }
        SelectionMode::Add => {
            for i in 0..selection.mask.len() {
                selection.mask[i] = selection.mask[i] || new_mask[i];
            }
        }
        SelectionMode::Subtract => {
            for i in 0..selection.mask.len() {
                selection.mask[i] = selection.mask[i] && !new_mask[i];
            }
        }
        SelectionMode::Intersect => {
            for i in 0..selection.mask.len() {
                selection.mask[i] = selection.mask[i] && new_mask[i];
            }
        }
    }
}

/// Get selected pixels as a separate buffer (for copy/cut operations)
pub fn extract_selection(buffer: &PixelBuffer, selection: &Selection) -> Option<(PixelBuffer, u32, u32)> {
    let bounds = selection.bounds.as_ref()?;

    let width = bounds.max_x - bounds.min_x + 1;
    let height = bounds.max_y - bounds.min_y + 1;

    let mut extracted = PixelBuffer::new(width, height);

    for y in bounds.min_y..=bounds.max_y {
        for x in bounds.min_x..=bounds.max_x {
            if selection.is_selected(x, y) {
                if let Some(color) = buffer.get_pixel(x, y) {
                    let dest_x = x - bounds.min_x;
                    let dest_y = y - bounds.min_y;
                    let _ = extracted.set_pixel(dest_x, dest_y, color);
                }
            }
        }
    }

    Some((extracted, bounds.min_x, bounds.min_y))
}

/// Delete selected pixels (make them transparent)
pub fn delete_selection(buffer: &mut PixelBuffer, selection: &Selection) {
    for y in 0..selection.height {
        for x in 0..selection.width {
            if selection.is_selected(x, y) {
                let _ = buffer.set_pixel(x, y, [0, 0, 0, 0]);
            }
        }
    }
}

/// Paste buffer at specified position
pub fn paste_buffer(
    dest: &mut PixelBuffer,
    source: &PixelBuffer,
    offset_x: u32,
    offset_y: u32,
) -> Result<(), String> {
    for y in 0..source.height {
        for x in 0..source.width {
            if let Some(color) = source.get_pixel(x, y) {
                // Only paste non-transparent pixels
                if color[3] > 0 {
                    let dest_x = offset_x + x;
                    let dest_y = offset_y + y;
                    if dest_x < dest.width && dest_y < dest.height {
                        dest.set_pixel(dest_x, dest_y, color)?;
                    }
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hex_to_rgba() {
        assert_eq!(hex_to_rgba("#FF0000").unwrap(), [255, 0, 0, 255]);
        assert_eq!(hex_to_rgba("#00FF00").unwrap(), [0, 255, 0, 255]);
        assert_eq!(hex_to_rgba("#0000FF").unwrap(), [0, 0, 255, 255]);
        assert_eq!(hex_to_rgba("FFFFFF").unwrap(), [255, 255, 255, 255]);
    }

    #[test]
    fn test_rgba_to_hex() {
        assert_eq!(rgba_to_hex([255, 0, 0, 255]), "#ff0000");
        assert_eq!(rgba_to_hex([0, 255, 0, 255]), "#00ff00");
        assert_eq!(rgba_to_hex([0, 0, 255, 255]), "#0000ff");
    }

    #[test]
    fn test_pencil() {
        let mut buffer = PixelBuffer::new(10, 10);
        pencil(&mut buffer, 5, 5, [255, 0, 0, 255]).unwrap();
        assert_eq!(buffer.get_pixel(5, 5).unwrap(), [255, 0, 0, 255]);
    }

    #[test]
    fn test_eraser() {
        let mut buffer = PixelBuffer::new(10, 10);
        buffer.set_pixel(5, 5, [255, 0, 0, 255]).unwrap();
        eraser(&mut buffer, 5, 5).unwrap();
        assert_eq!(buffer.get_pixel(5, 5).unwrap(), [0, 0, 0, 0]);
    }
}
