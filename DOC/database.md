# AIPIX Database Architecture

## Overview

AIPIX uses a **dual-database architecture** combining **SQLite** (local) and **Supabase** (cloud) to provide both offline functionality and cloud synchronization. This approach ensures the application works seamlessly whether the user is online or offline, while maintaining data consistency across devices.

---

## Why Two Databases?

### The Problem
Modern applications need to:
1. Work offline without internet connection
2. Provide lightning-fast performance
3. Sync data across multiple devices
4. Maintain data consistency and avoid conflicts

A single database approach forces you to choose between cloud-only (no offline support) or local-only (no sync capabilities).

### The Solution: Dual Database Architecture

#### 1. **SQLite (Local Database)** - Offline & Performance
- **Purpose**: Primary data store for local operations
- **Location**: User's device (`AppData/aipix.db` on Windows)
- **Advantages**:
  - ✅ Works completely offline
  - ✅ Blazing fast queries (no network latency)
  - ✅ No data usage
  - ✅ Immediate response times
  - ✅ Privacy (data stays on device until synced)
- **Use Cases**:
  - Creating and editing pixel art projects
  - Managing folders
  - Viewing projects
  - All operations when offline

#### 2. **Supabase (Cloud Database)** - Sync & Collaboration
- **Purpose**: Cloud backup and multi-device synchronization
- **Advantages**:
  - ✅ Data backup and recovery
  - ✅ Access from multiple devices
  - ✅ Team collaboration features
  - ✅ Built-in authentication
  - ✅ Real-time updates
- **Use Cases**:
  - User authentication
  - Cross-device synchronization
  - Team collaboration
  - Data backup

---

## How It Works

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         AIPIX App                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────┐           ┌───────────────────┐    │
│  │   User Actions    │           │   User Actions    │    │
│  │   (Create/Edit)   │           │   (Login/Signup)  │    │
│  └─────────┬─────────┘           └─────────┬─────────┘    │
│            │                               │              │
│            ▼                               ▼              │
│  ┌─────────────────────┐         ┌──────────────────────┐ │
│  │  SQLite (Local DB)  │◄────────┤  Supabase Auth       │ │
│  │  - Projects         │         │  (Cloud)             │ │
│  │  - Folders          │         └──────────────────────┘ │
│  │  - User Data        │                                  │
│  │  - Sync Queue       │                                  │
│  └──────────┬──────────┘                                  │
│             │                                             │
│             │ When Online                                 │
│             ▼                                             │
│  ┌─────────────────────┐                                  │
│  │   Sync Manager      │                                  │
│  │  - Push changes     │                                  │
│  │  - Pull updates     │                                  │
│  └──────────┬──────────┘                                  │
│             │                                             │
│             ▼                                             │
│  ┌─────────────────────┐                                  │
│  │  Supabase Database  │                                  │
│  │  (Cloud)            │                                  │
│  │  - Projects         │                                  │
│  │  - Folders          │                                  │
│  │  - User Profiles    │                                  │
│  └─────────────────────┘                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Workflow Examples

#### Example 1: Creating a New Project (Offline)
```
1. User creates a project
   ↓
2. App saves to SQLite immediately (instant feedback)
   ↓
3. App adds entry to sync_queue table
   ↓
4. User continues working (no internet required)
   ↓
5. When online: Sync manager pushes to Supabase
   ↓
6. Mark as synced in sync_queue
```

#### Example 2: Login & Sync
```
1. User enters credentials
   ↓
2. Supabase Auth validates credentials
   ↓
3. App initializes SQLite database
   ↓
4. App pulls user's data from Supabase
   ↓
5. Local SQLite is populated with cloud data
   ↓
6. User can now work offline with full data
```

#### Example 3: Multi-Device Sync
```
Device A:
1. User edits project
2. Saved to local SQLite
3. Synced to Supabase

Device B:
1. User opens app (online)
2. App pulls updates from Supabase
3. Local SQLite updated with changes from Device A
4. User sees latest version
```

---

## Database Schema

### SQLite Tables

#### `users`
Stores local user information
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,           -- UUID from Supabase Auth
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    profile_picture TEXT,          -- Path or base64
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

