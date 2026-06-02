import { requireAuth } from '../core/auth.js';
import { mountLayout } from '../core/layout.js';
import { initTheme } from '../core/theme.js';
import { fmtMoney, fmtDate, toast, today } from '../core/utils.js';
import { listObjetivos, createObjetivo, updateObjetivo, deleteObjetivo, calcularProgreso } from '../services/objetivos.js';

let _objetivos = [], _editId = null;

async function init() {
  initTheme();
  const session = await requireAuth();
  if (!session) return;
  document.getElementById('app').innerHTML = '';
  mountLayout({ activeHref: '/app/objetivos.html', title: 'Objetivos de ahorro', breadcrumb: 'Finanzas' });
  _objetivos = await listObjetivos().catch(() => []);
  render();
}

function render() {
  const main = document.querySelector('.main');
  if (!main) return;

  const activos = _objetivos.filter(o => o.estado === 'activo');
  const completados = _objetivos.filter(o => o.estado === 'completado');

  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="margin:0;">Objetivos de ahorro</h2>
        <p style="margin:4px 0 0;color:var(--text-muted);font-size:.85rem;">${activos.length} activos · ${completados.length} completados</p>
      </div>
      <button class="btn btn--primary" id="btnNuevo">+ Nuevo objetivo</button>
    </div>

    ${_objetivos.length === 0 ? `
      <div class="card" style="text-align:center;padding:48px;color:var(--text-muted);">
        <p>No tenés objetivos de ahorro todavía.</p>
        <button class="btn btn--primary" id="btnNuevo2" style="margin-top:12px;">Crear primer objetivo</button>
      </div>` : ''}

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
      ${_objetivos.map(o => {
        const pct = Math.min(100, calcularProgreso(o));
        const colorPct = pct >= 100 ? 'var(--success)' : pct >= 50 ? 'var(--accent)' : 'var(--warning)';
        return `
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
              <h3 style="margin:0;">${o.nombre}</h3>
              <span class="badge" style="${o.estado === 'completado' ? 'background:var(--success-subtle,#e8f5e9);color:var(--success);' : ''}">${o.estado}</span>
            </div>
            ${o.descripcion ? `<p style="font-size:.85rem;color:var(--text-muted);margin:0 0 12px;">${o.descripcion}</p>` : ''}

            <div style="background:var(--bg-subtle);border-radius:8px;height:10px;overflow:hidden;margin-bottom:8px;">
              <div style="background:${colorPct};height:100%;width:${pct}%;border-radius:8px;transition:width .4s;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:.85rem;color:var(--text-muted);margin-bottom:16px;">
              <span>${fmtMoney(o.monto_actual_ars)} ahorrado</span>
              <span>${pct.toFixed(0)}% de ${fmtMoney(o.monto_objetivo_ars)}</span>
            </div>

            ${o.fecha_objetivo ? `<p style="font-size:.8rem;color:var(--text-muted);margin:0 0 12px;">📅 Objetivo: ${fmtDate(o.fecha_objetivo)}</p>` : ''}

            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn--primary btn--sm" data-deposito="${o.id}" data-actual="${o.monto_actual_ars}">+ Depósito</button>
              <button class="btn btn--ghost btn--sm" data-edit="${o.id}">Editar</button>
              <button class="btn btn--ghost btn--sm" data-del="${o.id}">Eliminar</button>
            </div>
          </div>`;
      }).join('')}
    </div>

    <div id="modal-overlay" class="modal-overlay" style="display:none;">
      <div class="modal" id="modal-content">
        <!-- filled by abrirModal -->
      </div>
    </div>
  `;

  document.getElementById('btnNuevo').addEventListener('click', () => abrirModalNuevo());
  document.getElementById('btnNuevo2')?.addEventListener('click', () => abrirModalNuevo());

  main.querySelectorAll('[data-deposito]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalDeposito(btn.dataset.deposito, Number(btn.dataset.actual)));
  });
  main.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const o = _objetivos.find(x => x.id === btn.dataset.edit);
      if (o) abrirModalEditar(o);
    });
  });
  main.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar objetivo?')) return;
      await deleteObjetivo(btn.dataset.del).catch(e => toast(e.message, 'error'));
      _objetivos = await listObjetivos();
      render();
    });
  });
}

function abrirModalNuevo() {
  _editId = null;
  document.getElementById('modal-content').innerHTML = `
    <div class="modal__header">
      <h3 class="modal__title">Nuevo objetivo</h3>
      <button class="modal__close" id="btnCerrarModal">✕</button>
    </div>
    <div class="modal__body">
      <form id="formObj">
        <label class="form-group"><span>Nombre *</span>
          <input type="text" name="nombre" required placeholder="ej: Impresora nueva">
        </label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <label class="form-group"><span>Monto objetivo (ARS) *</span>
            <input type="number" name="monto_objetivo_ars" step="0.01" min="0" required placeholder="0.00">
          </label>
          <label class="form-group"><span>Monto inicial (ARS)</span>
            <input type="number" name="monto_actual_ars" step="0.01" min="0" value="0">
          </label>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <label class="form-group"><span>Fecha inicio</span>
            <input type="date" name="fecha_inicio" value="${today()}">
          </label>
          <label class="form-group"><span>Fecha objetivo</span>
            <input type="date" name="fecha_objetivo">
          </label>
        </div>
        <label class="form-group"><span>Descripción</span>
          <textarea name="descripcion" rows="2" placeholder="Para qué es este objetivo..."></textarea>
        </label>
      </form>
    </div>
    <div class="modal__footer">
      <button class="btn btn--ghost" id="btnCancelar">Cancelar</button>
      <button class="btn btn--primary" id="btnGuardar">Crear objetivo</button>
    </div>`;
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
  document.getElementById('btnCancelar').addEventListener('click', cerrarModal);
  document.getElementById('btnGuardar').addEventListener('click', guardarNuevo);
}

function abrirModalDeposito(id, actual) {
  _editId = id;
  document.getElementById('modal-content').innerHTML = `
    <div class="modal__header">
      <h3 class="modal__title">Registrar depósito</h3>
      <button class="modal__close" id="btnCerrarModal">✕</button>
    </div>
    <div class="modal__body">
      <p style="color:var(--text-muted);margin:0 0 16px;">Saldo actual: <strong>${fmtMoney(actual)}</strong></p>
      <label class="form-group"><span>Monto a agregar (ARS) *</span>
        <input type="number" id="inputDeposito" step="0.01" min="0" required placeholder="0.00" autofocus>
      </label>
    </div>
    <div class="modal__footer">
      <button class="btn btn--ghost" id="btnCancelar">Cancelar</button>
      <button class="btn btn--primary" id="btnGuardar">Agregar</button>
    </div>`;
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
  document.getElementById('btnCancelar').addEventListener('click', cerrarModal);
  document.getElementById('btnGuardar').addEventListener('click', async () => {
    const monto = Number(document.getElementById('inputDeposito').value);
    if (!monto || monto <= 0) return toast('Ingresá un monto válido', 'error');
    try {
      await updateObjetivo(id, { monto_actual_ars: actual + monto });
      toast('Depósito registrado');
      cerrarModal();
      _objetivos = await listObjetivos();
      render();
    } catch (e) { toast(e.message, 'error'); }
  });
}

function abrirModalEditar(o) {
  _editId = o.id;
  document.getElementById('modal-content').innerHTML = `
    <div class="modal__header">
      <h3 class="modal__title">Editar objetivo</h3>
      <button class="modal__close" id="btnCerrarModal">✕</button>
    </div>
    <div class="modal__body">
      <form id="formObj">
        <label class="form-group"><span>Nombre *</span>
          <input type="text" name="nombre" required value="${o.nombre}">
        </label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <label class="form-group"><span>Monto objetivo (ARS)</span>
            <input type="number" name="monto_objetivo_ars" step="0.01" min="0" value="${o.monto_objetivo_ars}">
          </label>
          <label class="form-group"><span>Estado</span>
            <select name="estado">
              <option value="activo" ${o.estado==='activo'?'selected':''}>Activo</option>
              <option value="completado" ${o.estado==='completado'?'selected':''}>Completado</option>
              <option value="pausado" ${o.estado==='pausado'?'selected':''}>Pausado</option>
            </select>
          </label>
        </div>
        <label class="form-group"><span>Descripción</span>
          <textarea name="descripcion" rows="2">${o.descripcion ?? ''}</textarea>
        </label>
      </form>
    </div>
    <div class="modal__footer">
      <button class="btn btn--ghost" id="btnCancelar">Cancelar</button>
      <button class="btn btn--primary" id="btnGuardar">Guardar</button>
    </div>`;
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
  document.getElementById('btnCancelar').addEventListener('click', cerrarModal);
  document.getElementById('btnGuardar').addEventListener('click', guardarEditar);
}

function cerrarModal() { document.getElementById('modal-overlay').style.display = 'none'; _editId = null; }

async function guardarNuevo() {
  const fd = new FormData(document.getElementById('formObj'));
  const payload = {
    nombre: fd.get('nombre'),
    monto_objetivo_ars: Number(fd.get('monto_objetivo_ars')),
    monto_actual_ars: Number(fd.get('monto_actual_ars') || 0),
    fecha_inicio: fd.get('fecha_inicio') || null,
    fecha_objetivo: fd.get('fecha_objetivo') || null,
    descripcion: fd.get('descripcion') || null,
  };
  if (!payload.nombre || !payload.monto_objetivo_ars) return toast('Completá los campos obligatorios', 'error');
  try {
    await createObjetivo(payload);
    toast('Objetivo creado');
    cerrarModal();
    _objetivos = await listObjetivos();
    render();
  } catch (e) { toast(e.message, 'error'); }
}

async function guardarEditar() {
  const fd = new FormData(document.getElementById('formObj'));
  const payload = {
    nombre: fd.get('nombre'),
    monto_objetivo_ars: Number(fd.get('monto_objetivo_ars')),
    estado: fd.get('estado'),
    descripcion: fd.get('descripcion') || null,
  };
  try {
    await updateObjetivo(_editId, payload);
    toast('Objetivo actualizado');
    cerrarModal();
    _objetivos = await listObjetivos();
    render();
  } catch (e) { toast(e.message, 'error'); }
}

init();
