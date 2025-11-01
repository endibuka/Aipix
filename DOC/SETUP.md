# AIPIX Setup Guide

This guide will help you set up AIPIX with the dual database system (SQLite + Supabase).

## Prerequisites

- Node.js 18+ and npm
- Rust and Cargo
- A Supabase account (free tier works)

## Step 1: Install Dependencies

```bash
# Install npm dependencies
npm install

# This will install:
# - @supabase/supabase-js for cloud database
# - @tauri-apps/api for Rust backend communication
# - React, TypeScript, and other frontend dependencies
```

## Step 2: Create Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in:
   - **Name**: AIPIX (or your preferred name)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to you
4. Click "Create new project" (takes ~2 minutes)

## Step 3: Get Supabase Credentials

1. In your Supabase project dashboard
2. Click on **Settings** (gear icon) in the sidebar
3. Go to **API** section
4. Copy these two values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)

## Step 4: Configure Environment Variables

1. In the AIPIX root directory, create a `.env` file:

```bash
# Copy the example file
cp .env.example .env
```

2. Edit `.env` and add your credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**⚠️ Important**: Never commit `.env` to git! It's already in `.gitignore`.

## Step 5: Create Supabase Database Tables

1. In your Supabase project, click **SQL Editor** in the sidebar
2. Click **New Query**
3. Copy and paste this SQL:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (synced with local SQLite)
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
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    thumbnail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_folders_user_id ON folders(user_id);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_folder_id ON projects(folder_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data

-- Users policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Folders policies
CREATE POLICY "Users can view own folders" ON folders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own folders" ON folders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders" ON folders
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders" ON folders
    FOR DELETE USING (auth.uid() = user_id);

-- Projects policies
CREATE POLICY "Users can view own projects" ON projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects" ON projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON projects
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON projects
    FOR DELETE USING (auth.uid() = user_id);
```

4. Click **Run** (or press `Ctrl+Enter`)
5. You should see "Success. No rows returned"

## Step 6: Enable Supabase Authentication

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Find **Email** provider
3. Make sure it's **enabled** (should be by default)
4. Optional settings:
   - **Confirm email**: Toggle on if you want users to verify email
   - **Secure email change**: Recommended to keep enabled
   - **Secure password change**: Recommended to keep enabled

## Step 7: Configure Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Add these **Redirect URLs** (for development):
   ```
   http://localhost:1420
   http://localhost:1420/reset-password
   ```
3. In production, add your actual domain

## Step 8: Test the Build

```bash
# Build the Rust backend
cargo build --manifest-path=src-tauri/Cargo.toml

# Run development server
npm run tauri:dev
```

The app should launch! If you see errors, check:
- All dependencies installed (`npm install` completed)
- `.env` file exists with correct credentials
- Supabase tables created successfully

## Step 9: Create Your First Account

1. Click **Create Account**
2. Enter:
   - **Username**: your username
   - **Email**: your email
   - **Password**: at least 6 characters
3. Click **Create Account**
4. If email confirmation is enabled, check your email
5. Click the confirmation link
6. Return to app and **Login**

## Troubleshooting

### Issue: "Failed to initialize database"
**Solution**: Make sure you have write permissions in the app directory. The SQLite database is created at:
- Windows: `%APPDATA%/aipix/aipix.db`
- macOS: `~/Library/Application Support/aipix/aipix.db`
- Linux: `~/.local/share/aipix/aipix.db`

### Issue: "Invalid API key"
**Solutions**:
- Double-check `.env` file has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Make sure you copied the **anon/public** key, not the service_role key
- Restart the dev server after changing `.env`

### Issue: "Failed to sign up"
**Solutions**:
- Check Supabase **Authentication** → **Providers** has Email enabled
- Verify Supabase tables were created (check SQL Editor)
- Look at browser console for detailed error
- Check Supabase **Logs** → **Auth Logs** for server-side errors

### Issue: "Row Level Security" errors
**Solutions**:
- Make sure all RLS policies were created (run the SQL again)
- Verify you're logged in (check localStorage has auth token)
- Check Supabase **Authentication** → **Users** to see if user exists

### Issue: Build errors with Rust/Cargo
**Solutions**:
```bash
# Update Rust
rustup update

# Clean and rebuild
cargo clean --manifest-path=src-tauri/Cargo.toml
cargo build --manifest-path=src-tauri/Cargo.toml
```

## Verify Setup

### Check 1: SQLite Database Created
After first launch, check if database file exists:

**Windows**:
```powershell
dir $env:APPDATA\aipix\
```

**macOS/Linux**:
```bash
ls ~/Library/Application\ Support/aipix/  # macOS
ls ~/.local/share/aipix/                  # Linux
```

You should see `aipix.db` file.

### Check 2: Supabase Connection
Open browser console (F12) and look for:
- No "Invalid API key" errors
- No "Failed to connect to Supabase" errors

### Check 3: Authentication Working
Try to create an account:
- Should succeed or show meaningful error
- Check Supabase **Authentication** → **Users** to see the new user

### Check 4: Sync Working
After creating account and logging in:
1. Create a test folder or project
2. Check browser console for sync messages
3. Go to Supabase **Table Editor** → **folders** or **projects**
4. You should see your data synced!

## Next Steps

After successful setup:

1. **Read the Documentation**: Check `DOC/database.md` to understand the architecture
2. **Explore the App**: Create projects, folders, test offline mode
3. **Customize**: Modify the UI, add features
4. **Deploy**: Build for production with `npm run tauri:build`

## Development Tips

### Hot Reload
The app supports hot reload:
- Frontend changes (React): Auto-refresh
- Backend changes (Rust): Requires restart

### View SQLite Database
Use a SQLite viewer to inspect local data:
- [DB Browser for SQLite](https://sqlitebrowser.org/) (Free, cross-platform)
- [TablePlus](https://tableplus.com/) (Free tier available)

### Monitor Supabase
Watch real-time activity:
1. **Table Editor**: See data as it syncs
2. **API Logs**: Monitor all database queries
3. **Auth Logs**: Track login/signup attempts

### Debug Sync Issues
Enable verbose logging:
```typescript
// In src/lib/sync.ts, uncomment console.log statements
console.log('Syncing...', items)
```

## Security Checklist

- [ ] `.env` file not committed to git
- [ ] Using **anon** key, not service_role key
- [ ] Row Level Security enabled on all tables
- [ ] RLS policies properly restrict access
- [ ] Email confirmation enabled (recommended)
- [ ] Strong password requirements

## Production Deployment

Before deploying:

1. **Update Redirect URLs**: Add production domain to Supabase
2. **Environment Variables**: Set production `.env` values
3. **Build**: `npm run tauri:build`
4. **Test**: Thoroughly test offline/online scenarios
5. **Monitor**: Set up Supabase logging and monitoring

## Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Read `DOC/database.md` for architecture details
3. Check Supabase documentation: https://supabase.com/docs
4. Check Tauri documentation: https://tauri.app/

---

**Congratulations!** 🎉 You've successfully set up AIPIX with dual database support. Happy pixel art creating!
