import { supabase } from '../config/supabase.js';

export async function listCompras() {
  const { data, error } = await supabase
    .from('compras_filamento')
    .select('*, filamentos(nombre, material, color)')
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createCompra(payload) {
  const { data, error } = await supabase
    .from('compras_filamento').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCompra(id) {
  const { error } = await supabase.from('compras_filamento').delete().eq('id', id);
  if (error) throw error;
}
