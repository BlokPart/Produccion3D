import { requireAuth } from '../core/auth.js';
import { mountLayout } from '../core/layout.js';
import { initTheme } from '../core/theme.js';
import { fmtMoney, fmtDate, toast, today } from '../core/utils.js';
import { listGastos, createGasto, deleteGasto } from '../services/gastos.js';

const CATEGORIAS = ['Materiales','Servicios','Impuestos','Marketing','Logística','Herramientas','Alquiler','Otros'];
let _gastos = [];

async function init() {
  initTheme();
  const session = await requireAuth();
  if (!session) return;
  document.getElementById('app').innerHTML = '';
  mountLayout({ activeHref: '/app/gastos.html', title: 'Gastos', breadcrumb: 'Finanzas' });
  _gastos = await listGastos().catch(() => []);
  render();
}

function render() {
  const main = document.querySelector('.main');
  if (!main) return;

  const mesPrefijo = new Date().toISOString().slice(0, 7);
  const gastosMes = _gastos.filter(g => g.fecha?.startsWith(mesPrefijo));
  const totalMes = gastosMes.reduce((s, g) => s + Number(g.monto_ars ?? 0), 0);

  // Agrupados por categoría
  const porcateg = {};
  _gastos.forEach(g => { porcateg[g.categoria] = (porcateg[g.categoria] ?? 0) + Number(g.monto_ars ?? 0); });
  const topCat = Object.entries(porcateg).sort((a, b) => b[1] - a[1]).slice(0, 4);

  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="margin:0;">Gastos</h2>
        <p style="margin:4px 0 0;color:var(--text-muted);font-size:.85rem;">Este mes: <strong>${fmtMoney(totalMes)}</strong></p>
      </div>
      <button class="btn btn--primary" id="btnNuevo">+ Registrar gasto</button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:24px;">
      ${topCat.map(([cat, total]) => `
        <div class="card" style="padding:16px;">
          <div style="font-size:.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">${cat}</div>
          <div style="font-size:1.25rem;font-weight:700;margin-top:4px;">${fmtMoney(total)}</div>
        </div>`).join('')}
    </div>

    <div class="card" style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Monto</th><th></th></tr>
        </thead>
        <tbody>
          ${_gastos.length === 0
            ? `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:32px;">Sin gastos registrados</td></tr>`
            : _gastos.map(g => `<tr>
                <td>${fmtDate(g.fecha)}</td>
                <td><span class="badge">${g.categoria}</span></td>
                <td>${g.descripcion ?? '—'}</td>
                <td><strong>${fmtMoney(g.monto_ars)}</strong></td>
                <td><button class="btn btn--ghost btn--sm" data-del="${g.id}">✕</button></td>
              </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div id="modal-overlay" class="modal-overlay" style="display:none;">
      <div class="modal">
        <div class="modal__header">
          <h3 class="modal__title">Registrar gasto</h3>
          <button class="modal__close" id="btnCerrarModal">✕</button>
        </div>
        <div class="modal__body">
          <form id="formGasto">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <label class="form-group"><span>Fecha *</span>
                <input type="date" name="fecha" required value="${today()}">
              </label>
              <label class="form-group"><span>Categoría *</span>
                <select name="categoria" required>
                  ${CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
              </label>
            </div>
            <label class="form-group"><span>Descripción</span>
              <input type="text" name="descripcion" placeholder="ej: Bobina PLA extra">
            </label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <label class="form-group"><span>Monto (ARS) *</span>
                <input type="number" name="monto_ars" step="0.01" min="0" required placeholder="0.00">
              </label>
              <label class="form-group"><span>Monto original (opcional)</span>
                <input type="number" name="monto_original" step="0.01" min="0" placeholder="Si es en USD">
              </label>
            </div>
            <label class="form-group"><span>Moneda original</span>
              <select name="moneda_original">
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label class="form-group"><span>Notas</span>
              <textarea name="notas" rows="2" placeholder="Observaciones..."></textarea>
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
  });
  document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
  document.getElementById('btnCancelar').addEventListener('click', cerrarModal);
  document.getElementById('btnGuardar').addEventListener('click', guardar);

  main.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este gasto?')) return;
      await deleteGasto(btn.dataset.del).catch(e => toast(e.message, 'error'));
      _gastos = await listGastos();
      render();
    });
  });
}

function cerrarModal() { document.getElementById('modal-overlay').style.display = 'none'; }

async function guardar() {
  const fd = new FormData(document.getElementById('formGasto'));
  const payload = {
    fecha: fd.get('fecha'),
    categoria: fd.get('categoria'),
    descripcion: fd.get('descripcion') || null,
    monto_ars: Number(fd.get('monto_ars')),
    monto_original: Number(fd.get('monto_original') || 0) || null,
    moneda_original: fd.get('moneda_original'),
    notas: fd.get('notas') || null,
  };
  if (!payload.fecha || !payload.monto_ars) return toast('Completá los campos obligatorios', 'error');
  try {
    await createGasto(payload);
    toast('Gasto registrado');
    cerrarModal();
    _gastos = await listGastos();
    render();
  } catch (e) { toast(e.message, 'error'); }
}

init();
