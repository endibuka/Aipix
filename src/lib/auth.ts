// Authentication utilities using Supabase
import { supabase } from './supabase';
import { invoke } from '@tauri-apps/api/core';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  profile_picture?: string;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  username: string;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

/**
 * Sign up a new user with Supabase Auth
 */
export async function signUp(credentials: SignUpCredentials): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    // Sign up with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: {
        data: {
          username: credentials.username,
        },
      },
    });

    if (error) {
      return { user: null, error: error.message };
    }

    if (!data.user) {
      return { user: null, error: 'Failed to create user' };
    }

    // Create user record in local SQLite
    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email!,
      username: credentials.username,
    };

    try {
      await invoke('create_user', {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          profile_picture: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    } catch (e) {
      console.error('Failed to create local user record:', e);
    }

    // Also create user in Supabase database (if tables exist)
    try {
      await supabase.from('users').insert({
        id: user.id,
        email: user.email,
        username: user.username,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Failed to create Supabase user record:', e);
    }

    return { user, error: null };
  } catch (e: any) {
    return { user: null, error: e.message || 'An error occurred during sign up' };
  }
}

/**
 * Sign in an existing user with Supabase Auth
 */
export async function signIn(credentials: SignInCredentials): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      return { user: null, error: error.message };
    }

    if (!data.user) {
      return { user: null, error: 'Failed to sign in' };
    }

    // Fetch user from local SQLite first
    let user: AuthUser | null = null;
    try {
      const localUser: any = await invoke('get_user', { userId: data.user.id });
      if (localUser) {
        user = {
          id: localUser.id,
          email: localUser.email,
          username: localUser.username,
          profile_picture: localUser.profile_picture,
        };
      }
    } catch (e) {
      console.error('Failed to fetch local user:', e);
    }

    // If not in local DB, fetch from Supabase and sync
    if (!user) {
      try {
        const { data: supabaseUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (supabaseUser) {
          user = {
            id: supabaseUser.id,
            email: supabaseUser.email,
            username: supabaseUser.username,
            profile_picture: supabaseUser.profile_picture,
          };

          // Sync to local SQLite
          await invoke('create_user', {
            user: {
              ...supabaseUser,
              created_at: supabaseUser.created_at,
              updated_at: supabaseUser.updated_at,
            },
          });
        }
      } catch (e) {
        console.error('Failed to fetch Supabase user:', e);
      }
    }

    // Fallback to auth metadata
    if (!user) {
      user = {
        id: data.user.id,
        email: data.user.email!,
        username: data.user.user_metadata?.username || data.user.email!.split('@')[0],
      };
    }

    return { user, error: null };
  } catch (e: any) {
    return { user: null, error: e.message || 'An error occurred during sign in' };
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  } catch (e: any) {
    return { error: e.message || 'An error occurred during sign out' };
  }
}

/**
 * Request a password reset email
 */
export async function resetPassword(email: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  } catch (e: any) {
    return { error: e.message || 'An error occurred during password reset' };
  }
}

/**
 * Update user password
 */
export async function updatePassword(newPassword: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  } catch (e: any) {
    return { error: e.message || 'An error occurred during password update' };
  }
}

/**
 * Get the currently authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // Try to get from local SQLite first
    try {
      const localUser: any = await invoke('get_user', { userId: user.id });
      if (localUser) {
        return {
          id: localUser.id,
          email: localUser.email,
          username: localUser.username,
          profile_picture: localUser.profile_picture,
        };
      }
    } catch (e) {
      console.error('Failed to fetch local user:', e);
    }

    // Fallback to auth metadata
    return {
      id: user.id,
      email: user.email!,
      username: user.user_metadata?.username || user.email!.split('@')[0],
    };
  } catch (e) {
    console.error('Failed to get current user:', e);
    return null;
  }
}

/**
 * Listen for auth state changes
 */
export function onAuthStateChange(
  callback: (user: AuthUser | null) => void
) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (_event, session) => {
      if (session?.user) {
        const user = await getCurrentUser();
        callback(user);
      } else {
        callback(null);
      }
    }
  );

  return () => {
    subscription.unsubscribe();
  };
}
