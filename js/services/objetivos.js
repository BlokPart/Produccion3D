// ============================================================================
// SERVICIO: OBJETIVOS DE AHORRO
// ============================================================================

import { supabase } from '../config/supabase.js';

export async function listObjetivos() {
  const { data, error } = await supabase
    .from('objetivos_ahorro')
    .select('*')
    .order('estado', { ascending: true })
    .order('fecha_estimada', { ascending: true, nullsLast: true });
  if (error) throw error;
  return data;
}

export async function createObjetivo(obj) {
  const session = (await supabase.auth.getSession()).data.session;
  const { data, error } = await supabase
    .from('objetivos_ahorro')
    .insert({ ...obj, user_id: session.user.id })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateObjetivo(id, patch) {
  const { data, error } = await supabase
    .from('objetivos_ahorro')
    .update(patch)
    .eq('id', id)
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteObjetivo(id) {
  const { error } = await supabase.from('objetivos_ahorro').delete().eq('id', id);
  if (error) throw error;
}

/** Calcula progreso y deltas de un objetivo. */
export function calcularProgreso(obj) {
  const pct = obj.monto_objetivo > 0 ? (obj.monto_actual / obj.monto_objetivo) * 100 : 0;
  return {
    porcentaje: Math.min(pct, 100),
    falta: Math.max(obj.monto_objetivo - obj.monto_actual, 0),
    completado: obj.monto_actual >= obj.monto_objetivo,
  };
}
