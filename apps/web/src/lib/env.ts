export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  /** Email/password sign-in for local development and E2E tests only. */
  devLogin: import.meta.env.VITE_ENABLE_DEV_LOGIN === 'true',
};
