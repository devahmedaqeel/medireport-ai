import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;
let supabaseActive = false;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // CRITICAL for React Native: use AsyncStorage instead of localStorage
        // Without this, Supabase tries to use window.localStorage which
        // does NOT exist in React Native → auth hangs → black screen
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // CRITICAL: disable URL-based session detection (no URL in React Native)
        detectSessionInUrl: false,
      },
    });
    supabaseActive = true;
    console.log('✅ [Supabase] Client initialized with React Native storage');
  } catch (error) {
    console.error('❌ [Supabase] Initialization failed:', error.message);
    supabase = null;
    supabaseActive = false;
  }
} else {
  console.warn('⚠️  [Supabase] Missing env vars — running in guest-only mode');
}

export { supabase, supabaseActive };
