// ============================================================================
// PÁGINA: DASHBOARD
// ============================================================================

import { requireAuth } from '../core/auth.js';
import { mountLayout } from '../core/layout.js';
import { initTheme } from '../core/theme.js';
import { fmtMoney, fmtNumber, fmtDate, escapeHtml } from '../core/utils.js';
import { kpiVentasHoy, kpiVentasMes, ventasSerie, topProductos, listVentas } from '../services/ventas.js';
import { listObjetivos, calcularProgreso } from '../services/objetivos.js';
import { getCotizacionHoy, arsToUsd } from '../services/cotizacion.js';
import { supabase } from '../config/supabase.js';

initTheme();

const user = await requireAuth();
if (!user) throw new Error('Sin sesión');

mountLayout({
  activeHref: 'dashboard.html',
  title: 'Dashboard',
  breadcrumb: 'Principal',
});

// ---------------- KPIs ----------------
const [ventasHoy, ventasMes, cotizacion] = await Promise.all([
  kpiVentasHoy(),
  kpiVentasMes(),
  getCotizacionHoy(),
]);

// Stock total: suma de v_stock_filamento
const { data: stockData } = await supabase.from('v_stock_filamento').select('valor_stock_ars');
const valorStock = (stockData || []).reduce((s, r) => s + Number(r.valor_stock_ars || 0), 0);

const cotTxt = cotizacion?.blue_venta ? `USD blue $${fmtNumber(cotizacion.blue_venta, 0)}` : 'Cotización no disponible';

const kpis = [
  {
    label: 'Ventas hoy',
    value: fmtMoney(ventasHoy.ingreso, 'ARS'),
    sub: `${ventasHoy.cantidad} ventas · ${fmtMoney(arsToUsd(ventasHoy.ingreso, cotizacion) || 0, 'USD', 2)}`,
    icon: 'shopping-bag',
    accent: 'info',
  },
  {
    label: 'Ventas del mes',
    value: fmtMoney(ventasMes.ingreso, 'ARS'),
    sub: `${ventasMes.cantidad} ventas`,
    icon: 'calendar',
    accent: 'info',
  },
  {
    label: 'Ganancia neta del mes',
    value: fmtMoney(ventasMes.ganancia, 'ARS'),
    sub: ventasMes.ingreso > 0 ? `Margen ${((ventasMes.ganancia / ventasMes.ingreso) * 100).toFixed(1)}%` : '—',
    icon: 'trending-up',
    accent: ventasMes.ganancia >= 0 ? 'success' : 'danger',
  },
  {
    label: 'Valor de stock',
    value: fmtMoney(valorStock, 'ARS'),
    sub: cotTxt,
    icon: 'package',
    accent: 'warning',
  },
];

const ICONS = {
  'shopping-bag': '<path d="M6 2L3 6v14h18V6l-3-4H6z"/><path d="M3 6h18M16 10a4 4 0 1 1-8 0"/>',
  'calendar':     '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  'trending-up':  '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  'package':      '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
};

document.getElementById('kpiGrid').innerHTML = kpis.map(k => `
  <div class="kpi kpi--${k.accent}">
    <div class="kpi__icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k.icon] || ''}</svg>
    </div>
    <div class="kpi__label">${k.label}</div>
    <div class="kpi__value numeric">${k.value}</div>
    <div class="kpi__sub">${k.sub}</div>
  </div>
`).join('');

// ---------------- Gráfico de líneas (SVG vanilla) ----------------
const serie = await ventasSerie(30);

