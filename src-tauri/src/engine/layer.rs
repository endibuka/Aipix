// Layer management for pixel art projects
use super::pixel_buffer::PixelBuffer;

#[derive(Debug, Clone)]
pub struct Layer {
    pub name: String,
    pub visible: bool,
    pub opacity: f32,
    pub buffer: PixelBuffer,
}

impl Layer {
    pub fn new(name: String, width: u32, height: u32) -> Self {
        Self {
            name,
            visible: true,
            opacity: 1.0,
            buffer: PixelBuffer::new(width, height),
        }
    }

    pub fn set_opacity(&mut self, opacity: f32) {
        self.opacity = opacity.clamp(0.0, 1.0);
    }

    pub fn toggle_visibility(&mut self) {
        self.visible = !self.visible;
    }
}
