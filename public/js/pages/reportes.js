import { requireAuth } from '../core/auth.js';
import { mountLayout } from '../core/layout.js';
import { initTheme } from '../core/theme.js';
import { fmtMoney, toast } from '../core/utils.js';
import { resumenMensual, rankingProductos } from '../services/reportes.js';

async function init() {
  initTheme();
  const session = await requireAuth();
  if (!session) return;
  document.getElementById('app').innerHTML = '<div style="padding:32px;color:var(--text-muted);">Cargando reportes...</div>';
  mountLayout({ activeHref: '/app/reportes.html', title: 'Reportes', breadcrumb: 'Finanzas' });

  const [resumen, ranking] = await Promise.all([
    resumenMensual(12).catch(() => []),
    rankingProductos(8).catch(() => []),
  ]);
  render(resumen, ranking);
}

function render(resumen, ranking) {
  const main = document.querySelector('.main');
  if (!main) return;

  const maxIngresos = Math.max(...resumen.map(r => Number(r.total_ingresos ?? 0)), 1);

  main.innerHTML = `
    <div style="margin-bottom:24px;">
      <h2 style="margin:0;">Reportes</h2>
      <p style="margin:4px 0 0;color:var(--text-muted);font-size:.85rem;">Últimos 12 meses</p>
    </div>

    <!-- Gráfico ingresos vs gastos -->
    <div class="card" style="margin-bottom:24px;">
      <h3 style="margin:0 0 20px;">Ingresos vs Gastos mensuales</h3>
      <div style="overflow-x:auto;">
        <svg viewBox="0 0 700 200" width="100%" style="min-width:400px;">
          ${resumen.slice().reverse().map((r, i, arr) => {
            const x = 40 + i * (620 / Math.max(arr.length - 1, 1));
            const ingresos = Number(r.total_ingresos ?? 0);
            const gastos = Number(r.total_gastos ?? 0);
            const yI = 180 - (ingresos / maxIngresos) * 150;
            const yG = 180 - (gastos / maxIngresos) * 150;
            const mes = r.mes?.slice(0, 7) ?? '';
            const label = mes.slice(5) + '/' + mes.slice(2, 4);
            return `
              <circle cx="${x}" cy="${yI}" r="4" fill="var(--accent)"/>
              <circle cx="${x}" cy="${yG}" r="4" fill="var(--danger, #e53935)"/>
              <text x="${x}" y="198" text-anchor="middle" font-size="9" fill="var(--text-muted)">${label}</text>
            `;
          }).join('')}
          <!-- Líneas ingresos -->
          ${resumen.length > 1 ? `<polyline fill="none" stroke="var(--accent)" stroke-width="2"
            points="${resumen.slice().reverse().map((r, i, arr) => {
              const x = 40 + i * (620 / Math.max(arr.length - 1, 1));
              const y = 180 - (Number(r.total_ingresos ?? 0) / maxIngresos) * 150;
              return `${x},${y}`;
            }).join(' ')}"/>` : ''}
          <!-- Líneas gastos -->
          ${resumen.length > 1 ? `<polyline fill="none" stroke="var(--danger, #e53935)" stroke-width="2" stroke-dasharray="4,3"
            points="${resumen.slice().reverse().map((r, i, arr) => {
              const x = 40 + i * (620 / Math.max(arr.length - 1, 1));
              const y = 180 - (Number(r.total_gastos ?? 0) / maxIngresos) * 150;
              return `${x},${y}`;
            }).join(' ')}"/>` : ''}
          <text x="10" y="12" font-size="9" fill="var(--accent)">● Ingresos</text>
          <text x="80" y="12" font-size="9" fill="var(--danger,#e53935)">- - Gastos</text>
        </svg>
      </div>
    </div>

    <!-- Tabla resumen mensual -->
    <div class="card" style="overflow-x:auto;margin-bottom:24px;">
      <h3 style="margin:0 0 16px;">Resumen por mes</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Mes</th><th>Ventas</th><th>Ingresos</th><th>Gastos</th>
            <th>Ganancia bruta</th><th>Margen</th>
          </tr>
        </thead>
        <tbody>
          ${resumen.length === 0
            ? `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px;">Sin datos todavía</td></tr>`
            : resumen.map(r => {
                const ingresos = Number(r.total_ingresos ?? 0);
                const gastos = Number(r.total_gastos ?? 0);
                const ganancia = ingresos - gastos;
                const margen = ingresos > 0 ? ((ganancia / ingresos) * 100).toFixed(1) : '0';
                const colorG = ganancia >= 0 ? 'var(--success)' : 'var(--danger,#e53935)';
                return `<tr>
                  <td><strong>${r.mes?.slice(0, 7) ?? '—'}</strong></td>
                  <td>${r.total_ventas ?? 0}</td>
                  <td>${fmtMoney(ingresos)}</td>
                  <td>${fmtMoney(gastos)}</td>
                  <td style="color:${colorG};font-weight:600;">${fmtMoney(ganancia)}</td>
                  <td style="color:${colorG};">${margen}%</td>
                </tr>`;
              }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Ranking productos -->
    ${ranking.length > 0 ? `
    <div class="card">
      <h3 style="margin:0 0 16px;">Top productos</h3>
      <table class="data-table">
        <thead>
          <tr><th>#</th><th>Producto</th><th>Unidades</th><th>Ingresos</th><th>Ganancia</th></tr>
        </thead>
        <tbody>
          ${ranking.map((p, i) => `<tr>
            <td style="color:var(--text-muted);">${i + 1}</td>
            <td><strong>${p.nombre ?? '—'}</strong></td>
            <td>${p.total_vendido ?? 0}</td>
            <td>${fmtMoney(p.ingresos_totales ?? 0)}</td>
            <td style="color:var(--success);">${fmtMoney(p.ganancia_total ?? 0)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}
  `;
}

init();
