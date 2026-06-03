import { supabase } from '../config/supabase.js';

// ── Períodos ──────────────────────────────────────────────────────────────────
export const PERIODOS = {
  hoy:          { label: 'Hoy' },
  semana:       { label: 'Última semana' },
  mes:          { label: 'Este mes' },
  mes_anterior: { label: 'Mes anterior' },
  dias30:       { label: 'Últimos 30 días' },
  dias90:       { label: 'Últimos 90 días' },
  todo:         { label: 'Todo' },
};
const STORAGE_KEY = 'd3_periodo';

export function getPeriodoActual() {
  return localStorage.getItem(STORAGE_KEY) || 'mes';
}
export function setPeriodoActual(key) {
  localStorage.setItem(STORAGE_KEY, key);
}

export function calcularRango(key) {
  const hoy = new Date();
  const fmt = d => d.toISOString().slice(0, 10);
  switch (key) {
    case 'hoy':
      return { desde: fmt(hoy), hasta: fmt(hoy) };
    case 'semana': {
      const d = new Date(hoy); d.setDate(d.getDate() - 6);
      return { desde: fmt(d), hasta: fmt(hoy) };
    }
    case 'mes': {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return { desde: fmt(d), hasta: fmt(hoy) };
    }
    case 'mes_anterior': {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const h = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      return { desde: fmt(d), hasta: fmt(h) };
    }
    case 'dias90': {
      const d = new Date(hoy); d.setDate(d.getDate() - 89);
      return { desde: fmt(d), hasta: fmt(hoy) };
    }
    case 'todo':
      return { desde: null, hasta: null };
    default: { // dias30
      const d = new Date(hoy); d.setDate(d.getDate() - 29);
      return { desde: fmt(d), hasta: fmt(hoy) };
    }
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────
const CAMPOS = 'id,fecha,canal,cantidad,precio_unitario_ars,descuento_ml_ars,descuento_iibb_ars,descuento_otros_ars,costo_total_snapshot,cliente_nombre,notas,ml_order_id,producto_id,productos(nombre)';

export async function listVentas({ desde, hasta, limit = 500 } = {}) {
  let q = supabase.from('ventas').select(CAMPOS)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createVenta(payload) {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase
    .from('ventas').insert({ ...payload, user_id: session.user.id }).select().single();
  if (error) throw error;
  return data;
}

export async function updateVenta(id, patch) {
  const { data, error } = await supabase
    .from('ventas').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteVenta(id) {
  const { error } = await supabase.from('ventas').delete().eq('id', id);
  if (error) throw error;
}

// ── Agregados ─────────────────────────────────────────────────────────────────
export function calcKpis(ventas) {
  return (ventas ?? []).reduce((acc, v) => {
    const bruto  = (v.precio_unitario_ars || 0) * (v.cantidad || 1);
    const descs  = (v.descuento_ml_ars || 0) + (v.descuento_iibb_ars || 0) + (v.descuento_otros_ars || 0);
    const neto   = bruto - descs;
    const ganancia = neto - (v.costo_total_snapshot || 0);
    return {
      cantidad:  acc.cantidad  + 1,
      bruto:     acc.bruto     + bruto,
      neto:      acc.neto      + neto,
      ganancia:  acc.ganancia  + ganancia,
    };
  }, { cantidad: 0, bruto: 0, neto: 0, ganancia: 0 });
}

export function calcSerie(ventas) {
  const map = new Map();
  (ventas ?? []).forEach(v => {
    const k = v.fecha;
    if (!map.has(k)) map.set(k, { fecha: k, bruto: 0, neto: 0, ganancia: 0 });
    const r = map.get(k);
    const bruto = (v.precio_unitario_ars || 0) * (v.cantidad || 1);
    const descs = (v.descuento_ml_ars || 0) + (v.descuento_iibb_ars || 0) + (v.descuento_otros_ars || 0);
    r.bruto    += bruto;
    r.neto     += bruto - descs;
    r.ganancia += bruto - descs - (v.costo_total_snapshot || 0);
  });
  return Array.from(map.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Mantener compatibilidad con dashboard legacy
export async function kpiVentasHoy() { return { cantidad: 0, bruto: 0, neto: 0, ganancia: 0 }; }
export async function kpiVentasMes() { return { cantidad: 0, bruto: 0, neto: 0, ganancia: 0 }; }
export async function ventasSerie()  { return []; }
export async function topProductos() { return []; }
