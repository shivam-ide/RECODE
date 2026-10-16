import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://fhzidfwvncmwfgxrkuxt.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_DWTqcwvBHjfHSzUUdoQgZQ_1n67nKII';

export const IS_GUEST_STORAGE_KEY = 'recode_is_guest';
export const GUEST_SESSION_ID_STORAGE_KEY = 'recode_guest_session_id';
export const USER_PROFILE_STORAGE_KEY = 'recode_user_profile';
export const GUEST_SESSION_STORAGE_KEY = 'recode_guest_session';
export const AUTH_TOKEN_STORAGE_KEY = 'recode_access_token';

/**
 * Supabase client instance for client-side authentication and RLS queries
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Generate standard RFC4122 v4 UUID
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Check if the active session is strictly a guest session
 */
export function isGuestSession() {
  try {
    return localStorage.getItem(IS_GUEST_STORAGE_KEY) === 'true';
  } catch {
    return true;
  }
}

/**
 * Retrieve stored auth bearer access token
 */
export function getStoredAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Retrieve current guest session UUID or generate and persist one
 */
export function getStoredGuestSessionId() {
  try {
    let sessionId =
      localStorage.getItem(GUEST_SESSION_ID_STORAGE_KEY) ||
      localStorage.getItem(GUEST_SESSION_STORAGE_KEY);
    if (!sessionId || sessionId.trim().length === 0) {
      sessionId = 'guest_' + generateUUID();
      localStorage.setItem(GUEST_SESSION_ID_STORAGE_KEY, sessionId);
      localStorage.setItem(GUEST_SESSION_STORAGE_KEY, sessionId);
    }
    return sessionId;
  } catch {
    return 'guest_' + generateUUID();
  }
}

/**
 * Explicitly transition to isolated Guest Session:
 * 1. Signs out from Supabase to clear active tokens.
 * 2. Sets recode_is_guest = 'true' and assigns new recode_guest_session_id.
 * 3. Removes cached user profile & access token.
 * 4. Broadcasts auth change event.
 */
export async function setGuestSession() {
  try {
    await supabase.auth.signOut().catch(() => {});
  } catch {
    // Ignore sign out errors in offline/guest mode
  }

  const newGuestId = 'guest_' + generateUUID();
  try {
    localStorage.setItem(IS_GUEST_STORAGE_KEY, 'true');
    localStorage.setItem(GUEST_SESSION_ID_STORAGE_KEY, newGuestId);
    localStorage.setItem(GUEST_SESSION_STORAGE_KEY, newGuestId);
    localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    window.dispatchEvent(new Event('recode_auth_change'));
  } catch (err) {
    console.error('Failed to save guest session to localStorage:', err);
  }
  return newGuestId;
}

/**
 * Sign in existing user with email and password
 */
export async function signInWithEmail(email, password) {
  try {
    // 1. Remove guest flags before authenticating
    try {
      localStorage.removeItem(IS_GUEST_STORAGE_KEY);
      localStorage.removeItem(GUEST_SESSION_ID_STORAGE_KEY);
      localStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
    } catch {}

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) throw error;

    if (data.session || data.user) {
      try {
        localStorage.removeItem(IS_GUEST_STORAGE_KEY);
        localStorage.removeItem(GUEST_SESSION_ID_STORAGE_KEY);
        localStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
        if (data.user) {
          localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(data.user));
        }
        if (data.session?.access_token) {
          localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, data.session.access_token);
        }
        window.dispatchEvent(new Event('recode_auth_change'));
      } catch {}
    }

    return { user: data.user, session: data.session, error: null };
  } catch (err) {
    return { user: null, session: null, error: err };
  }
}

/**
 * Register new user with email, password, and full name metadata
 */
export async function signUpWithEmail(email, password, fullName = '') {
  try {
    try {
      localStorage.removeItem(IS_GUEST_STORAGE_KEY);
      localStorage.removeItem(GUEST_SESSION_ID_STORAGE_KEY);
    } catch {}

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (error) throw error;

    if (data.user) {
      try {
        localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(data.user));
        localStorage.removeItem(IS_GUEST_STORAGE_KEY);
        window.dispatchEvent(new Event('recode_auth_change'));
      } catch {}
    }

    return { user: data.user, session: data.session, error: null };
  } catch (err) {
    return { user: null, session: null, error: err };
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(email) {
  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Sign out current authenticated user and transition into clean guest session
 */
export async function signOut() {
  try {
    await supabase.auth.signOut().catch(() => {});
  } catch {}

  try {
    localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    const guestId = 'guest_' + generateUUID();
    localStorage.setItem(IS_GUEST_STORAGE_KEY, 'true');
    localStorage.setItem(GUEST_SESSION_ID_STORAGE_KEY, guestId);
    localStorage.setItem(GUEST_SESSION_STORAGE_KEY, guestId);
    window.dispatchEvent(new Event('recode_auth_change'));
    return { error: null };
  } catch (err) {
    return { error: err };
  }
}

/**
 * Get active session (strictly returns null if in Guest mode)
 */
export async function getSession() {
  if (isGuestSession()) {
    return null;
  }
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Get current authenticated user (strictly returns null if in Guest mode)
 */
export async function getCurrentUser() {
  if (isGuestSession()) {
    return null;
  }
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/**
 * Listen to authentication state transitions
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

/**
 * Legacy alias for backwards compatibility
 */
export function getOrCreateGuestSession() {
  return getStoredGuestSessionId();
}

/**
 * Legacy alias for backwards compatibility
 */
export function generateGuestSession() {
  return getStoredGuestSessionId();
}

/**
 * Clear guest session tokens
 */
export function clearGuestSession() {
  try {
    localStorage.removeItem(IS_GUEST_STORAGE_KEY);
    localStorage.removeItem(GUEST_SESSION_ID_STORAGE_KEY);
    localStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
    window.dispatchEvent(new Event('recode_auth_change'));
  } catch {}
}
