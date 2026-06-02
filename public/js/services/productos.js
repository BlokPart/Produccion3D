import { supabase } from '../config/supabase.js';

export async function listProductos(soloActivos = false) {
  let q = supabase.from('productos').select('*').order('nombre');
  if (soloActivos) q = q.eq('activo', true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createProducto(payload) {
  const { data, error } = await supabase
    .from('productos').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateProducto(id, payload) {
  const { data, error } = await supabase
    .from('productos').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProducto(id) {
  const { error } = await supabase.from('productos').delete().eq('id', id);
  if (error) throw error;
}
