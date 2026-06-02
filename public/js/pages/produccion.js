import { requireAuth } from '../core/auth.js';
import { mountLayout } from '../core/layout.js';
import { initTheme } from '../core/theme.js';
import { fmtDate, toast, today } from '../core/utils.js';
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

  const unidades = _produccion.reduce((s, p) => s + Number(p.cantidad_producida ?? 0), 0);
  const gramosUsados = _produccion.reduce((s, p) => s + Number(p.peso_filamento_usado_g ?? 0), 0);

  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="margin:0;">Producción</h2>
        <p style="margin:4px 0 0;color:var(--text-muted);font-size:.85rem;">
          ${unidades} unidades producidas · ${gramosUsados.toFixed(0)} g de filamento usados
        </p>
      </div>
      <button class="btn btn--primary" id="btnNuevo">+ Registrar lote</button>
    </div>

    <div class="card" style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th><th>Producto</th><th>Filamento</th>
            <th>Cant. producida</th><th>Filamento usado</th>
            <th>Duración (min)</th><th>Notas</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${_produccion.length === 0
            ? `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;">Sin lotes registrados</td></tr>`
            : _produccion.map(p => `<tr>
                <td>${fmtDate(p.fecha)}</td>
                <td>${p.productos?.nombre ?? '—'}</td>
                <td>${p.filamentos?.nombre ?? '—'}
                  <br><small style="color:var(--text-muted);">${p.filamentos?.color ?? ''}</small></td>
                <td><strong>${p.cantidad_producida}</strong> u.</td>
                <td>${p.peso_filamento_usado_g ?? 0} g</td>
                <td>${p.duracion_impresion_min ?? '—'}</td>
                <td>${p.notas ?? '—'}</td>
                <td><button class="btn btn--ghost btn--sm" data-del="${p.id}">✕</button></td>
              </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div id="modal-overlay" class="modal-overlay" style="display:none;">
      <div class="modal">
        <div class="modal__header">
          <h3 class="modal__title">Registrar lote de producción</h3>
          <button class="modal__close" id="btnCerrarModal">✕</button>
        </div>
        <div class="modal__body">
          <form id="formProduccion">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <label class="form-group"><span>Fecha *</span>
                <input type="date" name="fecha" required value="${today()}">
              </label>
              <label class="form-group"><span>Cantidad producida *</span>
                <input type="number" name="cantidad_producida" min="1" value="1" required>
              </label>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <label class="form-group"><span>Producto *</span>
                <select name="producto_id" required>
                  <option value="">Seleccioná...</option>
                  ${_productos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
                </select>
              </label>
              <label class="form-group"><span>Filamento usado *</span>
                <select name="filamento_id" required>
                  <option value="">Seleccioná...</option>
                  ${_filamentos.map(f => `<option value="${f.id}">${f.nombre} (${(f.stock_actual_g??0).toFixed(0)}g disp.)</option>`).join('')}
                </select>
              </label>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <label class="form-group"><span>Peso filamento usado (g)</span>
                <input type="number" name="peso_filamento_usado_g" step="0.1" min="0" placeholder="0">
              </label>
              <label class="form-group"><span>Duración impresión (min)</span>
                <input type="number" name="duracion_impresion_min" min="0" placeholder="ej: 120">
              </label>
            </div>
            <label class="form-group"><span>Notas</span>
              <textarea name="notas" rows="2" placeholder="Observaciones del lote..."></textarea>
            </label>
          </form>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost" id="btnCancelar">Cancelar</button>
          <button class="btn btn--primary" id="btnGuardar">Registrar</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btnNuevo').addEventListener('click', () => {
    document.getElementById('modal-overlay').style.display = 'flex';
    if (_productos.length === 0) toast('Primero creá productos en el inventario', 'warning');
  });
  document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
  document.getElementById('btnCancelar').addEventListener('click', cerrarModal);
  document.getElementById('btnGuardar').addEventListener('click', guardar);

  main.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este lote?')) return;
      await deleteProduccion(btn.dataset.del).catch(e => toast(e.message, 'error'));
      _produccion = await listProduccion();
      render();
    });
  });
}

function cerrarModal() { document.getElementById('modal-overlay').style.display = 'none'; }

async function guardar() {
  const fd = new FormData(document.getElementById('formProduccion'));
  const payload = {
    fecha: fd.get('fecha'),
    producto_id: fd.get('producto_id') || null,
    filamento_id: fd.get('filamento_id') || null,
    cantidad_producida: Number(fd.get('cantidad_producida')),
    peso_filamento_usado_g: Number(fd.get('peso_filamento_usado_g') || 0) || null,
    duracion_impresion_min: Number(fd.get('duracion_impresion_min') || 0) || null,
    notas: fd.get('notas') || null,
  };
  if (!payload.fecha || !payload.cantidad_producida) return toast('Completá los campos obligatorios', 'error');
  try {
    await createProduccion(payload);
    toast('Lote registrado');
    cerrarModal();
    _produccion = await listProduccion();
    render();
  } catch (e) { toast(e.message, 'error'); }
}

init();
