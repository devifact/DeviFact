import { createClient } from '@supabase/supabase-js';

// deno-lint-ignore no-process-global
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// deno-lint-ignore no-process-global
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
