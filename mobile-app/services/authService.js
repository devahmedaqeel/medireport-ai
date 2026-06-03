import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, supabaseActive } from './supabaseConfig';

let currentUser = null;
let authListener = null;

const GUEST_USER = {
  id: 'guest',
  name: 'Guest User',
  email: 'guest@local',
  role: 'guest',
  isGuest: true,
};

// ─── initAuth ────────────────────────────────────────────────────────────────
// ALWAYS calls callback — guaranteed.
// Has an internal 5s timeout so a slow/failed Supabase network request
// never hangs the app on a black screen.
export const initAuth = async (callback) => {
  // Wrap everything so the callback is always invoked
  const safeCallback = (user) => {
    try {
      if (callback) callback(user);
    } catch (e) {
      console.warn('[Auth] Callback error:', e.message);
    }
  };

  // Internal safety timeout — calls callback(null) after 5s if still waiting
  let done = false;
  const timer = setTimeout(() => {
    if (!done) {
      done = true;
      console.warn('[Auth] initAuth timed out — falling back to unauthenticated');
      safeCallback(null);
    }
  }, 5000);

  const finish = (user) => {
    if (!done) {
      done = true;
      clearTimeout(timer);
      safeCallback(user);
    }
  };

  try {
    // 1. Check for a persisted guest session
    try {
      const guestSession = await AsyncStorage.getItem('guest_session');
      if (guestSession) {
        currentUser = JSON.parse(guestSession);
        finish(currentUser);
        return;
      }
    } catch (e) {
      console.warn('[Auth] Guest session load error:', e.message);
      // continue to Supabase check
    }

    // 2. Check Supabase auth session
    if (supabaseActive && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        currentUser = session ? session.user : null;
        finish(currentUser);

        // Subscribe to future auth changes (non-blocking — happens after callback)
        try {
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
              const user = session ? session.user : null;
              currentUser = user;
              safeCallback(user);
            }
          );
          authListener = subscription;
        } catch (e) {
          console.warn('[Auth] onAuthStateChange setup error:', e.message);
        }
      } catch (e) {
        console.warn('[Auth] Supabase getSession error:', e.message);
        finish(null);
      }
    } else {
      // No Supabase — go straight to login screen
      finish(null);
    }
  } catch (e) {
    console.warn('[Auth] initAuth unexpected error:', e.message);
    finish(null);
  }
};

export async function signUpUser(email, password) {
  if (!supabaseActive || !supabase) {
    throw new Error('Supabase Auth is not active. Please set your environment variables.');
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function loginUser(email, password) {
  if (!supabaseActive || !supabase) {
    throw new Error('Supabase Auth is not active. Please set your environment variables.');
  }
  try {
    await AsyncStorage.removeItem('guest_session');
  } catch (e) {
    console.warn('[Auth] Could not clear guest session:', e.message);
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function loginGuest() {
  currentUser = GUEST_USER;
  try {
    await AsyncStorage.setItem('guest_session', JSON.stringify(GUEST_USER));
  } catch (e) {
    console.warn('[Auth] Could not persist guest session:', e.message);
    // App continues with in-memory currentUser — still works
  }
  return GUEST_USER;
}

export async function logoutUser() {
  currentUser = null;
  try {
    await AsyncStorage.removeItem('guest_session');
  } catch (e) {
    console.warn('[Auth] Could not clear guest session:', e.message);
  }
  if (supabaseActive && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[Auth] Supabase sign out error:', e.message);
    }
  }
}

export function onAuthStateChange(callback) {
  initAuth(callback);
  return () => {
    if (authListener) {
      try { authListener.unsubscribe(); } catch (_) {}
    }
  };
}

export function getCurrentUser() {
  return currentUser;
}
