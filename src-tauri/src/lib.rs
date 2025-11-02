// Library entry point for AIPIX backend
pub mod database;
pub mod engine;
pub mod fileio;

use std::sync::Mutex;
use std::collections::HashMap;

// Global database state
pub struct AppState {
    pub db: Mutex<Option<database::Database>>,
    pub canvases: Mutex<HashMap<String, engine::CanvasHistory>>,
    pub selections: Mutex<HashMap<String, engine::Selection>>,
    pub clipboard: Mutex<Option<(engine::PixelBuffer, u32, u32)>>, // buffer, offset_x, offset_y
}
