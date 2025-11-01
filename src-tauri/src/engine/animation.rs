// Animation frame management
use super::layer::Layer;

#[derive(Debug, Clone)]
pub struct Frame {
    pub layers: Vec<Layer>,
    pub duration_ms: u32, // Duration in milliseconds
}

impl Frame {
    pub fn new(duration_ms: u32) -> Self {
        Self {
            layers: Vec::new(),
            duration_ms,
        }
    }

    pub fn add_layer(&mut self, layer: Layer) {
        self.layers.push(layer);
    }

    pub fn remove_layer(&mut self, index: usize) -> Option<Layer> {
        if index < self.layers.len() {
            Some(self.layers.remove(index))
        } else {
            None
        }
    }
}

#[derive(Debug)]
pub struct Animation {
    pub frames: Vec<Frame>,
    pub current_frame: usize,
    pub loop_enabled: bool,
}

impl Animation {
    pub fn new() -> Self {
        Self {
            frames: Vec::new(),
            current_frame: 0,
            loop_enabled: true,
        }
    }

    pub fn add_frame(&mut self, frame: Frame) {
        self.frames.push(frame);
    }

    pub fn next_frame(&mut self) {
        if self.frames.is_empty() {
            return;
        }

        self.current_frame += 1;
        if self.current_frame >= self.frames.len() {
            if self.loop_enabled {
                self.current_frame = 0;
            } else {
                self.current_frame = self.frames.len() - 1;
            }
        }
    }

    pub fn previous_frame(&mut self) {
        if self.frames.is_empty() {
            return;
        }

        if self.current_frame > 0 {
            self.current_frame -= 1;
        } else if self.loop_enabled {
            self.current_frame = self.frames.len() - 1;
        }
    }
}

impl Default for Animation {
    fn default() -> Self {
        Self::new()
    }
}
