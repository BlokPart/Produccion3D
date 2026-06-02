// ============================================================================
// COTIZACION — ARS ⇄ USD con caché en Supabase
// ============================================================================

import { supabase } from '../config/supabase.js';
import { today } from '../core/utils.js';

/**
 * Obtiene la cotización vigente. Estrategia:
 *   1. Buscar en tabla `cotizaciones_usd` la fila de hoy.
 *   2. Si no existe, llamar a dolarapi.com y persistirla (vía Worker, no directo desde browser por CORS).
 *   3. Si falla todo, usar la última cotización conocida.
 */
export async function getCotizacionHoy() {
  const hoy = today();
  const { data } = await supabase
    .from('cotizaciones_usd')
    .select('*')
    .eq('fecha', hoy)
    .maybeSingle();

  if (data) return data;

  // Fallback: la última disponible
  const { data: last } = await supabase
    .from('cotizaciones_usd')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle();

  return last || { blue_venta: 1000, oficial_venta: 1000 }; // fallback de emergencia
}

/** Convierte ARS → USD usando el valor blue venta del día (o uno dado). */
export function arsToUsd(montoArs, cotizacion) {
  if (!cotizacion?.blue_venta) return null;
  return montoArs / cotizacion.blue_venta;
}

/** Convierte USD → ARS. */
export function usdToArs(montoUsd, cotizacion) {
  if (!cotizacion?.blue_venta) return null;
  return montoUsd * cotizacion.blue_venta;
}
