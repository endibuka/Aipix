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
}
