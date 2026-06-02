import { requireAuth } from '../core/auth.js';
import { mountLayout } from '../core/layout.js';
import { initTheme } from '../core/theme.js';
import { fmtMoney, toast } from '../core/utils.js';
import { listFilamentos, createFilamento, updateFilamento, deleteFilamento } from '../services/filamentos.js';

const MATERIALES = ['PLA','PETG','ABS','TPU','ASA','Nylon','Resina','Otro'];
let _filamentos = [], _editId = null;

async function init() {
  initTheme();
  const session = await requireAuth();
  if (!session) return;
  document.getElementById('app').innerHTML = '';
  mountLayout({ activeHref: '/app/filamentos.html', title: 'Filamentos', breadcrumb: 'Inventario' });
  _filamentos = await listFilamentos().catch(() => []);
  render();
}

function render() {
  const main = document.querySelector('.main');
  if (!main) return;
  main.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
      <div>
        <h2 style="margin:0;">Filamentos</h2>
        <p style="margin:4px 0 0; color:var(--text-muted); font-size:.85rem;">${_filamentos.length} filamentos</p>
      </div>
      <button class="btn btn--primary" id="btnNuevo">+ Agregar filamento</button>
    </div>

    <div class="card" style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Nombre</th><th>Material</th><th>Color</th>
            <th>Stock actual</th><th>Costo/kg</th><th>Costo/g</th>
            <th>Proveedor</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${_filamentos.length === 0
            ? `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;">Sin filamentos. Agregá el primero.</td></tr>`
            : _filamentos.map(f => {
                const stockColor = f.stock_actual_g < 100 ? 'var(--danger)' : f.stock_actual_g < 300 ? 'var(--warning)' : 'var(--success)';
                return `<tr>
                  <td><strong>${f.nombre}</strong></td>
                  <td>${f.material}</td>
                  <td><span style="display:inline-flex;align-items:center;gap:6px;">
                    <span style="width:12px;height:12px;border-radius:50%;background:${f.color};border:1px solid var(--border);"></span>
                    ${f.color}
                  </span></td>
                  <td style="color:${stockColor};font-weight:600;">${(f.stock_actual_g ?? 0).toFixed(0)} g</td>
                  <td>${fmtMoney(f.precio_por_kg_ars)}</td>
                  <td>${fmtMoney((f.precio_por_kg_ars ?? 0) / 1000)}/g</td>
                  <td>${f.proveedor ?? '—'}</td>
                  <td style="display:flex;gap:6px;">
                    <button class="btn btn--ghost btn--sm" data-edit="${f.id}">✏️</button>
                    <button class="btn btn--ghost btn--sm" data-del="${f.id}">✕</button>
                  </td>
                </tr>`;
              }).join('')}
        </tbody>
      </table>
    </div>

    ${modal()}
  `;

  document.getElementById('btnNuevo').addEventListener('click', () => abrirModal());
  document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
  document.getElementById('btnCancelar').addEventListener('click', cerrarModal);
  document.getElementById('btnGuardar').addEventListener('click', guardar);

  main.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = _filamentos.find(x => x.id === btn.dataset.edit);
      if (f) abrirModal(f);
    });
  });
  main.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar filamento? También se eliminan sus compras.')) return;
      await deleteFilamento(btn.dataset.del).catch(e => toast(e.message, 'error'));
      _filamentos = await listFilamentos();
      render();
    });
  });
}

function modal(f = null) {
  return `
    <div id="modal-overlay" class="modal-overlay" style="display:none;">
      <div class="modal">
        <div class="modal__header">
          <h3 class="modal__title">${f ? 'Editar' : 'Nuevo'} filamento</h3>
          <button class="modal__close" id="btnCerrarModal">✕</button>
        </div>
        <div class="modal__body">
          <form id="formFilamento">
            <label class="form-group"><span>Nombre *</span>
              <input type="text" name="nombre" required value="${f?.nombre ?? ''}" placeholder="ej: PLA Rojo Sunlu">
            </label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <label class="form-group"><span>Material *</span>
                <select name="material" required>
                  ${MATERIALES.map(m => `<option value="${m}" ${f?.material === m ? 'selected' : ''}>${m}</option>`).join('')}
                </select>
              </label>
              <label class="form-group"><span>Color</span>
                <input type="text" name="color" value="${f?.color ?? ''}" placeholder="ej: Rojo">
              </label>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <label class="form-group"><span>Precio por kg (ARS) *</span>
                <input type="number" name="precio_por_kg_ars" step="0.01" min="0" required value="${f?.precio_por_kg_ars ?? ''}">
              </label>
              <label class="form-group"><span>Proveedor</span>
                <input type="text" name="proveedor" value="${f?.proveedor ?? ''}" placeholder="ej: Filamentosya">
              </label>
            </div>
            <label class="form-group"><span>Notas</span>
              <textarea name="notas" rows="2">${f?.notas ?? ''}</textarea>
            </label>
          </form>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost" id="btnCancelar">Cancelar</button>
          <button class="btn btn--primary" id="btnGuardar">Guardar</button>
        </div>
      </div>
    </div>`;
}

function abrirModal(f = null) {
  _editId = f?.id ?? null;
  const existing = document.getElementById('modal-overlay');
  if (existing) existing.remove();
  document.querySelector('.main').insertAdjacentHTML('beforeend', modal(f));
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
  document.getElementById('btnCancelar').addEventListener('click', cerrarModal);
  document.getElementById('btnGuardar').addEventListener('click', guardar);
}

function cerrarModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  _editId = null;
}

async function guardar() {
  const form = document.getElementById('formFilamento');
  const fd = new FormData(form);
  const payload = {
    nombre: fd.get('nombre'),
    material: fd.get('material'),
    color: fd.get('color') || null,
    precio_por_kg_ars: Number(fd.get('precio_por_kg_ars')),
    proveedor: fd.get('proveedor') || null,
    notas: fd.get('notas') || null,
  };
  if (!payload.nombre || !payload.precio_por_kg_ars) return toast('Completá los campos obligatorios', 'error');
  try {
    if (_editId) await updateFilamento(_editId, payload);
    else await createFilamento(payload);
    toast(_editId ? 'Filamento actualizado' : 'Filamento creado');
    cerrarModal();
    _filamentos = await listFilamentos();
    render();
  } catch (e) { toast(e.message, 'error'); }
}

init();
