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
