import { requireAuth } from '../core/auth.js';
import { mountLayout } from '../core/layout.js';
import { initTheme } from '../core/theme.js';
import { fmtMoney, toast } from '../core/utils.js';
import { listProductos, createProducto, updateProducto, deleteProducto } from '../services/productos.js';

let _productos = [], _editId = null;

async function init() {
  initTheme();
  const session = await requireAuth();
  if (!session) return;
  document.getElementById('app').innerHTML = '';
  mountLayout({ activeHref: '/app/productos.html', title: 'Productos', breadcrumb: 'Inventario' });
  _productos = await listProductos().catch(() => []);
  render();
}

function render() {
  const main = document.querySelector('.main');
  if (!main) return;
  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="margin:0;">Productos</h2>
        <p style="margin:4px 0 0;color:var(--text-muted);font-size:.85rem;">${_productos.length} productos</p>
      </div>
      <button class="btn btn--primary" id="btnNuevo">+ Nuevo producto</button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;">
      ${_productos.length === 0
        ? `<div class="card" style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:48px;">
             Sin productos. Agregá el primero para poder registrar ventas y producción.
           </div>`
        : _productos.map(p => `
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div>
                <h3 style="margin:0 0 4px;">${p.nombre}</h3>
                ${p.categoria ? `<span class="badge">${p.categoria}</span>` : ''}
              </div>
              <span style="font-size:1.1rem;font-weight:700;color:var(--accent);">${fmtMoney(p.precio_venta_ars)}</span>
            </div>
            ${p.descripcion ? `<p style="margin:12px 0 0;font-size:.85rem;color:var(--text-muted);">${p.descripcion}</p>` : ''}
            <div style="display:flex;gap:8px;margin-top:16px;">
              <button class="btn btn--ghost btn--sm" data-edit="${p.id}">Editar</button>
              <button class="btn btn--ghost btn--sm" data-del="${p.id}">Eliminar</button>
              ${!p.activo ? `<span class="badge" style="background:var(--danger-subtle);color:var(--danger);">Inactivo</span>` : ''}
            </div>
          </div>`).join('')}
    </div>

    <div id="modal-overlay" class="modal-overlay" style="display:none;">
      <div class="modal">
        <div class="modal__header">
          <h3 class="modal__title" id="modalTitle">Nuevo producto</h3>
          <button class="modal__close" id="btnCerrarModal">✕</button>
        </div>
        <div class="modal__body">
          <form id="formProducto">
            <label class="form-group"><span>Nombre *</span>
              <input type="text" name="nombre" required placeholder="ej: Deslizador Chico">
            </label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <label class="form-group"><span>Precio de venta (ARS) *</span>
                <input type="number" name="precio_venta_ars" step="0.01" min="0" required placeholder="0.00">
              </label>
              <label class="form-group"><span>Categoría</span>
                <input type="text" name="categoria" placeholder="ej: Deslizadores">
              </label>
            </div>
            <label class="form-group"><span>Descripción</span>
              <textarea name="descripcion" rows="2" placeholder="Descripción opcional..."></textarea>
            </label>
            <label class="form-group" style="flex-direction:row;align-items:center;gap:10px;">
              <input type="checkbox" name="activo" checked style="width:auto;">
              <span>Producto activo</span>
            </label>
          </form>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost" id="btnCancelar">Cancelar</button>
          <button class="btn btn--primary" id="btnGuardar">Guardar</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btnNuevo').addEventListener('click', () => abrirModal());
  document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
  document.getElementById('btnCancelar').addEventListener('click', cerrarModal);
  document.getElementById('btnGuardar').addEventListener('click', guardar);

  main.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = _productos.find(x => x.id === btn.dataset.edit);
      if (p) abrirModal(p);
    });
  });
  main.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar producto?')) return;
      await deleteProducto(btn.dataset.del).catch(e => toast(e.message, 'error'));
      _productos = await listProductos();
      render();
    });
  });
}

function abrirModal(p = null) {
  _editId = p?.id ?? null;
  document.getElementById('modalTitle').textContent = p ? 'Editar producto' : 'Nuevo producto';
  if (p) {
    const form = document.getElementById('formProducto');
    form.nombre.value = p.nombre;
    form.precio_venta_ars.value = p.precio_venta_ars;
    form.categoria.value = p.categoria ?? '';
    form.descripcion.value = p.descripcion ?? '';
    form.activo.checked = p.activo;
  }
  document.getElementById('modal-overlay').style.display = 'flex';
}

function cerrarModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('formProducto').reset();
  document.querySelector('[name=activo]').checked = true;
  _editId = null;
}

async function guardar() {
  const fd = new FormData(document.getElementById('formProducto'));
  const payload = {
    nombre: fd.get('nombre'),
    precio_venta_ars: Number(fd.get('precio_venta_ars')),
    categoria: fd.get('categoria') || null,
    descripcion: fd.get('descripcion') || null,
    activo: fd.get('activo') === 'on',
  };
  if (!payload.nombre || !payload.precio_venta_ars) return toast('Completá los campos obligatorios', 'error');
  try {
    if (_editId) await updateProducto(_editId, payload);
    else await createProducto(payload);
    toast(_editId ? 'Producto actualizado' : 'Producto creado');
    cerrarModal();
    _productos = await listProductos();
    render();
  } catch (e) { toast(e.message, 'error'); }
}

init();
