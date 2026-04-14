// Supabase configuration
// NOTE: For local development, you can use these placeholders
// For production (Vercel/Netlify), use Environment Variables:
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

let supabaseClient = null;

try {
    if (window.supabase && SUPABASE_URL && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (err) {
    console.warn('Supabase client creation failed:', err);
}

export const supabase = supabaseClient;
