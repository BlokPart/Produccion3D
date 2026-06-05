import { requireAuth } from '../core/auth.js';
import { mountLayout } from '../core/layout.js';
import { initTheme } from '../core/theme.js';
import { fmtMoney, fmtDate, toast, today } from '../core/utils.js';
import { showModal, closeModal, getFormData } from '../core/modal.js';
import { listCompras, createCompra, deleteCompra } from '../services/compras.js';
import { listFilamentos } from '../services/filamentos.js';

let _compras = [], _filamentos = [];

async function init() {
  initTheme();
  const session = await requireAuth();
  if (!session) return;
  document.getElementById('app').innerHTML = '';
  mountLayout({ activeHref: '/app/compras.html', title: 'Compras de filamento', breadcrumb: 'Inventario' });
  [_compras, _filamentos] = await Promise.all([
    listCompras().catch(() => []),
    listFilamentos().catch(() => []),
  ]);
  render();
}

function render() {
  const main = document.querySelector('.main');
  if (!main) return;

  const totalArs = _compras.reduce((s, c) => s + Number(c.precio_total_ars || 0), 0);
  const totalGr  = _compras.reduce((s, c) => s + Number(c.peso_comprado_g  || 0), 0);
  const mesPfx   = new Date().toISOString().slice(0, 7);
  const totalMes = _compras.filter(c => c.fecha?.startsWith(mesPfx))
                            .reduce((s, c) => s + Number(c.precio_total_ars || 0), 0);

  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="margin:0 0 2px;">Compras de filamento</h2>
        <p style="margin:0;font-size:.82rem;color:var(--text-muted);">${_compras.length} compras registradas</p>
      </div>
      <button class="btn btn--primary" id="btnNueva">+ Registrar compra</button>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:20px;">
      ${[
        { label:'Total invertido', val: fmtMoney(totalArs) },
        { label:'Este mes',        val: fmtMoney(totalMes) },
        { label:'Total filamento', val: (totalGr/1000).toFixed(2) + ' kg' },
      ].map(k => `<div class="card" style="padding:12px 16px;">
        <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:3px;">${k.label}</div>
        <div style="font-size:1rem;font-weight:700;">${k.val}</div>
      </div>`).join('')}
    </div>

    <!-- Tabla -->
    <div class="card" style="overflow-x:auto;padding:0;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th><th>Filamento</th><th>Material</th><th>Color</th>
            <th>Peso</th><th>Total ARS</th><th>Costo/g</th>
            <th>Proveedor</th><th>Factura</th><th style="width:50px;"></th>
          </tr>
        </thead>
        <tbody>
          ${_compras.length === 0
            ? `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:40px;">Sin compras registradas. Agregá la primera.</td></tr>`
            : _compras.map(c => `<tr>
                <td style="white-space:nowrap;">${fmtDate(c.fecha)}</td>
                <td><strong>${c.filamentos?.nombre ?? '—'}</strong></td>
                <td><span class="badge">${c.filamentos?.material ?? '—'}</span></td>
                <td>${c.filamentos?.color ?? '—'}</td>
                <td>${Number(c.peso_comprado_g||0).toLocaleString('es-AR')} g</td>
                <td><strong>${fmtMoney(c.precio_total_ars)}</strong></td>
                <td style="color:var(--text-muted);">${fmtMoney(c.costo_por_gramo)}/g</td>
                <td style="color:var(--text-muted);">${c.proveedor ?? '—'}</td>
                <td style="color:var(--text-muted);font-size:.82rem;">${c.numero_factura ?? '—'}</td>
                <td><button class="btn btn--ghost btn--sm" data-del="${c.id}" title="Eliminar">✕</button></td>
              </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btnNueva').addEventListener('click', () => abrirModal());
  main.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta compra?')) return;
      await deleteCompra(btn.dataset.del).catch(e => toast(e.message, 'error'));
      _compras = await listCompras().catch(() => []);
      render();
    });
  });
}

function abrirModal() {
  if (_filamentos.length === 0) {
    toast('Primero agregá filamentos en Inventario → Filamentos', 'warning');
    return;
  }

  showModal({
    icon: '🧵',
    title: 'Registrar compra',
    subtitle: 'Nueva compra de filamento',
    saveLabel: '💾 Registrar compra',
    sections: [
      {
        title: 'Qué compraste',
        cols: 2,
        fields: [
          { name:'filamento_id', label:'Filamento', type:'select', required:true,
            options: _filamentos.map(f => ({ value: f.id, label: `${f.nombre} (${f.material}) — Stock: ${(f.stock_actual_g||0).toFixed(0)}g` })) },
          { name:'fecha', label:'Fecha de compra', type:'date', required:true, value: today() },
        ]
      },
      {
        title: 'Cantidad y precio',
        cols: 2,
        fields: [
          { name:'peso_comprado_g',  label:'Peso comprado (g)',   type:'number', required:true, min:1, placeholder:'1000', hint:'Ej: 1000 para 1 bobina estándar' },
          { name:'precio_total_ars', label:'Precio total (ARS)',  type:'number', required:true, step:'0.01', min:0, placeholder:'0,00' },
        ]
      },
      {
        title: 'Datos del proveedor',
        cols: 2,
        fields: [
          { name:'proveedor',       label:'Proveedor',       type:'text', placeholder:'Ej: Filamentosya, MercadoLibre' },
          { name:'numero_factura',  label:'Nº Factura',      type:'text', placeholder:'Ej: A-0001-00000123' },
          { name:'notas', label:'Notas adicionales', type:'textarea', width:'full', placeholder:'Observaciones, lote, color exacto...' },
        ]
      }
    ],
    onSave: guardar,
  });
}

async function guardar(fd) {
  if (!fd.filamento_id || !fd.peso_comprado_g || !fd.precio_total_ars)
    return toast('Completá filamento, peso y precio', 'error');
  try {
    await createCompra({
      filamento_id:    fd.filamento_id,
      fecha:           fd.fecha,
      peso_comprado_g: Number(fd.peso_comprado_g),
      precio_total_ars: Number(fd.precio_total_ars),
      proveedor:       fd.proveedor || null,
      numero_factura:  fd.numero_factura || null,
      notas:           fd.notas || null,
    });
    toast('Compra registrada');
    closeModal();
    [_compras, _filamentos] = await Promise.all([listCompras(), listFilamentos()]);
    render();
  } catch(e) { toast(e.message, 'error'); }
}

init();
