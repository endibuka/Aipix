// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use aipix_lib::{database, engine, commands, AppState};
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

#[tauri::command]
fn replace_color(
    state: State<AppState>,
    project_id: String,
    target_color: String,
    new_color: String,
) -> Result<(), String> {
    let mut canvases = state.canvases.lock().unwrap();
    let history = canvases
        .get_mut(&project_id)
        .ok_or("Canvas not found")?;

    let target_rgba = engine::tools::hex_to_rgba(&target_color)?;
    let new_rgba = engine::tools::hex_to_rgba(&new_color)?;

    engine::tools::replace_all_color(&mut history.buffer, target_rgba, new_rgba);

    Ok(())
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

// Selection commands

#[tauri::command]
fn create_selection(
    state: State<AppState>,
    project_id: String,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let mut selections = state.selections.lock().unwrap();
    selections.insert(project_id, engine::Selection::new(width, height));
    Ok(())
}

#[tauri::command]
fn select_rectangle(
    state: State<AppState>,
    project_id: String,
    x0: u32,
    y0: u32,
    x1: u32,
    y1: u32,
    mode: engine::SelectionMode,
) -> Result<engine::Selection, String> {
    let mut selections = state.selections.lock().unwrap();
    let selection = selections
        .get_mut(&project_id)
        .ok_or("Selection not found")?;

    engine::tools::select_rectangle(selection, x0, y0, x1, y1, mode);
    Ok(selection.clone())
}

#[tauri::command]
fn select_ellipse(
    state: State<AppState>,
    project_id: String,
    center_x: i32,
    center_y: i32,
    end_x: i32,
    end_y: i32,
    mode: engine::SelectionMode,
) -> Result<engine::Selection, String> {
    let mut selections = state.selections.lock().unwrap();
    let selection = selections
        .get_mut(&project_id)
        .ok_or("Selection not found")?;

    engine::tools::select_ellipse(selection, center_x, center_y, end_x, end_y, mode);
    Ok(selection.clone())
}

#[tauri::command]
fn select_lasso(
    state: State<AppState>,
    project_id: String,
    points: Vec<(i32, i32)>,
    mode: engine::SelectionMode,
) -> Result<engine::Selection, String> {
    let mut selections = state.selections.lock().unwrap();
    let selection = selections
        .get_mut(&project_id)
        .ok_or("Selection not found")?;

    engine::tools::select_lasso_add_point(selection, &points, mode);
    Ok(selection.clone())
}

#[tauri::command]
fn select_magic_wand(
    state: State<AppState>,
    project_id: String,
    x: u32,
    y: u32,
    tolerance: u8,
    mode: engine::SelectionMode,
) -> Result<engine::Selection, String> {
    let mut canvases = state.canvases.lock().unwrap();
    let mut selections = state.selections.lock().unwrap();

    let history = canvases
        .get_mut(&project_id)
        .ok_or("Canvas not found")?;

    let selection = selections
        .get_mut(&project_id)
        .ok_or("Selection not found")?;

    engine::tools::select_magic_wand(&history.buffer, selection, x, y, tolerance, mode)?;
    Ok(selection.clone())
}

#[tauri::command]
fn select_all(
    state: State<AppState>,
    project_id: String,
) -> Result<engine::Selection, String> {
    let mut selections = state.selections.lock().unwrap();
    let selection = selections
        .get_mut(&project_id)
        .ok_or("Selection not found")?;

    selection.select_all();
    Ok(selection.clone())
}

#[tauri::command]
fn deselect(
    state: State<AppState>,
    project_id: String,
) -> Result<(), String> {
    let mut selections = state.selections.lock().unwrap();
    let selection = selections
        .get_mut(&project_id)
        .ok_or("Selection not found")?;

    selection.clear();
    Ok(())
}

#[tauri::command]
fn invert_selection(
    state: State<AppState>,
    project_id: String,
) -> Result<engine::Selection, String> {
    let mut selections = state.selections.lock().unwrap();
    let selection = selections
        .get_mut(&project_id)
        .ok_or("Selection not found")?;

    selection.invert();
    Ok(selection.clone())
}

#[tauri::command]
fn get_selection(
    state: State<AppState>,
    project_id: String,
) -> Result<engine::Selection, String> {
    let selections = state.selections.lock().unwrap();
    let selection = selections
        .get(&project_id)
        .ok_or("Selection not found")?;

    Ok(selection.clone())
}

#[tauri::command]
fn copy_selection(
    state: State<AppState>,
    project_id: String,
) -> Result<(), String> {
    let mut canvases = state.canvases.lock().unwrap();
    let selections = state.selections.lock().unwrap();

    let history = canvases
        .get_mut(&project_id)
        .ok_or("Canvas not found")?;

    let selection = selections
        .get(&project_id)
        .ok_or("Selection not found")?;

    if let Some(extracted) = engine::tools::extract_selection(&history.buffer, selection) {
        let mut clipboard = state.clipboard.lock().unwrap();
        *clipboard = Some(extracted);
        Ok(())
    } else {
        Err("No selection to copy".to_string())
    }
}

#[tauri::command]
fn cut_selection(
    state: State<AppState>,
    project_id: String,
) -> Result<(), String> {
    let mut canvases = state.canvases.lock().unwrap();
    let selections = state.selections.lock().unwrap();

    let history = canvases
        .get_mut(&project_id)
        .ok_or("Canvas not found")?;

    let selection = selections
        .get(&project_id)
        .ok_or("Selection not found")?;

    // Save to clipboard
    if let Some(extracted) = engine::tools::extract_selection(&history.buffer, selection) {
        let mut clipboard = state.clipboard.lock().unwrap();
        *clipboard = Some(extracted);

        // Delete from canvas
        history.push_state();
        engine::tools::delete_selection(&mut history.buffer, selection);
        Ok(())
    } else {
        Err("No selection to cut".to_string())
    }
}

#[tauri::command]
fn paste_selection(
    state: State<AppState>,
    project_id: String,
    x: u32,
    y: u32,
) -> Result<(), String> {
    let mut canvases = state.canvases.lock().unwrap();
    let clipboard = state.clipboard.lock().unwrap();

    let history = canvases
        .get_mut(&project_id)
        .ok_or("Canvas not found")?;

    if let Some((ref buffer, _, _)) = *clipboard {
        history.push_state();
        engine::tools::paste_buffer(&mut history.buffer, buffer, x, y)?;
        Ok(())
    } else {
        Err("Clipboard is empty".to_string())
    }
}

#[tauri::command]
fn delete_selected(
    state: State<AppState>,
    project_id: String,
) -> Result<(), String> {
    let mut canvases = state.canvases.lock().unwrap();
    let selections = state.selections.lock().unwrap();

    let history = canvases
        .get_mut(&project_id)
        .ok_or("Canvas not found")?;

    let selection = selections
        .get(&project_id)
        .ok_or("Selection not found")?;

    history.push_state();
    engine::tools::delete_selection(&mut history.buffer, selection);
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            db: Mutex::new(None),
            canvases: Mutex::new(HashMap::new()),
            selections: Mutex::new(HashMap::new()),
            clipboard: Mutex::new(None),
        })
        .manage(commands::RendererState::new())
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
            replace_color,
            save_history_state,
            undo_canvas,
            redo_canvas,
            can_undo,
            can_redo,
            create_selection,
            select_rectangle,
            select_ellipse,
            select_lasso,
            select_magic_wand,
            select_all,
            deselect,
            invert_selection,
            get_selection,
            copy_selection,
            cut_selection,
            paste_selection,
            delete_selected,
            // Native Skia rendering commands
            commands::rendering::init_renderer,
            commands::rendering::draw_stroke,
            commands::rendering::fill_rect,
            commands::rendering::render_viewport,
            commands::rendering::get_canvas_image,
            commands::rendering::clear_canvas,
            commands::rendering::resize_canvas,
            commands::rendering::get_dirty_bounds,
            commands::rendering::clear_dirty_region,
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
