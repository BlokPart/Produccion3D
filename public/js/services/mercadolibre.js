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
  const headers = await authHeader();
  const token = headers.Authorization.split(' ')[1];
  window.location.href = `${WORKER_URL}/api/ml/oauth/start?token=${token}`;
}

export async function syncManual() {
  const headers = await authHeader();
  const resp = await fetch(`${WORKER_URL}/api/ml/sync`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function desconectarML(id) {
  const { error } = await supabase.from('ml_integracion').delete().eq('id', id);
  if (error) throw error;
}
