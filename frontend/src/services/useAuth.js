import { useState, useEffect, useCallback } from 'react';
import {
  supabase,
  IS_GUEST_STORAGE_KEY,
  GUEST_SESSION_ID_STORAGE_KEY,
  GUEST_SESSION_STORAGE_KEY,
  USER_PROFILE_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  setGuestSession,
  getStoredGuestSessionId,
  signOut as authSignOut,
} from './supabaseAuth';

/**
 * Global authentication and guest session isolation hook
 */
export function useAuth() {
  const [authState, setAuthState] = useState(() => {
    try {
      const isGuestFlag = localStorage.getItem(IS_GUEST_STORAGE_KEY) === 'true';
      if (isGuestFlag) {
        return {
          user: null,
          token: null,
          isGuest: true,
          guestSessionId:
            localStorage.getItem(GUEST_SESSION_ID_STORAGE_KEY) ||
            localStorage.getItem(GUEST_SESSION_STORAGE_KEY) ||
            '',
          loading: false,
        };
      }

      const cachedProfile = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
      const cachedToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      if (cachedProfile) {
        try {
          const parsed = JSON.parse(cachedProfile);
          return {
            user: parsed,
            token: cachedToken || null,
            isGuest: false,
            guestSessionId: null,
            loading: false,
          };
        } catch {}
      }

      return {
        user: null,
        token: null,
        isGuest: true,
        guestSessionId: localStorage.getItem(GUEST_SESSION_ID_STORAGE_KEY) || '',
        loading: true,
      };
    } catch {
      return {
        user: null,
        token: null,
        isGuest: true,
        guestSessionId: '',
        loading: false,
      };
    }
  });

  const checkAuth = useCallback(async () => {
    try {
      const isGuestFlag = localStorage.getItem(IS_GUEST_STORAGE_KEY) === 'true';

      // 1. If explicitly marked as guest, immediately treat as Guest
      if (isGuestFlag) {
        const storedGuestId = getStoredGuestSessionId();
        setAuthState({
          user: null,
          token: null,
          isGuest: true,
          guestSessionId: storedGuestId,
          loading: false,
        });
        return;
      }

      // 2. Only if recode_is_guest !== 'true', check for active Supabase session
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        const currentUser = sessionData.session.user;
        const accessToken = sessionData.session.access_token || null;
        try {
          localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(currentUser));
          if (accessToken) {
            localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, accessToken);
          }
          localStorage.removeItem(IS_GUEST_STORAGE_KEY);
          localStorage.removeItem(GUEST_SESSION_ID_STORAGE_KEY);
          localStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
        } catch {}

        setAuthState({
          user: currentUser,
          token: accessToken,
          isGuest: false,
          guestSessionId: null,
          loading: false,
        });
      } else {
        // No active user session -> fall back to guest session
        const storedGuestId = getStoredGuestSessionId();
        setAuthState({
          user: null,
          token: null,
          isGuest: true,
          guestSessionId: storedGuestId,
          loading: false,
        });
      }
    } catch (err) {
      console.warn('[useAuth] Session check fallback:', err);
      const storedGuestId = getStoredGuestSessionId();
      setAuthState({
        user: null,
        token: null,
        isGuest: true,
        guestSessionId: storedGuestId,
        loading: false,
      });
    }
  }, []);

  useEffect(() => {
    checkAuth();

    // Listen to local auth transitions (e.g. guest toggle or sign-in)
    const handleAuthChange = () => {
      checkAuth();
    };
    window.addEventListener('recode_auth_change', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    // Listen to Supabase session state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const isGuestFlag = localStorage.getItem(IS_GUEST_STORAGE_KEY) === 'true';
      if (isGuestFlag) return; // Strict guest isolation prevents auto-reconnecting

      if (event === 'SIGNED_IN' && session?.user) {
        try {
          localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(session.user));
          if (session.access_token) {
            localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, session.access_token);
          }
          localStorage.removeItem(IS_GUEST_STORAGE_KEY);
          localStorage.removeItem(GUEST_SESSION_ID_STORAGE_KEY);
          localStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
        } catch {}
        setAuthState({
          user: session.user,
          token: session.access_token || null,
          isGuest: false,
          guestSessionId: null,
          loading: false,
        });
      } else if (event === 'SIGNED_OUT') {
        try {
          localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
          localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        } catch {}
        checkAuth();
      }
    });

    return () => {
      window.removeEventListener('recode_auth_change', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
      authListener?.subscription?.unsubscribe();
    };
  }, [checkAuth]);

  const enterGuestMode = useCallback(async () => {
    const id = await setGuestSession();
    setAuthState({
      user: null,
      token: null,
      isGuest: true,
      guestSessionId: id,
      loading: false,
    });
    return id;
  }, []);

  const logout = useCallback(async () => {
    await authSignOut();
  }, []);

  return {
    user: authState.user,
    token: authState.token,
    authToken: authState.token,
    isGuest: authState.isGuest,
    guestSessionId: authState.guestSessionId,
    loading: authState.loading,
    enterGuestMode,
    logout,
    refreshAuth: checkAuth,
  };
}

export default useAuth;
