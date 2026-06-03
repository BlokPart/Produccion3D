import { requireAuth } from '../core/auth.js';
import { mountLayout } from '../core/layout.js';
import { initTheme } from '../core/theme.js';
import { fmtMoney, fmtDate, toast } from '../core/utils.js';
import {
  listVentas, calcKpis, calcSerie,
  PERIODOS, getPeriodoActual, setPeriodoActual, calcularRango
} from '../services/ventas.js';
import { listObjetivos, calcularProgreso } from '../services/objetivos.js';
import { getCotizacionHoy } from '../services/cotizacion.js';

let _ventas = [], _objetivos = [], _cotizacion = null;

async function init() {
  initTheme();
  const session = await requireAuth();
  if (!session) return;
  document.getElementById('app').innerHTML = '';
  mountLayout({ activeHref: '/app/dashboard.html', title: 'Dashboard', breadcrumb: 'Principal' });
  await cargarDatos();
  render();
}

async function cargarDatos() {
  const rango = calcularRango(getPeriodoActual());
  [_ventas, _objetivos, _cotizacion] = await Promise.all([
    listVentas({ desde: rango.desde, hasta: rango.hasta, limit: 500 }).catch(() => []),
    listObjetivos().catch(() => []),
    getCotizacionHoy().catch(() => null),
  ]);
}

