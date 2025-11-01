// Sync mechanism between SQLite (local) and Supabase (cloud)
import { supabase, isOnline } from './supabase';
import { invoke } from '@tauri-apps/api/core';

export interface SyncQueueItem {
  id: number;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: string;
}

/**
 * Push pending changes from SQLite to Supabase
 */
export async function pushToCloud(): Promise<{ synced: number; errors: number }> {
  if (!isOnline()) {
    console.log('Offline - skipping cloud push');
    return { synced: 0, errors: 0 };
  }

  try {
    // Get unsynced items from local SQLite
    const unsyncedItems: [number, string, string, string, string][] = await invoke('get_unsynced_items');

    let synced = 0;
    let errors = 0;

    for (const [id, tableName, recordId, operation, dataStr] of unsyncedItems) {
      try {
        const data = JSON.parse(dataStr);

        // Perform the operation on Supabase
        if (operation === 'INSERT' || operation === 'UPDATE') {
          const { error } = await supabase
            .from(tableName)
            .upsert(data, { onConflict: 'id' });

          if (error) {
            console.error(`Failed to sync ${operation} to ${tableName}:`, error);
            errors++;
            continue;
          }
        } else if (operation === 'DELETE') {
          const { error } = await supabase
            .from(tableName)
            .delete()
            .eq('id', recordId);

          if (error) {
            console.error(`Failed to sync DELETE to ${tableName}:`, error);
            errors++;
            continue;
          }
        }

        // Mark as synced in local database
        await invoke('mark_as_synced', { syncId: id });
        synced++;
      } catch (error) {
        console.error(`Error processing sync item ${id}:`, error);
        errors++;
      }
    }

    console.log(`Sync complete: ${synced} items synced, ${errors} errors`);
    return { synced, errors };
  } catch (error) {
    console.error('Failed to push to cloud:', error);
    return { synced: 0, errors: 1 };
  }
}

/**
 * Pull latest changes from Supabase to SQLite
 */
export async function pullFromCloud(userId: string): Promise<{ pulled: number; errors: number }> {
  if (!isOnline()) {
    console.log('Offline - skipping cloud pull');
    return { pulled: 0, errors: 0 };
  }

  try {
    let pulled = 0;
    let errors = 0;

    // Fetch folders from Supabase
    try {
      const { data: folders, error: foldersError } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', userId);

      if (foldersError) {
        console.error('Failed to fetch folders from Supabase:', foldersError);
        errors++;
      } else if (folders) {
        for (const folder of folders) {
          try {
            // Check if folder exists locally
            const localFolders: any[] = await invoke('get_user_folders', { userId });
            const exists = localFolders.some(f => f.id === folder.id);

            if (exists) {
              // Update existing folder
              await invoke('update_folder', { folder });
            } else {
              // Create new folder
              await invoke('create_folder', { folder });
            }
            pulled++;
          } catch (e) {
            console.error('Failed to sync folder locally:', e);
            errors++;
          }
        }
      }
    } catch (e) {
      console.error('Error pulling folders:', e);
      errors++;
    }

    // Fetch projects from Supabase
    try {
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId);

      if (projectsError) {
        console.error('Failed to fetch projects from Supabase:', projectsError);
        errors++;
      } else if (projects) {
        for (const project of projects) {
          try {
            // Check if project exists locally
            const localProjects: any[] = await invoke('get_user_projects', { userId });
            const exists = localProjects.some(p => p.id === project.id);

            if (exists) {
              // Update existing project
              await invoke('update_project', { project });
            } else {
              // Create new project
              await invoke('create_project', { project });
            }
            pulled++;
          } catch (e) {
            console.error('Failed to sync project locally:', e);
            errors++;
          }
        }
      }
    } catch (e) {
      console.error('Error pulling projects:', e);
      errors++;
    }

    console.log(`Pull complete: ${pulled} items pulled, ${errors} errors`);
    return { pulled, errors };
  } catch (error) {
    console.error('Failed to pull from cloud:', error);
    return { pulled: 0, errors: 1 };
  }
}

/**
 * Perform a full sync (pull from cloud, then push local changes)
 */
export async function fullSync(userId: string): Promise<{
  pulled: number;
  pushed: number;
  errors: number;
}> {
  if (!isOnline()) {
    console.log('Offline - skipping full sync');
    return { pulled: 0, pushed: 0, errors: 0 };
  }

  console.log('Starting full sync...');

  // First pull from cloud to get latest data
  const pullResult = await pullFromCloud(userId);

  // Then push any local changes
  const pushResult = await pushToCloud();

  return {
    pulled: pullResult.pulled,
    pushed: pushResult.synced,
    errors: pullResult.errors + pushResult.errors,
  };
}

/**
 * Set up automatic background sync
 */
export function setupAutoSync(
  userId: string,
  intervalMinutes: number = 5
): () => void {
  const intervalMs = intervalMinutes * 60 * 1000;

  const syncInterval = setInterval(async () => {
    if (isOnline()) {
      console.log('Running automatic sync...');
      await fullSync(userId);
    }
  }, intervalMs);

  // Also sync when coming back online
  const handleOnline = () => {
    console.log('Network online - syncing...');
    fullSync(userId);
  };

  window.addEventListener('online', handleOnline);

  // Return cleanup function
  return () => {
    clearInterval(syncInterval);
    window.removeEventListener('online', handleOnline);
  };
}
