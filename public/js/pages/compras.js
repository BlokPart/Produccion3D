import { requireAuth } from '../core/auth.js';
import { mountLayout } from '../core/layout.js';
import { initTheme } from '../core/theme.js';
import { fmtMoney, fmtDate, toast, today } from '../core/utils.js';
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

  const totalMes = _compras
    .filter(c => c.fecha?.startsWith(new Date().toISOString().slice(0,7)))
    .reduce((s, c) => s + Number(c.precio_total_ars ?? 0), 0);

  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="margin:0;">Compras de filamento</h2>
        <p style="margin:4px 0 0;color:var(--text-muted);font-size:.85rem;">
          Este mes: <strong>${fmtMoney(totalMes)}</strong> en ${_compras.filter(c=>c.fecha?.startsWith(new Date().toISOString().slice(0,7))).length} compras
        </p>
      </div>
      <button class="btn btn--primary" id="btnNuevo">+ Registrar compra</button>
    </div>

    <div class="card" style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th><th>Filamento</th><th>Peso comprado</th>
            <th>Precio total</th><th>Costo/g</th><th>Proveedor</th><th>Factura</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${_compras.length === 0
            ? `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;">Sin compras registradas</td></tr>`
            : _compras.map(c => `<tr>
                <td>${fmtDate(c.fecha)}</td>
                <td>${c.filamentos?.nombre ?? '—'}<br><small style="color:var(--text-muted);">${c.filamentos?.color ?? ''}</small></td>
                <td>${c.peso_comprado_g} g</td>
                <td><strong>${fmtMoney(c.precio_total_ars)}</strong></td>
                <td>${fmtMoney(c.costo_por_gramo)}/g</td>
                <td>${c.proveedor ?? '—'}</td>
                <td>${c.numero_factura ?? '—'}</td>
                <td><button class="btn btn--ghost btn--sm" data-del="${c.id}">✕</button></td>
              </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div id="modal-overlay" class="modal-overlay" style="display:none;">
      <div class="modal">
        <div class="modal__header">
          <h3 class="modal__title">Registrar compra</h3>
          <button class="modal__close" id="btnCerrarModal">✕</button>
        </div>
        <div class="modal__body">
          <form id="formCompra">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <label class="form-group"><span>Fecha *</span>
                <input type="date" name="fecha" required value="${today()}">
              </label>
              <label class="form-group"><span>Filamento *</span>
                <select name="filamento_id" required>
                  <option value="">Seleccioná...</option>
                  ${_filamentos.map(f => `<option value="${f.id}">${f.nombre} (${f.material})</option>`).join('')}
                </select>
              </label>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <label class="form-group"><span>Peso comprado (g) *</span>
                <input type="number" name="peso_comprado_g" min="1" required placeholder="1000">
              </label>
              <label class="form-group"><span>Precio total (ARS) *</span>
                <input type="number" name="precio_total_ars" step="0.01" min="0" required placeholder="0.00">
              </label>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <label class="form-group"><span>Proveedor</span>
                <input type="text" name="proveedor" placeholder="ej: Filamentosya">
              </label>
              <label class="form-group"><span>Nº Factura</span>
                <input type="text" name="numero_factura" placeholder="ej: A-0001">
              </label>
            </div>
            <label class="form-group"><span>Notas</span>
              <textarea name="notas" rows="2" placeholder="Observaciones..."></textarea>
            </label>
          </form>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost" id="btnCancelar">Cancelar</button>
          <button class="btn btn--primary" id="btnGuardar">Registrar compra</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btnNuevo').addEventListener('click', () => {
    document.getElementById('modal-overlay').style.display = 'flex';
    if (_filamentos.length === 0) toast('Primero agregá filamentos en el inventario', 'warning');
  });
  document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
  document.getElementById('btnCancelar').addEventListener('click', cerrarModal);
  document.getElementById('btnGuardar').addEventListener('click', guardar);

  main.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta compra?')) return;
      await deleteCompra(btn.dataset.del).catch(e => toast(e.message, 'error'));
      _compras = await listCompras();
      render();
    });
  });
}

function cerrarModal() { document.getElementById('modal-overlay').style.display = 'none'; }

async function guardar() {
  const fd = new FormData(document.getElementById('formCompra'));
  const payload = {
    fecha: fd.get('fecha'),
    filamento_id: fd.get('filamento_id'),
    peso_comprado_g: Number(fd.get('peso_comprado_g')),
    precio_total_ars: Number(fd.get('precio_total_ars')),
    proveedor: fd.get('proveedor') || null,
    numero_factura: fd.get('numero_factura') || null,
    notas: fd.get('notas') || null,
  };
  if (!payload.fecha || !payload.filamento_id || !payload.peso_comprado_g || !payload.precio_total_ars)
    return toast('Completá los campos obligatorios', 'error');
  try {
    await createCompra(payload);
    toast('Compra registrada');
    cerrarModal();
    _compras = await listCompras();
    render();
  } catch (e) { toast(e.message, 'error'); }
}

init();
