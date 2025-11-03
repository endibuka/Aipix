// Tauri commands for native Skia rendering
//
// These commands bridge the frontend to our native Skia renderer,
// replacing the WebGL/Canvas2D approach.

use crate::engine::renderer::{PixelRenderer, Rect};
use anyhow::Result;
use skia_safe::Color;
use std::sync::Mutex;
use tauri::State;

/// Global renderer state
pub struct RendererState {
    pub renderer: Mutex<Option<PixelRenderer>>,
}

impl RendererState {
    pub fn new() -> Self {
        Self {
            renderer: Mutex::new(None),
        }
    }
}

/// Parse hex color string to Skia Color
fn parse_hex_color(hex: &str) -> Result<Color> {
    let hex = hex.trim_start_matches('#');
    let r = u8::from_str_radix(&hex[0..2], 16)?;
    let g = u8::from_str_radix(&hex[2..4], 16)?;
    let b = u8::from_str_radix(&hex[4..6], 16)?;
    let a = if hex.len() == 8 {
        u8::from_str_radix(&hex[6..8], 16)?
    } else {
        255
    };

    Ok(Color::from_argb(a, r, g, b))
}

/// Initialize the renderer with canvas dimensions
#[tauri::command]
pub async fn init_renderer(
    state: State<'_, RendererState>,
    width: i32,
    height: i32,
) -> Result<(), String> {
    let renderer = PixelRenderer::new(width, height)
        .map_err(|e| format!("Failed to create renderer: {}", e))?;

    *state.renderer.lock().unwrap() = Some(renderer);

    Ok(())
}

/// Draw a stroke (brush/pencil tool)
#[tauri::command]
pub async fn draw_stroke(
    state: State<'_, RendererState>,
    points: Vec<(f32, f32)>,
    brush_size: f32,
    color: String,
    opacity: f32,
) -> Result<(), String> {
    let mut renderer_lock = state.renderer.lock().unwrap();
    let renderer = renderer_lock
        .as_mut()
        .ok_or("Renderer not initialized")?;

    let color = parse_hex_color(&color)
        .map_err(|e| format!("Invalid color: {}", e))?;

    renderer
        .draw_stroke(&points, brush_size, color, opacity)
        .map_err(|e| format!("Failed to draw stroke: {}", e))?;

    Ok(())
}

/// Fill a rectangle
#[tauri::command]
pub async fn fill_rect(
    state: State<'_, RendererState>,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    color: String,
    opacity: f32,
) -> Result<(), String> {
    let mut renderer_lock = state.renderer.lock().unwrap();
    let renderer = renderer_lock
        .as_mut()
        .ok_or("Renderer not initialized")?;

    let rect = Rect::new(x, y, width, height);
    let color = parse_hex_color(&color)
        .map_err(|e| format!("Invalid color: {}", e))?;

    renderer
        .fill_rect(rect, color, opacity)
        .map_err(|e| format!("Failed to fill rect: {}", e))?;

    Ok(())
}

/// Render viewport (with culling for performance)
///
/// This is THE key optimization - only renders the visible region!
#[tauri::command]
pub async fn render_viewport(
    state: State<'_, RendererState>,
    viewport_x: i32,
    viewport_y: i32,
    viewport_width: i32,
    viewport_height: i32,
    zoom: f32,
) -> Result<Vec<u8>, String> {
    let renderer_lock = state.renderer.lock().unwrap();
    let renderer = renderer_lock
        .as_ref()
        .ok_or("Renderer not initialized")?;

    let pixels = renderer
        .render_viewport(viewport_x, viewport_y, viewport_width, viewport_height, zoom)
        .map_err(|e| format!("Failed to render viewport: {}", e))?;

    Ok(pixels)
}

/// Get full canvas image data
#[tauri::command]
pub async fn get_canvas_image(
    state: State<'_, RendererState>,
) -> Result<Vec<u8>, String> {
    let renderer_lock = state.renderer.lock().unwrap();
    let renderer = renderer_lock
        .as_ref()
        .ok_or("Renderer not initialized")?;

    Ok(renderer.get_image_data())
}

/// Clear the canvas
#[tauri::command]
pub async fn clear_canvas(
    state: State<'_, RendererState>,
    color: String,
) -> Result<(), String> {
    let mut renderer_lock = state.renderer.lock().unwrap();
    let renderer = renderer_lock
        .as_mut()
        .ok_or("Renderer not initialized")?;

    let color = parse_hex_color(&color)
        .map_err(|e| format!("Invalid color: {}", e))?;

    renderer.clear(color);

    Ok(())
}

/// Resize the canvas
#[tauri::command]
pub async fn resize_canvas(
    state: State<'_, RendererState>,
    width: i32,
    height: i32,
) -> Result<(), String> {
    let mut renderer_lock = state.renderer.lock().unwrap();
    let renderer = renderer_lock
        .as_mut()
        .ok_or("Renderer not initialized")?;

    renderer
        .resize(width, height)
        .map_err(|e| format!("Failed to resize: {}", e))?;

    Ok(())
}

/// Get dirty region bounds (for optimization)
#[tauri::command]
pub async fn get_dirty_bounds(
    state: State<'_, RendererState>,
) -> Result<Option<Rect>, String> {
    let renderer_lock = state.renderer.lock().unwrap();
    let renderer = renderer_lock
        .as_ref()
        .ok_or("Renderer not initialized")?;

    Ok(renderer.get_dirty_bounds())
}

/// Clear dirty region
#[tauri::command]
pub async fn clear_dirty_region(
    state: State<'_, RendererState>,
) -> Result<(), String> {
    let mut renderer_lock = state.renderer.lock().unwrap();
    let renderer = renderer_lock
        .as_mut()
        .ok_or("Renderer not initialized")?;

    renderer.clear_dirty_region();

    Ok(())
}