#### `folders`
Stores project folders
```sql
CREATE TABLE folders (
    id TEXT PRIMARY KEY,           -- UUID
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,           -- Hex color
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    synced_at TEXT,                -- Last cloud sync time
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `projects`
Stores pixel art projects metadata
```sql
CREATE TABLE projects (
    id TEXT PRIMARY KEY,           -- UUID
    user_id TEXT NOT NULL,
    folder_id TEXT,                -- Optional folder
    name TEXT NOT NULL,
    width INTEGER NOT NULL,        -- Canvas width
    height INTEGER NOT NULL,       -- Canvas height
    thumbnail BLOB,                -- Preview image
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_modified TEXT NOT NULL,
    synced_at TEXT,                -- Last cloud sync time
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (folder_id) REFERENCES folders(id)
);
```

#### `project_data`
Stores actual pixel data (separate for performance)
```sql
CREATE TABLE project_data (
    project_id TEXT PRIMARY KEY,
    pixel_data BLOB NOT NULL,      -- Compressed pixel array
    layers BLOB,                   -- Layer information
    metadata TEXT,                 -- JSON metadata
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

#### `sync_queue`
Tracks pending changes to sync to cloud
```sql
CREATE TABLE sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,      -- Which table changed
    record_id TEXT NOT NULL,       -- Which record changed
    operation TEXT NOT NULL,       -- INSERT/UPDATE/DELETE
    data TEXT NOT NULL,            -- JSON of the record
    created_at TEXT NOT NULL,
    synced BOOLEAN NOT NULL DEFAULT 0
);
```

### Supabase Tables

The Supabase database mirrors the core tables:
- `users` - User profiles
- `projects` - Project metadata (without binary pixel data initially)
- `folders` - Folder organization

**Note**: Supabase tables use the same schema as SQLite but with PostgreSQL types.

---

## Synchronization Strategy

### Sync Queue Pattern

Every modification to data goes through this pattern:

```rust
// Example: Creating a project
1. Insert into SQLite projects table
2. Add to sync_queue:
   {
     table_name: "projects",
     record_id: "project-uuid",
     operation: "INSERT",
     data: "{...project json...}",
     synced: false
   }
```

### Sync Manager

The sync manager runs:
- **Automatically**: Every 5 minutes (configurable)
- **On network connect**: When device comes online
- **Manual**: User can trigger sync

```typescript
// Sync Process
1. Check if online
2. Fetch unsynced items from sync_queue
3. For each item:
   - Push to Supabase (INSERT/UPDATE/DELETE)
   - If successful: mark as synced
   - If failed: keep in queue, retry later
4. Pull updates from Supabase
5. Update local SQLite with cloud changes
```

### Conflict Resolution

**Strategy**: Last-Write-Wins (LWW)
- Each record has `updated_at` timestamp
- When conflict detected, newer timestamp wins
- Future: Can implement more sophisticated strategies

---

## Security Considerations

### SQLite (Local)
- Stored in OS-protected app data directory
- Only accessible to AIPIX app
- File system encryption (OS-level)
- Future: Add SQLite encryption with SQLCipher

### Supabase (Cloud)
- Row Level Security (RLS) policies
- Users can only access their own data
- JWT-based authentication
- HTTPS encrypted transmission

### Supabase RLS Policies Example

```sql
-- Users can only read their own data
CREATE POLICY "Users can read own projects"
ON projects FOR SELECT
USING (auth.uid() = user_id);

-- Users can only insert their own data
CREATE POLICY "Users can insert own projects"
ON projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own data
CREATE POLICY "Users can update own projects"
ON projects FOR UPDATE
USING (auth.uid() = user_id);
```

---

## Implementation Details

### Rust Backend (Tauri)

Located in `src-tauri/src/database/`

**Key Files**:
- `sqlite.rs` - SQLite connection and CRUD operations
- `models.rs` - Data structures
- `schema.rs` - Table definitions
- `sync.rs` - Sync coordination (handled by frontend)

**Tauri Commands**:
```rust
- init_database()        // Initialize SQLite
- create_project()       // Create project
- get_user_projects()    // Fetch projects
- update_project()       // Update project
- delete_project()       // Delete project
- create_folder()        // Create folder
- get_user_folders()     // Fetch folders
- update_folder()        // Update folder
- delete_folder()        // Delete folder
- get_unsynced_items()   // Get sync queue
- mark_as_synced()       // Mark item synced
```

### Frontend (React + TypeScript)

Located in `src/lib/`

**Key Files**:
- `supabase.ts` - Supabase client setup
- `auth.ts` - Authentication functions
- `sync.ts` - Synchronization logic

**Key Functions**:
```typescript
// Authentication
signUp()           // Create account
signIn()           // Login
signOut()          // Logout
resetPassword()    // Password reset

// Synchronization
pushToCloud()      // Push local changes
pullFromCloud()    // Pull cloud updates
fullSync()         // Bi-directional sync
setupAutoSync()    // Auto-sync scheduler
```

---

## Setup Instructions

### 1. Install Dependencies

```bash
# Install npm packages
npm install

# Rust dependencies are in Cargo.toml
cargo build
```

### 2. Configure Supabase

Create a `.env` file (copy from `.env.example`):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Get these values from:
1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Create a new project or open existing
3. Go to Project Settings → API
4. Copy the Project URL and anon/public key

### 3. Create Supabase Tables

Run this SQL in Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    profile_picture TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Folders table
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    folder_id UUID REFERENCES folders(id),
    name TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    thumbnail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can read own folders" ON folders
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can read own projects" ON projects
    FOR ALL USING (auth.uid() = user_id);
```

### 4. Enable Supabase Auth

1. In Supabase Dashboard → Authentication → Providers
2. Enable **Email** authentication
3. Configure email templates (optional)
4. Set redirect URLs for your app

---

## Advantages of This Architecture

### ✅ Offline-First
- App works completely offline
- All features available without internet
- No frustrating "No connection" errors

### ✅ Performance
- Instant queries (no network latency)
- Smooth 60fps UI
- No loading spinners for local operations

### ✅ Data Safety
- Automatic cloud backup
- Multi-device access
- Sync happens transparently in background

### ✅ Scalability
- SQLite handles thousands of projects locally
- Supabase handles cloud storage and scaling
- Efficient sync (only changed data)

### ✅ User Experience
- Works offline on flights, trains, etc.
- Fast and responsive
- Seamless multi-device workflow

---

## Future Enhancements

### Planned Features
1. **Real-time Collaboration**: Use Supabase Realtime for live editing
2. **Conflict Resolution UI**: Let users choose which version to keep
3. **Selective Sync**: Choose which projects to sync
4. **Export/Import**: Backup to local files
5. **SQLCipher Integration**: Encrypted local database
6. **Compression**: Compress pixel data before sync
7. **Delta Sync**: Only sync changed pixels, not full images

---

## Troubleshooting

### Issue: "Database not initialized"
**Solution**: Make sure `init_database()` is called before any database operations

### Issue: "Failed to sync"
**Solutions**:
- Check internet connection
- Verify Supabase credentials in `.env`
- Check Supabase project is active
- Review browser console for detailed errors

### Issue: "Auth error"
**Solutions**:
- Verify email provider is enabled in Supabase
- Check redirect URLs are configured
- Ensure user confirmed their email (if required)

### Issue: "Slow sync"
**Solutions**:
- Reduce sync frequency
- Implement selective sync
- Check network speed
- Consider compressing data

---

## Best Practices

### For Developers

1. **Always check online status** before syncing
2. **Handle sync errors gracefully** - don't lose user data
3. **Show sync status** to users (syncing, synced, offline)
4. **Batch operations** when possible for efficiency
5. **Test offline scenarios** thoroughly

### For Users

1. **Keep app open** during initial sync
2. **Connect to Wi-Fi** for large syncs
3. **Manually sync** before switching devices
4. **Keep app updated** for latest sync improvements

---

## Related Files

### Backend (Rust)
- `src-tauri/src/database/mod.rs` - Module exports
- `src-tauri/src/database/models.rs` - Data models
- `src-tauri/src/database/schema.rs` - SQLite schema
- `src-tauri/src/database/sqlite.rs` - SQLite operations
- `src-tauri/src/database/sync.rs` - Sync coordination
- `src-tauri/src/lib.rs` - Tauri commands
- `src-tauri/src/main.rs` - App entry point

### Frontend (React)
- `src/lib/supabase.ts` - Supabase client
- `src/lib/auth.ts` - Authentication
- `src/lib/sync.ts` - Sync manager
- `src/components/Login.tsx` - Login UI
- `src/components/CreateAccount.tsx` - Signup UI
- `src/components/ForgotPassword.tsx` - Password reset UI

---

## Summary

AIPIX's dual-database architecture provides the best of both worlds:

- **SQLite** for instant, offline-capable local operations
- **Supabase** for cloud backup, sync, and authentication
- **Sync Queue** for reliable data synchronization
- **Automatic syncing** when online
- **Graceful degradation** when offline

This architecture ensures users can create pixel art anywhere, anytime, while maintaining data consistency across all their devices.
