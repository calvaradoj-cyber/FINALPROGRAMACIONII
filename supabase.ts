import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qqlgqkyiicgpxszxryfz.supabase.co';

const supabaseKey = 'sb_publishable_UF0xuf_JeV72TcPQ7k_seA_uNkBI9dU';

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);