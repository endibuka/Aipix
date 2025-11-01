// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use aipix_lib::{database, engine, AppState};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{Manager, State};

// Tauri commands
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to AIPIX.", name)
}

#[tauri::command]
fn init_database(app_handle: tauri::AppHandle, state: State<AppState>) -> Result<String, String> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| e.to_string())?;

    let db_path = app_data_dir.join("aipix.db");

    let db = database::Database::new(db_path)
        .map_err(|e| format!("Failed to initialize database: {}", e))?;

    *state.db.lock().unwrap() = Some(db);

    Ok("Database initialized successfully".to_string())
}

#[tauri::command]
fn create_project(
    state: State<AppState>,
    project: database::Project,
) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.create_project(&project)
        .map_err(|e| format!("Failed to create project: {}", e))
}

#[tauri::command]
fn get_user_projects(
    state: State<AppState>,
    user_id: String,
) -> Result<Vec<database::Project>, String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.get_projects_by_user(&user_id)
        .map_err(|e| format!("Failed to get projects: {}", e))
}

#[tauri::command]
fn update_project(
    state: State<AppState>,
    project: database::Project,
) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.update_project(&project)
        .map_err(|e| format!("Failed to update project: {}", e))
}

#[tauri::command]
fn delete_project(
    state: State<AppState>,
    project_id: String,
) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.delete_project(&project_id)
        .map_err(|e| format!("Failed to delete project: {}", e))
}

#[tauri::command]
fn create_folder(
    state: State<AppState>,
    folder: database::Folder,
) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.create_folder(&folder)
        .map_err(|e| format!("Failed to create folder: {}", e))
}

#[tauri::command]
fn get_user_folders(
    state: State<AppState>,
    user_id: String,
) -> Result<Vec<database::Folder>, String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.get_folders_by_user(&user_id)
        .map_err(|e| format!("Failed to get folders: {}", e))
}

#[tauri::command]
fn update_folder(
    state: State<AppState>,
    folder: database::Folder,
) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.update_folder(&folder)
        .map_err(|e| format!("Failed to update folder: {}", e))
}

#[tauri::command]
fn delete_folder(
    state: State<AppState>,
    folder_id: String,
) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.delete_folder(&folder_id)
        .map_err(|e| format!("Failed to delete folder: {}", e))
}

#[tauri::command]
fn create_user(
    state: State<AppState>,
    user: database::User,
) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.create_user(&user)
        .map_err(|e| format!("Failed to create user: {}", e))
}

#[tauri::command]
fn get_user(
    state: State<AppState>,
    user_id: String,
) -> Result<Option<database::User>, String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.get_user(&user_id)
        .map_err(|e| format!("Failed to get user: {}", e))
}

#[tauri::command]
fn update_user(
    state: State<AppState>,
    user: database::User,
) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.update_user(&user)
        .map_err(|e| format!("Failed to update user: {}", e))
}

#[tauri::command]
fn get_unsynced_items(
    state: State<AppState>,
) -> Result<Vec<(i64, String, String, String, String)>, String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.get_unsynced_items()
        .map_err(|e| format!("Failed to get unsynced items: {}", e))
}

#[tauri::command]
fn mark_as_synced(
    state: State<AppState>,
    sync_id: i64,
) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.mark_as_synced(sync_id)
        .map_err(|e| format!("Failed to mark as synced: {}", e))
}

// Canvas drawing tool commands
#[tauri::command]
fn create_canvas(
    state: State<AppState>,
    project_id: String,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let mut canvases = state.canvases.lock().unwrap();
    let history = engine::CanvasHistory::new(width, height);
    canvases.insert(project_id, history);
    Ok(())
}

#[tauri::command]
fn get_canvas_data(
    state: State<AppState>,
    project_id: String,
) -> Result<Vec<u8>, String> {
    let canvases = state.canvases.lock().unwrap();
    let history = canvases
        .get(&project_id)
        .ok_or("Canvas not found")?;
    Ok(history.buffer.data.clone())
}

#[tauri::command]
fn draw_pencil(
    state: State<AppState>,
    project_id: String,
    x: u32,
    y: u32,
    color: String,
) -> Result<(), String> {
    let mut canvases = state.canvases.lock().unwrap();
    let history = canvases
        .get_mut(&project_id)
        .ok_or("Canvas not found")?;

    let rgba = engine::tools::hex_to_rgba(&color)?;
    engine::tools::pencil(&mut history.buffer, x, y, rgba)
}

#[tauri::command]
fn draw_eraser(
    state: State<AppState>,
    project_id: String,
    x: u32,
    y: u32,
) -> Result<(), String> {
    let mut canvases = state.canvases.lock().unwrap();
    let history = canvases
        .get_mut(&project_id)
        .ok_or("Canvas not found")?;

    engine::tools::eraser(&mut history.buffer, x, y)
}

