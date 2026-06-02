// ============================================================================
// CONFIGURACIÓN DE SUPABASE
// ----------------------------------------------------------------------------
// El anon key es público por diseño — la seguridad real vive en las políticas
// RLS de la base de datos (ver database/schema.sql).
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const SUPABASE_URL  = 'https://cyyclnvqnwjnaupdeoaf.supabase.co';
export const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5eWNsbnZxbndqbmF1cGRlb2FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNTMyMjUsImV4cCI6MjA5NTkyOTIyNX0.6rehDFjhj4oWvY5gyfvQaHIDLBZYw_OTnHEqdQVfTpw';

// URL pública del Worker de Cloudflare (ajustar después de desplegar)
export const WORKER_URL = 'https://produccion3d-api.blokpart.workers.dev';
// export const WORKER_URL = window.location.hostname === 'localhost'
  // ? 'http://localhost:8787'
  // : 'https://deslizadores-api.TU-SUBDOMINIO.workers.dev';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
