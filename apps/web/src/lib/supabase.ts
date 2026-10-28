import { createClient } from '@supabase/supabase-js';
import type { Database } from '@jokeshovel/shared';
import { env } from './env';

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    // /auth/callback exchanges the code explicitly so it can handle errors.
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
});