function render() {
  const main = document.querySelector('.main');
  if (!main) return;
  const p = getPeriodoActual();
  const kpi = calcKpis(_ventas);
  const serie = calcSerie(_ventas);
  const ultimasVentas = _ventas.slice(0, 5);
  const margen = kpi.bruto > 0 ? ((kpi.ganancia / kpi.bruto) * 100).toFixed(1) : '0';
  const cotVal = _cotizacion?.valor_ars || 1000;
  const cotLabel = `USD blue $${cotVal.toLocaleString('es-AR')}`;

  main.innerHTML = `
    <!-- Período selector -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
      <h2 style="margin:0;">Dashboard</h2>
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:.85rem;color:var(--text-muted);">Período:</span>
        <select id="selectPeriodo" style="padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);color:var(--text);font-size:.85rem;cursor:pointer;">
          ${Object.entries(PERIODOS).map(([k, v]) => `<option value="${k}" ${k===p?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-bottom:24px;">
      <div class="card kpi-card">
        <div class="kpi-card__label">VENTAS BRUTAS</div>
        <div class="kpi-card__value">${fmtMoney(kpi.bruto)}</div>
        <div class="kpi-card__sub">${kpi.cantidad} ventas</div>
      </div>
      <div class="card kpi-card">
        <div class="kpi-card__label">NETO RECIBIDO</div>
        <div class="kpi-card__value">${fmtMoney(kpi.neto)}</div>
        <div class="kpi-card__sub">después de comisiones</div>
      </div>
      <div class="card kpi-card" style="border-top:3px solid var(--success);">
        <div class="kpi-card__label">GANANCIA</div>
        <div class="kpi-card__value" style="color:var(--success);">${fmtMoney(kpi.ganancia)}</div>
        <div class="kpi-card__sub">Margen ${margen}%</div>
      </div>
      <div class="card kpi-card">
        <div class="kpi-card__label">COTIZACIÓN</div>
        <div class="kpi-card__value" style="font-size:1.4rem;">${cotLabel}</div>
        <div class="kpi-card__sub">dolar blue hoy</div>
      </div>
    </div>

    <!-- Gráfico + últimas ventas -->
    <div style="display:grid;grid-template-columns:1fr 340px;gap:16px;margin-bottom:24px;" class="dashboard-grid">

      <!-- Gráfico -->
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
          <h3 style="margin:0;">Evolución — ${PERIODOS[p]?.label || p}</h3>
          <div style="display:flex;gap:8px;">
            <button class="btn btn--ghost btn--sm chart-mode" data-mode="ganancia" style="${_chartMode==='ganancia'?'font-weight:700;':''}">Ganancia</button>
            <button class="btn btn--ghost btn--sm chart-mode" data-mode="neto" style="${_chartMode==='neto'?'font-weight:700;':''}">Neto</button>
            <button class="btn btn--ghost btn--sm chart-mode" data-mode="bruto" style="${_chartMode==='bruto'?'font-weight:700;':''}">Bruto</button>
          </div>
        </div>
        ${renderChart(serie)}
      </div>

      <!-- Últimas ventas -->
      <div class="card" style="overflow:hidden;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;">Últimas ventas</h3>
          <a href="/app/ventas.html" style="font-size:.8rem;color:var(--accent);">Ver todas →</a>
        </div>
        ${ultimasVentas.length === 0
          ? `<p style="color:var(--text-muted);font-size:.85rem;">Sin ventas en este período</p>`
          : ultimasVentas.map(v => {
              const bruto = (v.precio_unitario_ars||0)*(v.cantidad||1);
              const descs = (v.descuento_ml_ars||0)+(v.descuento_iibb_ars||0)+(v.descuento_otros_ars||0);
              const gan = bruto - descs - (v.costo_total_snapshot||0);
              const nombre = v.productos?.nombre ?? v.notas ?? v.cliente_nombre ?? '—';
              return `<div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div style="min-width:0;">
                  <div style="font-size:.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">${nombre}</div>
                  <div style="font-size:.75rem;color:var(--text-muted);">${fmtDate(v.fecha)} · ${v.canal}</div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                  <div style="font-size:.9rem;font-weight:700;">${fmtMoney(bruto)}</div>
                  <div style="font-size:.75rem;color:var(--success);">+${fmtMoney(gan)}</div>
                </div>
              </div>`;
            }).join('')}
      </div>
    </div>

    <!-- Objetivos -->
    ${_objetivos.filter(o => o.estado === 'activo').length > 0 ? `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;">Objetivos de ahorro</h3>
        <a href="/app/objetivos.html" style="font-size:.8rem;color:var(--accent);">Gestionar →</a>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">
        ${_objetivos.filter(o => o.estado === 'activo').slice(0, 4).map(o => {
          const pct = Math.min(100, calcularProgreso(o));
          const color = pct >= 100 ? 'var(--success)' : pct >= 50 ? 'var(--accent)' : 'var(--warning)';
          return `<div style="padding:12px;background:var(--bg-subtle);border-radius:8px;">
            <div style="font-weight:600;margin-bottom:8px;font-size:.9rem;">${o.nombre}</div>
            <div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden;margin-bottom:6px;">
              <div style="background:${color};height:100%;width:${pct}%;border-radius:4px;transition:width .4s;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--text-muted);">
              <span>${fmtMoney(o.monto_actual_ars)}</span>
              <span>${pct.toFixed(0)}% de ${fmtMoney(o.monto_objetivo_ars)}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
  `;

  // Eventos
  document.getElementById('selectPeriodo').addEventListener('change', async (e) => {
    setPeriodoActual(e.target.value);
    await cargarDatos();
    render();
  });

  document.querySelectorAll('.chart-mode').forEach(btn => {
    btn.addEventListener('click', () => {
      _chartMode = btn.dataset.mode;
      document.querySelectorAll('.chart-mode').forEach(b => b.style.fontWeight = '');
      btn.style.fontWeight = '700';
      const chartEl = document.getElementById('chart-svg-container');
      if (chartEl) chartEl.innerHTML = renderChart(serie);
    });
  });

  // Responsive grid
  const grid = main.querySelector('.dashboard-grid');
  if (grid && window.innerWidth < 900) {
    grid.style.gridTemplateColumns = '1fr';
  }
}

let _chartMode = 'ganancia';

function renderChart(serie) {
  if (!serie.length) return `<p style="color:var(--text-muted);text-align:center;padding:40px 0;">Sin datos para este período</p>`;

  const vals = serie.map(s => s[_chartMode] || 0);
  const maxV = Math.max(...vals, 1);
  const W = 620, H = 180, padL = 50, padB = 24;

  const pts = serie.map((s, i) => {
    const x = padL + (i / Math.max(serie.length - 1, 1)) * (W - padL);
    const y = H - padB - ((s[_chartMode] || 0) / maxV) * (H - padB - 10);
    return `${x},${y}`;
  }).join(' ');

  // Labels: solo mostrar algunos para no saturar
  const step = Math.ceil(serie.length / 6);
  const labels = serie.map((s, i) => {
    if (i % step !== 0 && i !== serie.length - 1) return '';
    const x = padL + (i / Math.max(serie.length - 1, 1)) * (W - padL);
    const label = s.fecha.slice(5); // MM-DD
    return `<text x="${x}" y="${H}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${label}</text>`;
  }).join('');

  // Y axis label
  const yLabel = `<text x="4" y="16" font-size="9" fill="var(--text-muted)">${fmtMoney(maxV)}</text>`;

  const color = _chartMode === 'ganancia' ? 'var(--success)' : _chartMode === 'neto' ? 'var(--accent)' : 'var(--text-muted)';

  return `<div id="chart-svg-container">
    <svg viewBox="0 0 ${W} ${H + 4}" width="100%" style="min-width:300px;overflow:visible;">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity=".25"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${yLabel}
      ${serie.length > 1 ? `
        <polygon fill="url(#chartGrad)" points="${pts} ${W},${H - padB} ${padL},${H - padB}"/>
        <polyline fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" points="${pts}"/>
      ` : ''}
      ${serie.map((s, i) => {
        const x = padL + (i / Math.max(serie.length - 1, 1)) * (W - padL);
        const y = H - padB - ((s[_chartMode] || 0) / maxV) * (H - padB - 10);
        return `<circle cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`;
      }).join('')}
      ${labels}
    </svg>
  </div>`;
}

init();
