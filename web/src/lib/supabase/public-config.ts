export const FALLBACK_SUPABASE_PUBLIC_URL = "https://ptxmypzrqonokuikpqzr.supabase.co";
export const FALLBACK_SUPABASE_PUBLIC_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0eG15cHpycW9ub2t1aWtwcXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDQ0NzEsImV4cCI6MjA4NDMyMDQ3MX0.EiCkAgaNwmuOhqwu1sEAHMv7sN0_WBlblpXERKfxZlE";

const publicUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const publicAnon = String(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || "",
).trim();

export const SUPABASE_PUBLIC_URL = publicUrl || FALLBACK_SUPABASE_PUBLIC_URL;
export const SUPABASE_PUBLIC_ANON_KEY = publicAnon || FALLBACK_SUPABASE_PUBLIC_ANON_KEY;
