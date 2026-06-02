import { supabase } from '../config/supabase.js';

export async function listFilamentos() {
  const { data, error } = await supabase
    .from('v_stock_filamento').select('*').order('nombre');
  if (error) throw error;
  return data ?? [];
}

export async function createFilamento(payload) {
  const { data, error } = await supabase
    .from('filamentos').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateFilamento(id, payload) {
  const { data, error } = await supabase
    .from('filamentos').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteFilamento(id) {
  const { error } = await supabase.from('filamentos').delete().eq('id', id);
  if (error) throw error;
}
