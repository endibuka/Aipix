// Pixel buffer implementation
// Represents a 2D grid of pixels with RGBA values

#[derive(Debug, Clone)]
pub struct PixelBuffer {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>, // RGBA format: 4 bytes per pixel
}

impl PixelBuffer {
    pub fn new(width: u32, height: u32) -> Self {
        let size = (width * height * 4) as usize;
        Self {
            width,
            height,
            data: vec![0; size],
        }
    }

    pub fn get_pixel(&self, x: u32, y: u32) -> Option<[u8; 4]> {
        if x >= self.width || y >= self.height {
            return None;
        }
        let index = ((y * self.width + x) * 4) as usize;
        Some([
            self.data[index],
            self.data[index + 1],
            self.data[index + 2],
            self.data[index + 3],
        ])
    }

    pub fn set_pixel(&mut self, x: u32, y: u32, color: [u8; 4]) -> Result<(), String> {
        if x >= self.width || y >= self.height {
            return Err("Pixel coordinates out of bounds".to_string());
        }
        let index = ((y * self.width + x) * 4) as usize;
        self.data[index..index + 4].copy_from_slice(&color);
        Ok(())
    }

    pub fn clear(&mut self, color: [u8; 4]) {
        for y in 0..self.height {
            for x in 0..self.width {
                let _ = self.set_pixel(x, y, color);
            }
        }
    }
}
