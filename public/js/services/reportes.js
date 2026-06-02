import { supabase } from '../config/supabase.js';

export async function resumenMensual(limite = 12) {
  const { data, error } = await supabase
    .from('v_resumen_mensual').select('*')
    .order('mes', { ascending: false }).limit(limite);
  if (error) throw error;
  return data ?? [];
}

export async function rankingProductos(limite = 10) {
  const { data, error } = await supabase
    .from('v_ranking_productos').select('*').limit(limite);
  if (error) throw error;
  return data ?? [];
}
