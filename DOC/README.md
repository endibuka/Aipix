# AIPIX Database System Documentation

Welcome to the AIPIX database documentation! This directory contains comprehensive guides for understanding and setting up AIPIX's dual-database architecture.

## 📚 Documentation Files

### [database.md](./database.md) - Complete Architecture Guide
**The main technical documentation explaining how AIPIX's dual-database system works.**

**What you'll learn**:
- Why we use two databases (SQLite + Supabase)
- How offline-first architecture works
- Data synchronization strategies
- Complete database schema
- Security considerations
- Troubleshooting guide

**Read this if you want to**:
- Understand the architecture
- Learn how sync works
- Modify the database structure
- Implement new features

### [SETUP.md](./SETUP.md) - Step-by-Step Setup Instructions
**Practical guide to get AIPIX running with databases configured.**

**What you'll learn**:
- How to install dependencies
- How to create a Supabase project
- How to configure environment variables
- How to create database tables
- How to test your setup
- Common issues and solutions

**Read this if you want to**:
- Set up AIPIX for development
- Get the app running quickly
- Fix setup problems

## 🚀 Quick Start

1. **Read**: [SETUP.md](./SETUP.md) - Follow the step-by-step guide
2. **Understand**: [database.md](./database.md) - Learn how it works
3. **Build**: Run `npm run tauri:dev`
4. **Create**: Make pixel art!

## 🗂️ File Structure

```
AIPIX/
├── src/                        # Frontend (React + TypeScript)
│   ├── components/            # UI components
│   │   ├── Login.tsx         # Login page (uses Supabase auth)
│   │   ├── CreateAccount.tsx  # Signup page
│   │   └── Dashboard.tsx      # Main app (uses SQLite data)
│   └── lib/                   # Utilities
│       ├── supabase.ts       # Supabase client config
│       ├── auth.ts           # Authentication functions
│       └── sync.ts           # Sync manager
│
├── src-tauri/                 # Backend (Rust)
│   └── src/
│       ├── database/          # Database module
│       │   ├── mod.rs        # Module exports
│       │   ├── models.rs     # Data structures
│       │   ├── schema.rs     # SQLite tables
│       │   ├── sqlite.rs     # SQLite operations
│       │   └── sync.rs       # Sync coordination
│       ├── lib.rs            # Tauri commands
│       └── main.rs           # App entry point
│
├── DOC/                       # Documentation (you are here!)
│   ├── README.md             # This file
│   ├── database.md           # Architecture guide
│   └── SETUP.md              # Setup instructions
│
├── .env.example               # Example environment variables
└── .env                       # Your credentials (create this!)
```

## 🎯 Key Concepts

### SQLite (Local Database)
- **Location**: User's device
- **Purpose**: Offline-first data storage
- **Speed**: Lightning fast (no network)
- **Use**: All CRUD operations happen here first

### Supabase (Cloud Database)
- **Location**: Cloud (PostgreSQL)
- **Purpose**: Backup, sync, multi-device
- **Features**: Authentication, RLS, real-time
- **Use**: Login, sync, cloud backup

### Sync Queue
- **Purpose**: Track what needs syncing
- **Process**: Local changes → Queue → Push to cloud
- **Reliable**: Retries failed syncs automatically

## 📖 Common Tasks

### Adding a New Table

