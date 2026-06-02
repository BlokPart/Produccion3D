// ============================================================================
// SERVICIO: VENTAS
// ============================================================================

import { supabase } from '../config/supabase.js';
import { today, firstOfMonth } from '../core/utils.js';

export async function listVentas({ desde, hasta, canal, limit = 100 } = {}) {
  let q = supabase
    .from('ventas')
    .select('*, productos(nombre)')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta);
  if (canal) q = q.eq('canal', canal);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createVenta(venta) {
  // Si no se especifica user_id, el cliente no lo manda y RLS lo rellena
  // mediante un trigger del lado de Supabase o requerimos pasarlo aquí.
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error('No autenticado');
  const payload = { ...venta, user_id: session.user.id };
  const { data, error } = await supabase
    .from('ventas')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateVenta(id, patch) {
  const { data, error } = await supabase
    .from('ventas')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVenta(id) {
  const { error } = await supabase.from('ventas').delete().eq('id', id);
  if (error) throw error;
}

// ---------------- KPIs ----------------
export async function kpiVentasHoy() {
  const { data } = await supabase
    .from('ventas')
    .select('ingreso_bruto, ganancia_neta')
    .eq('fecha', today());
  return aggregate(data);
}

export async function kpiVentasMes() {
  const { data } = await supabase
    .from('ventas')
    .select('ingreso_bruto, ganancia_neta')
    .gte('fecha', firstOfMonth());
  return aggregate(data);
}

function aggregate(rows = []) {
  return rows.reduce((acc, r) => ({
    cantidad: acc.cantidad + 1,
    ingreso: acc.ingreso + Number(r.ingreso_bruto || 0),
    ganancia: acc.ganancia + Number(r.ganancia_neta || 0),
  }), { cantidad: 0, ingreso: 0, ganancia: 0 });
}

// Serie diaria últimos N días para gráfico
export async function ventasSerie(diasAtras = 30) {
  const desde = new Date();
  desde.setDate(desde.getDate() - diasAtras);
  const desdeStr = desde.toISOString().slice(0,10);
  const { data, error } = await supabase
    .from('ventas')
    .select('fecha, ingreso_bruto, ganancia_neta')
    .gte('fecha', desdeStr)
    .order('fecha', { ascending: true });
  if (error) throw error;

  // Agrupar por fecha
  const map = new Map();
  data.forEach(v => {
    const k = v.fecha;
    if (!map.has(k)) map.set(k, { fecha: k, ingreso: 0, ganancia: 0 });
    const row = map.get(k);
    row.ingreso  += Number(v.ingreso_bruto || 0);
    row.ganancia += Number(v.ganancia_neta || 0);
  });
  return Array.from(map.values());
}

export async function topProductos(diasAtras = 30, limit = 5) {
  const { data, error } = await supabase
    .from('v_ranking_productos')
    .select('*')
    .order('ganancia', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
