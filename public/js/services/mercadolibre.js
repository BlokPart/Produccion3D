import { supabase, WORKER_URL } from '../config/supabase.js';

export async function getIntegracion() {
  const { data, error } = await supabase
    .from('ml_integracion').select('*').maybeSingle();
  if (error) throw error;
  return data;
}

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token}` };
}

export async function iniciarOAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error('No autenticado');
  window.location.href = `${WORKER_URL}/api/ml/oauth/start?user_id=${userId}`;
}

export async function syncManual() {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error('No autenticado');
  const resp = await fetch(`${WORKER_URL}/api/ml/sync?user_id=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function desconectarML(id) {
  const { error } = await supabase.from('ml_integracion').delete().eq('id', id);
  if (error) throw error;
}
