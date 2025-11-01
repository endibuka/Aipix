// Supabase client configuration and utilities
import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Replace these with your actual Supabase project credentials
// You can find these in your Supabase project settings at https://app.supabase.com
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Database types for Supabase tables
export interface SupabaseUser {
  id: string;
  email: string;
  username: string;
  profile_picture?: string;
  created_at: string;
  updated_at: string;
}

export interface SupabaseProject {
  id: string;
  user_id: string;
  folder_id?: string;
  name: string;
  width: number;
  height: number;
  thumbnail?: string; // base64 encoded image
  created_at: string;
  updated_at: string;
  last_modified: string;
}

export interface SupabaseFolder {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

// Check if user is online
export const isOnline = () => navigator.onLine;

// Listen for online/offline events
export const setupNetworkListeners = (
  onOnline: () => void,
  onOffline: () => void
) => {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
};