#[tauri::command]
fn draw_line(
    state: State<AppState>,
    project_id: String,
    x0: i32,
    y0: i32,
    x1: i32,
    y1: i32,
    color: String,
    save_history: bool,
) -> Result<(), String> {
    let mut canvases = state.canvases.lock().unwrap();
    let history = canvases
        .get_mut(&project_id)
        .ok_or("Canvas not found")?;

    // Save state before drawing (for undo)
    if save_history {
        history.push_state();
    }

    let rgba = engine::tools::hex_to_rgba(&color)?;
    engine::tools::line(&mut history.buffer, x0, y0, x1, y1, rgba)
}

#[tauri::command]
fn draw_rectangle(
    state: State<AppState>,
    project_id: String,
    x0: u32,
    y0: u32,
    x1: u32,
    y1: u32,
    color: String,
    filled: bool,
    save_history: bool,
) -> Result<(), String> {
    let mut canvases = state.canvases.lock().unwrap();
    let history = canvases
        .get_mut(&project_id)
        .ok_or("Canvas not found")?;

    // Save state before drawing (for undo)
    if save_history {
        history.push_state();
    }

    let rgba = engine::tools::hex_to_rgba(&color)?;
    engine::tools::rectangle(&mut history.buffer, x0, y0, x1, y1, rgba, filled)
}

#[tauri::command]
fn draw_circle(
    state: State<AppState>,
    project_id: String,
    center_x: i32,
    center_y: i32,
    end_x: i32,
    end_y: i32,
    color: String,
    filled: bool,
    save_history: bool,
) -> Result<(), String> {
    let mut canvases = state.canvases.lock().unwrap();
    let history = canvases
        .get_mut(&project_id)
        .ok_or("Canvas not found")?;

    // Save state before drawing (for undo)
    if save_history {
        history.push_state();
    }

    let rgba = engine::tools::hex_to_rgba(&color)?;
    engine::tools::circle(&mut history.buffer, center_x, center_y, end_x, end_y, rgba, filled)
}

#[tauri::command]
fn draw_fill(
    state: State<AppState>,
    project_id: String,
    x: u32,
    y: u32,
    color: String,
) -> Result<(), String> {
    let mut canvases = state.canvases.lock().unwrap();
    let history = canvases
        .get_mut(&project_id)
        .ok_or("Canvas not found")?;

    // Save state before filling (for undo)
    history.push_state();

    let rgba = engine::tools::hex_to_rgba(&color)?;
    engine::tools::fill(&mut history.buffer, x, y, rgba)
}

#[tauri::command]
fn pick_color(
    state: State<AppState>,
    project_id: String,
    x: u32,
    y: u32,
) -> Result<String, String> {
    let canvases = state.canvases.lock().unwrap();
    let history = canvases
        .get(&project_id)
        .ok_or("Canvas not found")?;

    let rgba = engine::tools::eyedropper(&history.buffer, x, y)
        .ok_or("Invalid coordinates")?;

    Ok(engine::tools::rgba_to_hex(rgba))
}

// History commands
#[tauri::command]
fn save_history_state(
    state: State<AppState>,
    project_id: String,
) -> Result<(), String> {
    let mut canvases = state.canvases.lock().unwrap();
    let history = canvases
        .get_mut(&project_id)
        .ok_or("Canvas not found")?;

    history.push_state();
    Ok(())
}

#[tauri::command]
fn undo_canvas(
    state: State<AppState>,
    project_id: String,
) -> Result<(), String> {
    let mut canvases = state.canvases.lock().unwrap();
    let history = canvases
        .get_mut(&project_id)
        .ok_or("Canvas not found")?;

    history.undo()
}

#[tauri::command]
fn redo_canvas(
    state: State<AppState>,
    project_id: String,
) -> Result<(), String> {
    let mut canvases = state.canvases.lock().unwrap();
    let history = canvases
        .get_mut(&project_id)
        .ok_or("Canvas not found")?;

    history.redo()
}

#[tauri::command]
fn can_undo(
    state: State<AppState>,
    project_id: String,
) -> Result<bool, String> {
    let canvases = state.canvases.lock().unwrap();
    let history = canvases
        .get(&project_id)
        .ok_or("Canvas not found")?;

    Ok(history.can_undo())
}

#[tauri::command]
fn can_redo(
    state: State<AppState>,
    project_id: String,
) -> Result<bool, String> {
    let canvases = state.canvases.lock().unwrap();
    let history = canvases
        .get(&project_id)
        .ok_or("Canvas not found")?;

    Ok(history.can_redo())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            db: Mutex::new(None),
            canvases: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            init_database,
            create_project,
            get_user_projects,
            update_project,
            delete_project,
            create_folder,
            get_user_folders,
            update_folder,
            delete_folder,
            create_user,
            get_user,
            update_user,
            get_unsynced_items,
            mark_as_synced,
            create_canvas,
            get_canvas_data,
            draw_pencil,
            draw_eraser,
            draw_line,
            draw_rectangle,
            draw_circle,
            draw_fill,
            pick_color,
            save_history_state,
            undo_canvas,
            redo_canvas,
            can_undo,
            can_redo,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
