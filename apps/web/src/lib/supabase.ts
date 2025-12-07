import { createClient } from "@supabase/supabase-js";
import { Database } from "shared/db/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Get a Supabase client with the anon key (public, respects RLS)
 */
export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase client env vars missing");
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}

/**
 * Get a Supabase client with service role key (bypasses RLS, server-side only)
 */
export function getServiceSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Supabase service env vars missing");
  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

/**
 * Alias for getServiceSupabaseClient (used by probabilityAdapter)
 */
export const createServiceRoleClient = getServiceSupabaseClient;
