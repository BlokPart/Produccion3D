import { supabase } from '../config/supabase.js';
import { today } from '../core/utils.js';

/** Trae cotización de hoy. Si no existe en DB, la busca en dolarapi.com */
export async function getCotizacionHoy() {
  const hoy = today();

  // 1. Buscar en DB
  const { data } = await supabase
    .from('cotizaciones_usd')
    .select('*')
    .eq('tipo', 'blue')
    .eq('fecha', hoy)
    .maybeSingle();

  if (data?.valor_ars) return data;

  // 2. Intentar traer de dolarapi.com directamente (tiene CORS abierto)
  try {
    const r = await fetch('https://dolarapi.com/v1/dolares/blue');
    if (r.ok) {
      const d = await r.json();
      const valor = Number(d.venta || d.compra || 0);
      if (valor > 0) {
        const row = { fecha: hoy, tipo: 'blue', valor_ars: valor, fuente: 'dolarapi.com' };
        await supabase.from('cotizaciones_usd')
          .upsert(row, { onConflict: 'fecha,tipo' }).select().maybeSingle();
        return { ...row };
      }
    }
  } catch (_) { /* CORS o red, ignorar */ }

  // 3. Última cotización disponible
  const { data: last } = await supabase
    .from('cotizaciones_usd')
    .select('*')
    .eq('tipo', 'blue')
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle();

  return last ?? { valor_ars: 1200, tipo: 'blue', fecha: hoy };
}

/** ARS → USD */
export function arsToUsd(montoArs, cotizacion) {
  const v = cotizacion?.valor_ars;
  if (!v) return null;
  return montoArs / v;
}

/** USD → ARS */
export function usdToArs(montoUsd, cotizacion) {
  const v = cotizacion?.valor_ars;
  if (!v) return null;
  return montoUsd * v;
}
