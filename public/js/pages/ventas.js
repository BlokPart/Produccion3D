import { requireAuth } from '../core/auth.js';
import { mountLayout } from '../core/layout.js';
import { initTheme } from '../core/theme.js';
import { fmtMoney, fmtDate, toast, today } from '../core/utils.js';
import { listVentas, createVenta } from '../services/ventas.js';
import { listProductos } from '../services/productos.js';
import { getCotizacionHoy } from '../services/cotizacion.js';

let _ventas = [], _productos = [], _cotizacion = null;

async function init() {
  initTheme();
  const session = await requireAuth();
  if (!session) return;

  document.getElementById('app').innerHTML = `<div id="page-content" class="page-loading">Cargando...</div>`;
  mountLayout({ activeHref: '/app/ventas.html', title: 'Ventas', breadcrumb: 'Principal' });

  [_ventas, _productos, _cotizacion] = await Promise.all([
    listVentas().catch(() => []),
    listProductos(true).catch(() => []),
    getCotizacionHoy().catch(() => null),
  ]);
  render();
}

function render() {
  const main = document.querySelector('.main');
  if (!main) return;
  main.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
      <div>
        <h2 style="margin:0;">Ventas</h2>
        <p style="margin:4px 0 0; color:var(--text-muted); font-size:.85rem;">${_ventas.length} registros totales</p>
      </div>
      <button class="btn btn--primary" id="btnNuevaVenta">+ Nueva venta</button>
    </div>

    <div class="card" style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th><th>Producto</th><th>Cant.</th>
            <th>Precio unit.</th><th>Total</th><th>Ganancia</th>
            <th>Canal</th><th>Cliente</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${_ventas.length === 0
            ? `<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:32px;">Sin ventas registradas</td></tr>`
            : _ventas.map(v => `
              <tr>
                <td>${fmtDate(v.fecha)}</td>
                <td>${_productos.find(p => p.id === v.producto_id)?.nombre ?? v.notas?.split('\n')[0] ?? '—'}</td>
                <td>${v.cantidad}</td>
                <td>${fmtMoney(v.precio_unitario_ars)}</td>
                <td><strong>${fmtMoney(v.precio_total_ars)}</strong></td>
                <td style="color:var(--success);">${fmtMoney(v.ganancia_neta ?? 0)}</td>
                <td><span class="badge">${v.canal}</span></td>
                <td>${v.cliente_nombre ?? '—'}</td>
                <td><button class="btn btn--ghost btn--sm" data-del="${v.id}">✕</button></td>
              </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div id="modal-overlay" class="modal-overlay" style="display:none;">
      <div class="modal">
        <div class="modal__header">
          <h3 class="modal__title">Nueva venta</h3>
          <button class="modal__close" id="btnCerrarModal">✕</button>
        </div>
        <div class="modal__body">
          <form id="formVenta">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
              <label class="form-group">
                <span>Fecha *</span>
                <input type="date" name="fecha" required value="${today()}">
              </label>
              <label class="form-group">
                <span>Canal *</span>
                <select name="canal" required>
                  <option value="mercadolibre">Mercado Libre</option>
                  <option value="mercadolibre_alt">ML cuenta alt</option>
                  <option value="efectivo" selected>Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="otro">Otro</option>
                </select>
              </label>
            </div>
            <label class="form-group">
              <span>Producto</span>
              <select name="producto_id">
                <option value="">Sin producto asociado</option>
                ${_productos.map(p => `<option value="${p.id}">${p.nombre} — ${fmtMoney(p.precio_venta_ars)}</option>`).join('')}
              </select>
            </label>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
              <label class="form-group">
                <span>Cantidad *</span>
                <input type="number" name="cantidad" min="1" value="1" required>
              </label>
              <label class="form-group">
                <span>Precio unitario (ARS) *</span>
                <input type="number" name="precio_unitario_ars" step="0.01" min="0" required placeholder="0.00">
              </label>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
              <label class="form-group">
                <span>Descuento (ARS)</span>
                <input type="number" name="descuento_ars" step="0.01" min="0" value="0">
              </label>
              <label class="form-group">
                <span>Cliente</span>
                <input type="text" name="cliente_nombre" placeholder="Nombre del cliente">
              </label>
            </div>
            <label class="form-group">
              <span>Notas</span>
              <textarea name="notas" rows="2" placeholder="Observaciones..."></textarea>
            </label>
          </form>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost" id="btnCancelar">Cancelar</button>
          <button class="btn btn--primary" id="btnGuardar">Guardar venta</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btnNuevaVenta').addEventListener('click', () => {
    document.getElementById('modal-overlay').style.display = 'flex';
  });
  document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
  document.getElementById('btnCancelar').addEventListener('click', cerrarModal);
  document.getElementById('btnGuardar').addEventListener('click', guardar);

  // Auto-fill precio from producto select
  document.querySelector('[name=producto_id]')?.addEventListener('change', (e) => {
    const p = _productos.find(p => p.id === e.target.value);
    if (p) document.querySelector('[name=precio_unitario_ars]').value = p.precio_venta_ars;
  });

  main.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta venta?')) return;
      const { deleteVenta } = await import('../services/ventas.js');
      await deleteVenta(btn.dataset.del).catch(e => toast(e.message, 'error'));
      _ventas = await listVentas().catch(() => []);
      render();
    });
  });
}

function cerrarModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

async function guardar() {
  const form = document.getElementById('formVenta');
  const fd = new FormData(form);
  const payload = {
    fecha: fd.get('fecha'),
    canal: fd.get('canal'),
    cantidad: Number(fd.get('cantidad')),
    precio_unitario_ars: Number(fd.get('precio_unitario_ars')),
    descuento_ars: Number(fd.get('descuento_ars') || 0),
    cliente_nombre: fd.get('cliente_nombre') || null,
    notas: fd.get('notas') || null,
    producto_id: fd.get('producto_id') || null,
    cotizacion_usd_id: _cotizacion?.id ?? null,
  };
  if (!payload.fecha || !payload.precio_unitario_ars) {
    return toast('Completá los campos obligatorios', 'error');
  }
  try {
    await createVenta(payload);
    toast('Venta guardada');
    cerrarModal();
    _ventas = await listVentas();
    render();
  } catch (e) { toast(e.message, 'error'); }
}

init();
