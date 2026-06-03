import { requireAuth } from '../core/auth.js';
import { mountLayout } from '../core/layout.js';
import { initTheme } from '../core/theme.js';
import { fmtMoney, fmtDate, toast, today } from '../core/utils.js';
import { listVentas, createVenta, updateVenta, deleteVenta, calcKpis, PERIODOS, getPeriodoActual, setPeriodoActual, calcularRango } from '../services/ventas.js';
import { listProductos } from '../services/productos.js';
import { getCotizacionHoy, arsToUsd } from '../services/cotizacion.js';

let _ventas = [], _productos = [], _cotizacion = null, _editId = null;

async function init() {
  initTheme();
  const session = await requireAuth();
  if (!session) return;
  document.getElementById('app').innerHTML = '';
  mountLayout({ activeHref: '/app/ventas.html', title: 'Ventas', breadcrumb: 'Principal' });
  await cargarDatos();
  render();
}

async function cargarDatos() {
  const rango = calcularRango(getPeriodoActual());
  [_ventas, _productos, _cotizacion] = await Promise.all([
    listVentas({ desde: rango.desde, hasta: rango.hasta }).catch(() => []),
    listProductos(true).catch(() => []),
    getCotizacionHoy().catch(() => null),
  ]);
}

function render() {
  const main = document.querySelector('.main');
  if (!main) return;
  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="margin:0;">Ventas</h2>
        <p style="margin:4px 0 0;color:var(--text-muted);font-size:.85rem;">${_ventas.length} registros · ${PERIODOS[getPeriodoActual()]?.label}</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <select id="selectPeriodo" style="padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);color:var(--text);font-size:.85rem;cursor:pointer;">
          ${Object.entries(PERIODOS).map(([k,v])=>`<option value="${k}" ${k===getPeriodoActual()?'selected':''}>${v.label}</option>`).join('')}
        </select>
        <button class="btn btn--primary" id="btnNuevaVenta">+ Nueva venta</button>
      </div>
    </div>

    <div class="card" style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th><th>Producto</th><th>Cant.</th>
            <th>Precio unit.</th><th>Bruto</th>
            <th>Desc. ML</th><th>Desc. IIBB</th><th>Desc. Otros</th>
            <th>Neto recibido</th><th>Neto USD</th><th>Ganancia</th>
            <th>Canal</th><th>Cliente</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${_ventas.length === 0
            ? `<tr><td colspan="14" style="text-align:center;color:var(--text-muted);padding:32px;">Sin ventas registradas</td></tr>`
            : _ventas.map(v => {
                const bruto  = (v.precio_unitario_ars || 0) * (v.cantidad || 1);
                const dML    = Number(v.descuento_ml_ars    || 0);
                const dIIBB  = Number(v.descuento_iibb_ars  || 0);
                const dOtros = Number(v.descuento_otros_ars || 0);
                const neto   = bruto - dML - dIIBB - dOtros;
                const costo  = Number(v.costo_total_snapshot || 0);
                const ganancia = neto - costo;
                const prod   = _productos.find(p => p.id === v.producto_id)?.nombre ?? v.notas ?? '—';
                return `<tr>
                  <td>${fmtDate(v.fecha)}</td>
                  <td>${prod}</td>
                  <td>${v.cantidad}</td>
                  <td>${fmtMoney(v.precio_unitario_ars)}</td>
                  <td style="color:var(--text-muted);">${fmtMoney(bruto)}</td>
                  <td style="color:var(--danger,#e53935);">${dML > 0 ? '-'+fmtMoney(dML) : '—'}</td>
                  <td style="color:var(--danger,#e53935);">${dIIBB > 0 ? '-'+fmtMoney(dIIBB) : '—'}</td>
                  <td style="color:var(--danger,#e53935);">${dOtros > 0 ? '-'+fmtMoney(dOtros) : '—'}</td>
                  <td><strong>${fmtMoney(neto)}</strong></td>
                  <td style="color:var(--text-muted);font-size:.85rem;">${_cotizacion?.valor_ars > 0 ? 'US$ ' + (neto/_cotizacion.valor_ars).toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:0}) : '—'}</td>
                  <td style="color:${ganancia>=0?'var(--success)':'var(--danger,#e53935)'};font-weight:600;">${fmtMoney(ganancia)}</td>
                  <td><span class="badge">${v.canal}</span></td>
                  <td>${v.cliente_nombre ?? '—'}</td>
                  <td style="display:flex;gap:4px;">
                    <button class="btn btn--ghost btn--sm" data-edit="${v.id}" title="Editar">✏️</button>
                    <button class="btn btn--ghost btn--sm" data-del="${v.id}" title="Eliminar">✕</button>
                  </td>
                </tr>`;
              }).join('')}
        </tbody>
      </table>
    </div>
    <div id="modal-container"></div>
  `;

  document.getElementById('btnNuevaVenta').addEventListener('click', () => abrirModal(null));

  main.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = _ventas.find(x => x.id === btn.dataset.edit);
      if (v) abrirModal(v);
    });
  });

  main.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta venta?')) return;
      await deleteVenta(btn.dataset.del).catch(e => toast(e.message, 'error'));
      await cargarDatos();
      render();
    });
  });
}

function abrirModal(v = null) {
  _editId = v?.id ?? null;
  const esEdicion = !!v;

  document.getElementById('modal-container').innerHTML = `
    <div id="modal-overlay" class="modal-overlay" style="display:flex;">
      <div class="modal" style="max-width:560px;width:100%;">
        <div class="modal__header">
          <h3 class="modal__title">${esEdicion ? 'Editar venta' : 'Nueva venta'}</h3>
          <button class="modal__close" id="btnCerrar">✕</button>
        </div>
        <div class="modal__body">
          <form id="formVenta">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <label class="form-group"><span>Fecha *</span>
                <input type="date" name="fecha" required value="${v?.fecha ?? today()}">
              </label>
              <label class="form-group"><span>Canal *</span>
                <select name="canal" required>
                  <option value="mercadolibre" ${v?.canal==='mercadolibre'?'selected':''}>Mercado Libre</option>
                  <option value="mercadolibre_alt" ${v?.canal==='mercadolibre_alt'?'selected':''}>ML cuenta alt</option>
                  <option value="efectivo" ${(!v||v?.canal==='efectivo')?'selected':''}>Efectivo</option>
                  <option value="transferencia" ${v?.canal==='transferencia'?'selected':''}>Transferencia</option>
                  <option value="otro" ${v?.canal==='otro'?'selected':''}>Otro</option>
                </select>
              </label>
            </div>

            <label class="form-group"><span>Producto</span>
              <select name="producto_id" id="selectProducto">
                <option value="">Sin producto asociado</option>
                ${_productos.map(p => `<option value="${p.id}" ${v?.producto_id===p.id?'selected':''}>${p.nombre} — ${fmtMoney(p.precio_venta_ars)}</option>`).join('')}
              </select>
            </label>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <label class="form-group"><span>Cantidad *</span>
                <input type="number" name="cantidad" min="1" value="${v?.cantidad ?? 1}" required>
              </label>
              <label class="form-group"><span>Precio unitario (ARS) *</span>
                <input type="number" name="precio_unitario_ars" id="inputPrecio" step="0.01" min="0" required value="${v?.precio_unitario_ars ?? ''}">
              </label>
            </div>

            <p style="margin:16px 0 8px;font-weight:600;font-size:.9rem;">Descuentos</p>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
              <label class="form-group"><span>Comisión ML (ARS)</span>
                <input type="number" name="descuento_ml_ars" step="0.01" min="0" value="${v?.descuento_ml_ars ?? 0}" placeholder="0.00">
              </label>
              <label class="form-group"><span>Ing. Brutos (ARS)</span>
                <input type="number" name="descuento_iibb_ars" step="0.01" min="0" value="${v?.descuento_iibb_ars ?? 0}" placeholder="0.00">
              </label>
              <label class="form-group"><span>Otros (ARS)</span>
                <input type="number" name="descuento_otros_ars" step="0.01" min="0" value="${v?.descuento_otros_ars ?? 0}" placeholder="0.00">
              </label>
            </div>
            <p id="totalDescuento" style="font-size:.85rem;color:var(--text-muted);margin:4px 0 16px;">
              Total descuentos: ${fmtMoney((v?.descuento_ml_ars??0)+(v?.descuento_iibb_ars??0)+(v?.descuento_otros_ars??0))}
            </p>

            <label class="form-group"><span>Cliente</span>
              <input type="text" name="cliente_nombre" value="${v?.cliente_nombre ?? ''}" placeholder="Nombre del cliente">
            </label>
            <label class="form-group"><span>Notas</span>
              <textarea name="notas" rows="2">${v?.notas ?? ''}</textarea>
            </label>
          </form>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost" id="btnCancelar">Cancelar</button>
          <button class="btn btn--primary" id="btnGuardar">${esEdicion ? 'Guardar cambios' : 'Guardar venta'}</button>
        </div>
      </div>
    </div>
  `;

  // Auto-fill precio desde producto
  document.getElementById('selectProducto')?.addEventListener('change', (e) => {
    const p = _productos.find(p => p.id === e.target.value);
    if (p) document.getElementById('inputPrecio').value = p.precio_venta_ars;
  });

  // Actualizar total descuentos en tiempo real
  ['descuento_ml_ars','descuento_iibb_ars','descuento_otros_ars'].forEach(name => {
    document.querySelector(`[name="${name}"]`)?.addEventListener('input', actualizarTotalDesc);
  });

  document.getElementById('btnCerrar').addEventListener('click', cerrarModal);
  document.getElementById('btnCancelar').addEventListener('click', cerrarModal);
  document.getElementById('btnGuardar').addEventListener('click', guardar);
}

function actualizarTotalDesc() {
  const form = document.getElementById('formVenta');
  const total = ['descuento_ml_ars','descuento_iibb_ars','descuento_otros_ars']
    .reduce((s, n) => s + Number(form.querySelector(`[name="${n}"]`)?.value || 0), 0);
  document.getElementById('totalDescuento').textContent = `Total descuentos: ${fmtMoney(total)}`;
}

function cerrarModal() {
  document.getElementById('modal-container').innerHTML = '';
  _editId = null;
}

async function guardar() {
  const fd = new FormData(document.getElementById('formVenta'));
  const dML   = Number(fd.get('descuento_ml_ars')   || 0);
  const dIIBB = Number(fd.get('descuento_iibb_ars') || 0);
  const dOtros= Number(fd.get('descuento_otros_ars')|| 0);
  const payload = {
    fecha:              fd.get('fecha'),
    canal:              fd.get('canal'),
    cantidad:           Number(fd.get('cantidad')),
    precio_unitario_ars:Number(fd.get('precio_unitario_ars')),
    descuento_ml_ars:   dML,
    descuento_iibb_ars: dIIBB,
    descuento_otros_ars:dOtros,
    descuento_ars:      dML + dIIBB + dOtros,
    cliente_nombre:     fd.get('cliente_nombre') || null,
    notas:              fd.get('notas') || null,
    producto_id:        fd.get('producto_id') || null,
    cotizacion_usd_id:  _cotizacion?.id ?? null,
  };

  if (!payload.fecha || !payload.precio_unitario_ars)
    return toast('Completá los campos obligatorios', 'error');

  try {
    if (_editId) {
      await updateVenta(_editId, payload);
      toast('Venta actualizada');
    } else {
      await createVenta(payload);
      toast('Venta guardada');
    }
    cerrarModal();
    await cargarDatos();
    render();
  } catch (e) { toast(e.message, 'error'); }
}

init();
