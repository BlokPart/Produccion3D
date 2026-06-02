import { supabase } from '../config/supabase.js';

export async function listGastos() {
  const { data, error } = await supabase
    .from('gastos').select('*').order('fecha', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createGasto(payload) {
  const { data, error } = await supabase
    .from('gastos').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateGasto(id, payload) {
  const { data, error } = await supabase
    .from('gastos').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteGasto(id) {
  const { error } = await supabase.from('gastos').delete().eq('id', id);
  if (error) throw error;
}
