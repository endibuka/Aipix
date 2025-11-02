// SQLite database connection and operations
use rusqlite::{Connection, params, OptionalExtension};
use anyhow::{Result, Context};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use chrono::Utc;

use super::models::*;
use super::schema::initialize_database;

pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    /// Create a new database connection
    pub fn new(db_path: PathBuf) -> Result<Self> {
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&db_path)
            .context("Failed to open SQLite database")?;

        // Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON", ())?;

        // Initialize schema
        initialize_database(&conn)?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    // ===== User Operations =====

    pub fn create_user(&self, user: &User) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO users (id, email, username, profile_picture, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                user.id,
                user.email,
                user.username,
                user.profile_picture,
                user.created_at.to_rfc3339(),
                user.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn get_user(&self, user_id: &str) -> Result<Option<User>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, email, username, profile_picture, created_at, updated_at FROM users WHERE id = ?1"
        )?;

        let user = stmt.query_row(params![user_id], |row| {
            Ok(User {
                id: row.get(0)?,
                email: row.get(1)?,
                username: row.get(2)?,
                profile_picture: row.get(3)?,
                created_at: row.get::<_, String>(4)?.parse().unwrap(),
                updated_at: row.get::<_, String>(5)?.parse().unwrap(),
            })
        }).optional()?;

        Ok(user)
    }

    pub fn update_user(&self, user: &User) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE users SET email = ?1, username = ?2, profile_picture = ?3, updated_at = ?4 WHERE id = ?5",
            params![
                user.email,
                user.username,
                user.profile_picture,
                user.updated_at.to_rfc3339(),
                user.id,
            ],
        )?;
        Ok(())
    }

    // ===== Project Operations =====

    pub fn create_project(&self, project: &Project) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // Insert project
        conn.execute(
            "INSERT INTO projects (id, user_id, folder_id, name, width, height, color_mode, background_color, pixel_aspect_ratio, thumbnail, created_at, updated_at, last_modified, synced_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                project.id,
                project.user_id,
                project.folder_id,
                project.name,
                project.width,
                project.height,
                project.color_mode,
                project.background_color,
                project.pixel_aspect_ratio,
                project.thumbnail,
                project.created_at.to_rfc3339(),
                project.updated_at.to_rfc3339(),
                project.last_modified.to_rfc3339(),
                project.synced_at.as_ref().map(|t| t.to_rfc3339()),
            ],
        )?;

        // Add to sync queue - reuse same connection to avoid deadlock
        conn.execute(
            "INSERT INTO sync_queue (table_name, record_id, operation, data, created_at, synced)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
            params![
                "projects",
                &project.id,
                "INSERT",
                &serde_json::to_string(project)?,
                Utc::now().to_rfc3339(),
            ],
        )?;

        Ok(())
    }

    pub fn get_projects_by_user(&self, user_id: &str) -> Result<Vec<Project>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, user_id, folder_id, name, width, height, color_mode, background_color, pixel_aspect_ratio, thumbnail, created_at, updated_at, last_modified, synced_at
             FROM projects WHERE user_id = ?1 ORDER BY last_modified DESC"
        )?;

        let projects = stmt.query_map(params![user_id], |row| {
            Ok(Project {
                id: row.get(0)?,
                user_id: row.get(1)?,
                folder_id: row.get(2)?,
                name: row.get(3)?,
                width: row.get(4)?,
                height: row.get(5)?,
                color_mode: row.get(6)?,
                background_color: row.get(7)?,
                pixel_aspect_ratio: row.get(8)?,
                thumbnail: row.get(9)?,
                created_at: row.get::<_, String>(10)?.parse().unwrap(),
                updated_at: row.get::<_, String>(11)?.parse().unwrap(),
                last_modified: row.get::<_, String>(12)?.parse().unwrap(),
                synced_at: row.get::<_, Option<String>>(13)?
                    .and_then(|s| s.parse().ok()),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(projects)
    }

    pub fn update_project(&self, project: &Project) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE projects SET name = ?1, width = ?2, height = ?3, color_mode = ?4, background_color = ?5, pixel_aspect_ratio = ?6, thumbnail = ?7, updated_at = ?8, last_modified = ?9, folder_id = ?10
             WHERE id = ?11",
            params![
                project.name,
                project.width,
                project.height,
                project.color_mode,
                project.background_color,
                project.pixel_aspect_ratio,
                project.thumbnail,
                project.updated_at.to_rfc3339(),
                project.last_modified.to_rfc3339(),
                project.folder_id,
                project.id,
            ],
        )?;

        // Add to sync queue - reuse same connection to avoid deadlock
        conn.execute(
            "INSERT INTO sync_queue (table_name, record_id, operation, data, created_at, synced)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
            params![
                "projects",
                &project.id,
                "UPDATE",
                &serde_json::to_string(project)?,
                Utc::now().to_rfc3339(),
            ],
        )?;

        Ok(())
    }

    pub fn delete_project(&self, project_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // Delete project data first
        conn.execute("DELETE FROM project_data WHERE project_id = ?1", params![project_id])?;

        // Delete project
        conn.execute("DELETE FROM projects WHERE id = ?1", params![project_id])?;

        // Add to sync queue - reuse same connection to avoid deadlock
        conn.execute(
            "INSERT INTO sync_queue (table_name, record_id, operation, data, created_at, synced)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
            params![
                "projects",
                project_id,
                "DELETE",
                "{}",
                Utc::now().to_rfc3339(),
            ],
        )?;

        Ok(())
    }

    // ===== Folder Operations =====

    pub fn create_folder(&self, folder: &Folder) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO folders (id, user_id, name, color, created_at, updated_at, synced_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                folder.id,
                folder.user_id,
                folder.name,
                folder.color,
                folder.created_at.to_rfc3339(),
                folder.updated_at.to_rfc3339(),
                folder.synced_at.as_ref().map(|t| t.to_rfc3339()),
            ],
        )?;

        // Add to sync queue - reuse same connection to avoid deadlock
        conn.execute(
            "INSERT INTO sync_queue (table_name, record_id, operation, data, created_at, synced)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
            params![
                "folders",
                &folder.id,
                "INSERT",
                &serde_json::to_string(folder)?,
                Utc::now().to_rfc3339(),
            ],
        )?;

        Ok(())
    }

    pub fn get_folders_by_user(&self, user_id: &str) -> Result<Vec<Folder>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, user_id, name, color, created_at, updated_at, synced_at
             FROM folders WHERE user_id = ?1 ORDER BY name"
        )?;

        let folders = stmt.query_map(params![user_id], |row| {
            Ok(Folder {
                id: row.get(0)?,
                user_id: row.get(1)?,
                name: row.get(2)?,
                color: row.get(3)?,
                created_at: row.get::<_, String>(4)?.parse().unwrap(),
                updated_at: row.get::<_, String>(5)?.parse().unwrap(),
                synced_at: row.get::<_, Option<String>>(6)?
                    .and_then(|s| s.parse().ok()),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(folders)
    }

    pub fn update_folder(&self, folder: &Folder) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE folders SET name = ?1, color = ?2, updated_at = ?3 WHERE id = ?4",
            params![
                folder.name,
                folder.color,
                folder.updated_at.to_rfc3339(),
                folder.id,
            ],
        )?;

        // Add to sync queue - reuse same connection to avoid deadlock
        conn.execute(
            "INSERT INTO sync_queue (table_name, record_id, operation, data, created_at, synced)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
            params![
                "folders",
                &folder.id,
                "UPDATE",
                &serde_json::to_string(folder)?,
                Utc::now().to_rfc3339(),
            ],
        )?;

        Ok(())
    }

    pub fn delete_folder(&self, folder_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // Remove folder reference from projects
        conn.execute("UPDATE projects SET folder_id = NULL WHERE folder_id = ?1", params![folder_id])?;

        // Delete folder
        conn.execute("DELETE FROM folders WHERE id = ?1", params![folder_id])?;

        // Add to sync queue - reuse same connection to avoid deadlock
        conn.execute(
            "INSERT INTO sync_queue (table_name, record_id, operation, data, created_at, synced)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
            params![
                "folders",
                folder_id,
                "DELETE",
                "{}",
                Utc::now().to_rfc3339(),
            ],
        )?;

        Ok(())
    }

    // ===== Sync Queue Operations =====

    fn add_to_sync_queue(&self, table_name: &str, record_id: &str, operation: &str, data: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO sync_queue (table_name, record_id, operation, data, created_at, synced)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
            params![
                table_name,
                record_id,
                operation,
                data,
                Utc::now().to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn get_unsynced_items(&self) -> Result<Vec<(i64, String, String, String, String)>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, table_name, record_id, operation, data FROM sync_queue WHERE synced = 0 ORDER BY id"
        )?;

        let items = stmt.query_map(params![], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(items)
    }

    pub fn mark_as_synced(&self, sync_id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE sync_queue SET synced = 1 WHERE id = ?1",
            params![sync_id],
        )?;
        Ok(())
    }
}
