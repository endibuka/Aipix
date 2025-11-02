// SQLite database schema creation and migrations
use rusqlite::Connection;
use anyhow::Result;

pub fn initialize_database(conn: &Connection) -> Result<()> {
    // Enable SQLite optimizations FIRST (before creating tables)
    // Use pragma_update for settings that don't return results
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "cache_size", -64000)?;
    conn.pragma_update(None, "temp_store", "MEMORY")?;

    // Create users table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            username TEXT NOT NULL,
            profile_picture TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        (),
    )?;

    // Create folders table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS folders (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            synced_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )",
        (),
    )?;

    // Create projects table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            folder_id TEXT,
            name TEXT NOT NULL,
            width INTEGER NOT NULL,
            height INTEGER NOT NULL,
            color_mode TEXT NOT NULL DEFAULT 'rgba',
            background_color TEXT NOT NULL DEFAULT '#00000000',
            pixel_aspect_ratio TEXT NOT NULL DEFAULT '1:1',
            thumbnail BLOB,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_modified TEXT NOT NULL,
            synced_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (folder_id) REFERENCES folders(id)
        )",
        (),
    )?;

    // Create project_data table (stores pixel data)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS project_data (
            project_id TEXT PRIMARY KEY,
            pixel_data BLOB NOT NULL,
            layers BLOB,
            metadata TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id)
        )",
        (),
    )?;

    // Create team_members table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS team_members (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            team_id TEXT NOT NULL,
            role TEXT NOT NULL,
            email TEXT NOT NULL,
            username TEXT NOT NULL,
            invited_at TEXT NOT NULL,
            joined_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )",
        (),
    )?;

    // Create pending_invitations table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS pending_invitations (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            role TEXT NOT NULL,
            invited_by TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (invited_by) REFERENCES users(id)
        )",
        (),
    )?;

    // Create user_settings table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS user_settings (
            user_id TEXT PRIMARY KEY,
            grid_density TEXT NOT NULL DEFAULT 'medium',
            default_view TEXT NOT NULL DEFAULT 'grid',
            show_thumbnails BOOLEAN NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )",
        (),
    )?;

    // Create sync_queue table (tracks items that need to be synced to Supabase)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT NOT NULL,
            record_id TEXT NOT NULL,
            operation TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            synced BOOLEAN NOT NULL DEFAULT 0
        )",
        (),
    )?;

    // Create indexes for better query performance
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)",
        (),
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_projects_folder_id ON projects(folder_id)",
        (),
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id)",
        (),
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced)",
        (),
    )?;

    // Additional performance indexes
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_projects_last_modified ON projects(last_modified DESC)",
        (),
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_folders_updated_at ON folders(updated_at DESC)",
        (),
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_projects_user_folder ON projects(user_id, folder_id)",
        (),
    )?;

    // Run migrations for existing databases
    run_migrations(conn)?;

    Ok(())
}

pub fn run_migrations(conn: &Connection) -> Result<()> {
    // Check if projects table needs new columns
    let table_info: Vec<(i32, String, String)> = conn
        .prepare("PRAGMA table_info(projects)")?
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    let has_color_mode = table_info.iter().any(|(_, name, _)| name == "color_mode");
    let has_background_color = table_info.iter().any(|(_, name, _)| name == "background_color");
    let has_pixel_aspect_ratio = table_info.iter().any(|(_, name, _)| name == "pixel_aspect_ratio");

    // Add missing columns if needed
    if !has_color_mode {
        conn.execute(
            "ALTER TABLE projects ADD COLUMN color_mode TEXT NOT NULL DEFAULT 'rgba'",
            (),
        )?;
    }

    if !has_background_color {
        conn.execute(
            "ALTER TABLE projects ADD COLUMN background_color TEXT NOT NULL DEFAULT '#00000000'",
            (),
        )?;
    }

    if !has_pixel_aspect_ratio {
        conn.execute(
            "ALTER TABLE projects ADD COLUMN pixel_aspect_ratio TEXT NOT NULL DEFAULT '1:1'",
            (),
        )?;
    }

    Ok(())
}
