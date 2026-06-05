import { requireAuth } from '../core/auth.js';
import { mountLayout } from '../core/layout.js';
import { initTheme } from '../core/theme.js';
import { fmtDate, toast, today } from '../core/utils.js';
import { showModal, closeModal } from '../core/modal.js';
import { listProduccion, createProduccion, deleteProduccion } from '../services/produccion.js';
import { listProductos } from '../services/productos.js';
import { listFilamentos } from '../services/filamentos.js';

let _produccion = [], _productos = [], _filamentos = [];

async function init() {
  initTheme();
  const session = await requireAuth();
  if (!session) return;
  document.getElementById('app').innerHTML = '';
  mountLayout({ activeHref: '/app/produccion.html', title: 'Producción', breadcrumb: 'Principal' });
  [_produccion, _productos, _filamentos] = await Promise.all([
    listProduccion().catch(() => []),
    listProductos(true).catch(() => []),
    listFilamentos().catch(() => []),
  ]);
  render();
}

function render() {
  const main = document.querySelector('.main');
  if (!main) return;

  const totalUnidades = _produccion.reduce((s, p) => s + Number(p.cantidad_producida||0), 0);
  const totalGr       = _produccion.reduce((s, p) => s + Number(p.peso_filamento_usado_g||0), 0);

  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="margin:0 0 2px;">Producción</h2>
        <p style="margin:0;font-size:.82rem;color:var(--text-muted);">${_produccion.length} lotes registrados</p>
      </div>
      <button class="btn btn--primary" id="btnNuevo">+ Registrar lote</button>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:20px;">
      ${[
        { label:'Unidades producidas', val: totalUnidades.toLocaleString('es-AR') + ' u.' },
        { label:'Filamento usado',     val: (totalGr/1000).toFixed(2) + ' kg' },
        { label:'Lotes totales',       val: _produccion.length },
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
            <th>Fecha</th><th>Producto</th><th>Filamento</th>
            <th>Cant. producida</th><th>Filamento usado</th>
            <th>Duración</th><th>Notas</th><th style="width:50px;"></th>
          </tr>
        </thead>
        <tbody>
          ${_produccion.length === 0
            ? `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:40px;">Sin lotes registrados.</td></tr>`
            : _produccion.map(p => `<tr>
                <td style="white-space:nowrap;">${fmtDate(p.fecha)}</td>
                <td><strong>${p.productos?.nombre ?? '—'}</strong></td>
                <td>
                  <div>${p.filamentos?.nombre ?? '—'}</div>
                  ${p.filamentos?.color ? `<div style="font-size:.75rem;color:var(--text-muted);">${p.filamentos.color}</div>` : ''}
                </td>
                <td style="text-align:center;font-weight:700;">${p.cantidad_producida} u.</td>
                <td>${p.peso_filamento_usado_g ? Number(p.peso_filamento_usado_g).toFixed(0) + ' g' : '—'}</td>
                <td style="color:var(--text-muted);">${p.duracion_impresion_min ? p.duracion_impresion_min + ' min' : '—'}</td>
                <td style="color:var(--text-muted);font-size:.82rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${p.notas??''}">${p.notas??'—'}</td>
                <td><button class="btn btn--ghost btn--sm" data-del="${p.id}" title="Eliminar">✕</button></td>
              </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btnNuevo').addEventListener('click', () => abrirModal());
  main.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este lote?')) return;
      await deleteProduccion(btn.dataset.del).catch(e => toast(e.message, 'error'));
      _produccion = await listProduccion().catch(() => []);
      render();
    });
  });
}

function abrirModal() {
  const sinProductos   = _productos.length === 0;
  const sinFilamentos  = _filamentos.length === 0;

  if (sinProductos)  toast('Primero creá productos en Inventario → Productos', 'warning');
  if (sinFilamentos) toast('Primero registrá filamentos en Inventario → Filamentos', 'warning');

  showModal({
    icon: '🖨️',
    title: 'Registrar lote de producción',
    subtitle: 'Nuevo lote impreso',
    saveLabel: '💾 Registrar lote',
    sections: [
      {
        title: 'Qué imprimiste',
        cols: 2,
        fields: [
          { name:'fecha', label:'Fecha de producción', type:'date', required:true, value: today() },
          { name:'cantidad_producida', label:'Unidades producidas', type:'number', required:true, min:1, value:1 },
          { name:'producto_id', label:'Producto fabricado', type:'select', required:true,
            options: _productos.map(p => ({ value: p.id, label: p.nombre })) },
          { name:'filamento_id', label:'Filamento utilizado', type:'select', required:true,
            options: _filamentos.map(f => ({ value: f.id, label: `${f.nombre} — Stock: ${(f.stock_actual_g||0).toFixed(0)}g disp.` })) },
        ]
      },
      {
        title: 'Consumo y tiempo',
        cols: 2,
        fields: [
          { name:'peso_filamento_usado_g',  label:'Filamento usado (g)',    type:'number', step:'0.1', min:0, placeholder:'0', hint:'Gramos consumidos en este lote' },
          { name:'duracion_impresion_min',  label:'Duración impresión (min)', type:'number', min:0, placeholder:'120', hint:'Tiempo total de impresión' },
          { name:'notas', label:'Notas del lote', type:'textarea', width:'full', placeholder:'Observaciones sobre calidad, problemas, ajustes...' },
        ]
      }
    ],
    onSave: guardar,
  });
}

async function guardar(fd) {
  if (!fd.producto_id || !fd.filamento_id || !fd.cantidad_producida)
    return toast('Completá producto, filamento y cantidad', 'error');
  try {
    await createProduccion({
      fecha:                   fd.fecha,
      producto_id:             fd.producto_id || null,
      filamento_id:            fd.filamento_id || null,
      cantidad_producida:      Number(fd.cantidad_producida),
      peso_filamento_usado_g:  Number(fd.peso_filamento_usado_g || 0) || null,
      duracion_impresion_min:  Number(fd.duracion_impresion_min || 0) || null,
      notas:                   fd.notas || null,
    });
    toast('Lote registrado');
    closeModal();
    _produccion = await listProduccion().catch(() => []);
    render();
  } catch(e) { toast(e.message, 'error'); }
}

init();
