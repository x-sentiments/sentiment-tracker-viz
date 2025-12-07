import { createClient } from "@supabase/supabase-js";
import { Database } from "@shared/db/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase client env vars missing");
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}

export function getServiceSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Supabase service env vars missing");
  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}