function renderLineChart(metric = 'ingreso') {
  const container = document.getElementById('lineChart');
  if (!serie.length) {
    container.innerHTML = '<div class="empty"><p>Aún no hay ventas registradas</p></div>';
    return;
  }
  const W = container.clientWidth || 600;
  const H = 240;
  const PAD = { t: 20, r: 16, b: 32, l: 56 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const values = serie.map(d => Number(d[metric]) || 0);
  const max = Math.max(...values, 1);
  const xs = serie.map((_, i) => PAD.l + (i * innerW) / Math.max(serie.length - 1, 1));
  const ys = values.map(v => PAD.t + innerH - (v / max) * innerH);

  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  const area = `${path} L ${xs[xs.length-1].toFixed(1)} ${PAD.t + innerH} L ${xs[0].toFixed(1)} ${PAD.t + innerH} Z`;

  // Eje Y: 4 ticks
  const ticks = 4;
  const yLabels = Array.from({length: ticks + 1}, (_, i) => {
    const value = (max * i) / ticks;
    const y = PAD.t + innerH - (i / ticks) * innerH;
    return `
      <line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}" stroke="var(--border)" stroke-dasharray="2 4"/>
      <text x="${PAD.l - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--text-dim)" font-family="JetBrains Mono">
        ${fmtNumber(Math.round(value / 1000)) + 'k'}
      </text>`;
  }).join('');

  // Eje X: cada 7 días
  const xLabels = serie.map((d, i) => {
    if (i % Math.ceil(serie.length / 5) !== 0 && i !== serie.length - 1) return '';
    const dt = new Date(d.fecha + 'T00:00:00');
    const label = dt.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    return `<text x="${xs[i]}" y="${H - PAD.b + 16}" text-anchor="middle" font-size="10" fill="var(--text-dim)">${label}</text>`;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%; height:100%;">
      <defs>
        <linearGradient id="gradFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="var(--brand)" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="var(--brand)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${yLabels}
      <path d="${area}" fill="url(#gradFill)"/>
      <path d="${path}" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${xs.map((x, i) => `<circle cx="${x}" cy="${ys[i]}" r="3" fill="var(--surface)" stroke="var(--brand)" stroke-width="2"/>`).join('')}
      ${xLabels}
    </svg>
  `;
}

renderLineChart('ingreso');
document.getElementById('chartMetric').addEventListener('change', e => renderLineChart(e.target.value));
window.addEventListener('resize', () => renderLineChart(document.getElementById('chartMetric').value));

// ---------------- Top productos ----------------
const top = await topProductos(30, 5);
const topEl = document.getElementById('topProductos');
if (!top.length) {
  topEl.innerHTML = '<div class="empty"><p>Sin datos aún</p></div>';
} else {
  const maxIngreso = Math.max(...top.map(t => Number(t.ingresos) || 0), 1);
  topEl.innerHTML = top.map(t => {
    const pct = ((Number(t.ingresos) || 0) / maxIngreso) * 100;
    return `
      <div style="margin-bottom: 14px;">
        <div style="display:flex; justify-content:space-between; margin-bottom: 6px; font-size: 0.875rem;">
          <span style="font-weight:600;">${escapeHtml(t.nombre)}</span>
          <span class="mono numeric text-muted">${fmtMoney(t.ingresos, 'ARS')}</span>
        </div>
        <div class="progress"><div class="progress__fill" style="width: ${pct}%"></div></div>
        <div style="font-size: 0.75rem; color: var(--text-dim); margin-top:4px;">
          ${t.unidades} u · ganancia ${fmtMoney(t.ganancia, 'ARS')}
        </div>
      </div>
    `;
  }).join('');
}

// ---------------- Últimas ventas ----------------
const ultimas = await listVentas({ limit: 6 });
const ventasEl = document.getElementById('ultimasVentas');
if (!ultimas.length) {
  ventasEl.innerHTML = '<div class="empty"><p>Aún no hay ventas. Empezá <a href="/app/ventas.html" style="color:var(--brand)">registrando una</a>.</p></div>';
} else {
  ventasEl.innerHTML = `
    <div style="overflow-x:auto;">
    <table class="table">
      <thead>
        <tr>
          <th>Fecha</th><th>Producto</th><th>Canal</th>
          <th class="num">Ingreso</th><th class="num">Ganancia</th>
        </tr>
      </thead>
      <tbody>
        ${ultimas.map(v => `
          <tr>
            <td>${fmtDate(v.fecha)}</td>
            <td>${escapeHtml(v.productos?.nombre || '—')}</td>
            <td><span class="badge badge--${v.canal === 'mercadolibre' ? 'warning' : 'neutral'}">${v.canal}</span></td>
            <td class="num numeric">${fmtMoney(v.ingreso_bruto, v.moneda)}</td>
            <td class="num numeric ${Number(v.ganancia_neta) >= 0 ? 'text-success' : 'text-danger'}">
              ${fmtMoney(v.ganancia_neta, v.moneda)}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>
  `;
}

// ---------------- Objetivos ----------------
const objs = await listObjetivos();
const objEl = document.getElementById('objetivosList');
const activos = objs.filter(o => o.estado === 'activo').slice(0, 3);
if (!activos.length) {
  objEl.innerHTML = '<div class="empty"><p>Sin objetivos activos. <a href="/app/objetivos.html" style="color:var(--brand)">Crear uno</a>.</p></div>';
} else {
  objEl.innerHTML = activos.map(o => {
    const p = calcularProgreso(o);
    return `
      <div style="margin-bottom: 16px;">
        <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
          <strong>${escapeHtml(o.nombre)}</strong>
          <span class="mono text-muted">${p.porcentaje.toFixed(0)}%</span>
        </div>
        <div class="progress"><div class="progress__fill" style="width: ${p.porcentaje}%"></div></div>
        <div style="font-size: 0.75rem; color: var(--text-dim); margin-top:4px;">
          ${fmtMoney(o.monto_actual, o.moneda)} de ${fmtMoney(o.monto_objetivo, o.moneda)}
          ${o.fecha_estimada ? ` · meta ${fmtDate(o.fecha_estimada)}` : ''}
        </div>
      </div>
    `;
  }).join('');
}
