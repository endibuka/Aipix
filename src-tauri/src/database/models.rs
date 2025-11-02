// Data models for the application
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub email: String,
    pub username: String,
    pub profile_picture: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub user_id: String,
    pub folder_id: Option<String>,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub color_mode: String,
    pub background_color: String,
    pub pixel_aspect_ratio: String,
    pub thumbnail: Option<Vec<u8>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_modified: DateTime<Utc>,
    pub synced_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub color: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub synced_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamMember {
    pub id: String,
    pub user_id: String,
    pub team_id: String,
    pub role: String,
    pub email: String,
    pub username: String,
    pub invited_at: DateTime<Utc>,
    pub joined_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingInvitation {
    pub id: String,
    pub email: String,
    pub role: String,
    pub invited_by: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSettings {
    pub user_id: String,
    pub grid_density: String,
    pub default_view: String,
    pub show_thumbnails: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
