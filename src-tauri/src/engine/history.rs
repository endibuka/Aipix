// Canvas history system for undo/redo functionality
use super::pixel_buffer::PixelBuffer;

const MAX_HISTORY_SIZE: usize = 50; // Maximum number of undo states

#[derive(Clone)]
pub struct CanvasHistory {
    pub buffer: PixelBuffer,
    undo_stack: Vec<Vec<u8>>, // Stack of previous states (RGBA data)
    redo_stack: Vec<Vec<u8>>, // Stack of undone states
}

impl CanvasHistory {
    pub fn new(width: u32, height: u32) -> Self {
        Self {
            buffer: PixelBuffer::new(width, height),
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
        }
    }

    /// Save current state to undo stack before making changes
    pub fn push_state(&mut self) {
        // Save current buffer data to undo stack
        let snapshot = self.buffer.data.clone();
        self.undo_stack.push(snapshot);

        // Limit history size to prevent memory issues
        if self.undo_stack.len() > MAX_HISTORY_SIZE {
            self.undo_stack.remove(0);
        }

        // Clear redo stack when new action is performed
        self.redo_stack.clear();
    }

    /// Undo last action
    pub fn undo(&mut self) -> Result<(), String> {
        if let Some(previous_state) = self.undo_stack.pop() {
            // Save current state to redo stack
            let current_state = self.buffer.data.clone();
            self.redo_stack.push(current_state);

            // Restore previous state
            self.buffer.data = previous_state;

            Ok(())
        } else {
            Err("Nothing to undo".to_string())
        }
    }

    /// Redo last undone action
    pub fn redo(&mut self) -> Result<(), String> {
        if let Some(next_state) = self.redo_stack.pop() {
            // Save current state to undo stack
            let current_state = self.buffer.data.clone();
            self.undo_stack.push(current_state);

            // Restore next state
            self.buffer.data = next_state;

            Ok(())
        } else {
            Err("Nothing to redo".to_string())
        }
    }

    /// Check if undo is available
    pub fn can_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }

    /// Check if redo is available
    pub fn can_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    /// Get number of actions in undo stack
    pub fn undo_count(&self) -> usize {
        self.undo_stack.len()
    }

    /// Get number of actions in redo stack
    pub fn redo_count(&self) -> usize {
        self.redo_stack.len()
    }

    /// Clear all history
    pub fn clear_history(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_undo_redo() {
        let mut history = CanvasHistory::new(10, 10);

        // Make a change
        history.push_state();
        history.buffer.set_pixel(5, 5, [255, 0, 0, 255]).unwrap();

        // Make another change
        history.push_state();
        history.buffer.set_pixel(6, 6, [0, 255, 0, 255]).unwrap();

        // Undo
        assert!(history.can_undo());
        history.undo().unwrap();

        // Check pixel was reverted
        assert_eq!(history.buffer.get_pixel(6, 6).unwrap(), [0, 0, 0, 0]);

        // Redo
        assert!(history.can_redo());
        history.redo().unwrap();

        // Check pixel was restored
        assert_eq!(history.buffer.get_pixel(6, 6).unwrap(), [0, 255, 0, 255]);
    }

    #[test]
    fn test_history_limit() {
        let mut history = CanvasHistory::new(10, 10);

        // Add more than MAX_HISTORY_SIZE states
        for i in 0..(MAX_HISTORY_SIZE + 10) {
            history.push_state();
            history.buffer.set_pixel(0, 0, [i as u8, 0, 0, 255]).unwrap();
        }

        // Should not exceed max size
        assert!(history.undo_count() <= MAX_HISTORY_SIZE);
    }
}
