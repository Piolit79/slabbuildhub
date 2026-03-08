import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_COI_SUPABASE_URL || 'https://rmgzjnmyvowdhhrdssdx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_COI_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtZ3pqbm15dm93ZGhocmRzc2R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzg3NTksImV4cCI6MjA4Nzk1NDc1OX0.-1ysf7NkBGu3MP-R6mkKYB7cJgGWs1Q4_NEf_Qmy_bQ';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
