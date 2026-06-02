// ============================================================================
// UTILS — Helpers comunes
// ============================================================================

/** Formatea número como moneda. Soporta ARS y USD. */
export function fmtMoney(value, currency = 'ARS', decimals = 0) {
  if (value == null || isNaN(value)) return '—';
  const opts = {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  };
  return new Intl.NumberFormat('es-AR', opts).format(value);
}

/** Formatea número entero o decimal con separador local. */
export function fmtNumber(value, decimals = 0) {
  if (value == null || isNaN(value)) return '—';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Formatea fecha YYYY-MM-DD → "12 oct 2025". */
export function fmtDate(date) {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : new Date(date);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Hoy en formato YYYY-MM-DD (Argentina). */
export function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Primer día del mes actual. */
export function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Hace N días atrás en formato YYYY-MM-DD. */
export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Sanitiza string para evitar inyección HTML. Úsalo siempre antes de innerHTML. */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Sistema de toasts mínimo. */
export function toast(message, type = 'info', durationMs = 3500) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 300);
  }, durationMs);
}

/** Debounce — útil para inputs de búsqueda. */
export function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/** Convierte valores cross-moneda con cotización dada. */
export function convertCurrency(amount, from, to, rate) {
  if (from === to) return amount;
  if (from === 'ARS' && to === 'USD') return amount / rate;
  if (from === 'USD' && to === 'ARS') return amount * rate;
  return amount;
}

/** Calcula diferencia porcentual entre dos valores. */
export function pctChange(curr, prev) {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}
