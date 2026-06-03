import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
let supabaseActive = false;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    supabaseActive = true;
    console.log("✅ [Supabase Admin] Supabase client initialized successfully!");
  } catch (error) {
    console.error("❌ [Supabase Admin] Initialization failed:", error);
  }
} else {
  console.warn("⚠️  [Supabase Admin] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY keys in .env. Running in local fallback mode querying FastAPI admin routes.");
}

export { supabase, supabaseActive };
