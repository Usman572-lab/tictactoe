// ============================================================================
//  supabase-config.js
//
//  Paste YOUR Supabase project URL and PUBLISHABLE key below (README step 4).
//  Supabase dashboard -> Project Settings -> API Keys (or "API").
//
//  The URL and the publishable key (it starts with "sb_publishable_", or it is
//  the older "anon" key) are designed to be public. They are safe in a website
//  ONLY because the database has Row Level Security and the game functions in
//  supabase-setup.sql refuse everything that is not a legal move.
//
//  NEVER paste a "secret" key (sb_secret_...) or the "service_role" key here.
//  Those bypass all security. app.js refuses to start if it detects one.
// ============================================================================

export const SUPABASE_URL = "https://dcvxkbwsocekjtppmkza.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_spvz2ckMgKekB4WuYA_q_A_i5l4pfpr";

// The game stays in "setup needed" mode until both values are real.
export function isSupabaseConfigured(url = SUPABASE_URL, key = SUPABASE_PUBLISHABLE_KEY) {
  const filled = (v) => typeof v === "string" && v.trim() !== "" && !/PASTE/i.test(v);
  return filled(url) && filled(key) && /^https:\/\/[^\s/]+/i.test(url.trim());
}

// Safety net: detects a secret / service_role key pasted by mistake.
export function keyLooksSecret(key = SUPABASE_PUBLISHABLE_KEY) {
  const k = String(key || "").trim();
  if (/^sb_secret_/i.test(k)) return true;
  const parts = k.split(".");
  if (parts.length === 3) {
    try {
      let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      b64 += "=".repeat((4 - (b64.length % 4)) % 4);
      return JSON.parse(atob(b64)).role === "service_role";
    } catch {
      return false;
    }
  }
  return false;
}