1. **Define in Rust** (`src-tauri/src/database/models.rs`):
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MyNewTable {
    pub id: String,
    pub user_id: String,
    pub data: String,
    pub created_at: DateTime<Utc>,
}
```

2. **Create in SQLite** (`src-tauri/src/database/schema.rs`):
```rust
conn.execute(
    "CREATE TABLE IF NOT EXISTS my_new_table (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )",
    (),
)?;
```

3. **Create in Supabase** (SQL Editor):
```sql
CREATE TABLE my_new_table (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    data TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE my_new_table ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Users can manage own data" ON my_new_table
    FOR ALL USING (auth.uid() = user_id);
```

4. **Add Tauri Commands** (`src-tauri/src/lib.rs`):
```rust
#[tauri::command]
fn create_my_data(state: State<AppState>, data: MyNewTable) -> Result<(), String> {
    // Implementation
}
```

### Testing Offline Mode

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Select **Offline** from throttling dropdown
4. App should still work!
5. Create/edit data
6. Go back **Online**
7. Watch data sync automatically

### Debugging Sync Issues

1. **Check sync queue**:
```typescript
const unsynced = await invoke('get_unsynced_items');
console.log('Pending sync:', unsynced);
```

2. **Manual sync**:
```typescript
import { fullSync } from './lib/sync';
await fullSync(userId);
```

3. **Check Supabase logs**:
   - Dashboard → Logs → API/Auth
   - Look for errors or failed requests

## 🔒 Security Best Practices

### ✅ Do
- Use environment variables for secrets
- Enable Row Level Security (RLS)
- Validate user input
- Use HTTPS in production
- Keep dependencies updated
- Test authentication flows

### ❌ Don't
- Commit `.env` to git
- Use service_role key in frontend
- Trust client-side data
- Skip RLS policies
- Store passwords in plain text
- Disable CORS without understanding risks

## 🧪 Testing Checklist

- [ ] App launches without errors
- [ ] Can create account
- [ ] Email confirmation works (if enabled)
- [ ] Can log in
- [ ] Can log out
- [ ] Data appears in dashboard
- [ ] Can create folders
- [ ] Can create projects
- [ ] Works offline
- [ ] Data syncs when online
- [ ] Multi-device sync works
- [ ] RLS prevents unauthorized access

## 📊 Performance Tips

### SQLite Optimization
```rust
// Use transactions for bulk operations
conn.execute("BEGIN TRANSACTION", ())?;
// ... multiple inserts/updates
conn.execute("COMMIT", ())?;

// Use indexes for frequent queries
conn.execute(
    "CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)",
    (),
)?;
```

### Supabase Optimization
```typescript
// Select only needed columns
const { data } = await supabase
    .from('projects')
    .select('id, name, thumbnail')  // Not SELECT *
    .eq('user_id', userId);

// Use pagination for large datasets
const { data } = await supabase
    .from('projects')
    .select('*')
    .range(0, 9)  // First 10 items
    .eq('user_id', userId);
```

### Sync Optimization
```typescript
// Batch sync operations
const items = await invoke('get_unsynced_items');
const batches = chunk(items, 50); // Process in batches of 50

for (const batch of batches) {
    await syncBatch(batch);
}
```

## 🆘 Getting Help

### Documentation
1. **Architecture**: Read [database.md](./database.md)
2. **Setup Issues**: Check [SETUP.md](./SETUP.md)
3. **Supabase Docs**: https://supabase.com/docs
4. **Tauri Docs**: https://tauri.app/

### Common Questions

**Q: Why SQLite AND Supabase?**
A: SQLite for offline speed, Supabase for cloud sync. Best of both worlds!

**Q: What happens if sync fails?**
A: Changes stay in sync_queue and retry automatically when online.

**Q: Can I use only SQLite (no cloud)?**
A: Yes, but you lose multi-device sync and cloud backup. Just don't call sync functions.

**Q: Can I use only Supabase (no local)?**
A: No, SQLite is required for offline functionality. It's a core feature.

**Q: How to reset local database?**
A: Delete the `aipix.db` file in your app data directory. Next launch will recreate it.

**Q: How often does sync run?**
A: Every 5 minutes when online, plus immediately when coming online. Configurable in `sync.ts`.

## 🎨 Future Enhancements

Potential improvements to the database system:

1. **Real-time Sync**: Use Supabase Realtime for instant updates
2. **Conflict Resolution UI**: Let users choose versions manually
3. **Selective Sync**: Choose which projects to sync
4. **Compression**: Compress pixel data before sync
5. **Encryption**: Add SQLCipher for encrypted local storage
6. **Delta Sync**: Only sync changed pixels, not full images
7. **Version History**: Track project changes over time
8. **Collaboration**: Real-time multi-user editing

## 📝 Contributing

When contributing database changes:

1. Update models in `src-tauri/src/database/models.rs`
2. Update schema in `src-tauri/src/database/schema.rs`
3. Update Supabase SQL in setup docs
4. Add Tauri commands if needed
5. Update this documentation
6. Test offline/online scenarios
7. Test sync functionality
8. Update RLS policies if needed

## 📜 License

AIPIX is licensed under [Your License]. See LICENSE file for details.

---

**Happy Coding!** 🚀

For questions or issues, please refer to the documentation files above or check the main project README.
