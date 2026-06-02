import { supabase } from '../config/supabase.js';

export async function listProduccion() {
  const { data, error } = await supabase
    .from('produccion')
    .select('*, productos(nombre), filamentos(nombre, color)')
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createProduccion(payload) {
  const { data, error } = await supabase
    .from('produccion').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProduccion(id) {
  const { error } = await supabase.from('produccion').delete().eq('id', id);
  if (error) throw error;
}
