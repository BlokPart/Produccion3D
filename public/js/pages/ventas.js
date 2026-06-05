import { requireAuth } from '../core/auth.js';
import { mountLayout } from '../core/layout.js';
import { initTheme } from '../core/theme.js';
import { fmtMoney, fmtDate, toast, today } from '../core/utils.js';
import { showModal, closeModal, getFormData } from '../core/modal.js';
import {
  listVentas, createVenta, updateVenta, deleteVenta, calcKpis,
  PERIODOS, getPeriodoActual, setPeriodoActual, calcularRango
} from '../services/ventas.js';
import { listProductos } from '../services/productos.js';
import { getCotizacionHoy } from '../services/cotizacion.js';

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
  const p = getPeriodoActual();
  const kpi = calcKpis(_ventas);
  const cotVal = _cotizacion?.valor_ars || 0;

  main.innerHTML = `
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="margin:0 0 2px;">Ventas</h2>
        <p style="margin:0;font-size:.82rem;color:var(--text-muted);">${_ventas.length} registros · ${PERIODOS[p]?.label}</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <select id="selectPeriodo" class="mf__input" style="width:auto;padding:8px 14px;">
          ${Object.entries(PERIODOS).map(([k,v])=>`<option value="${k}" ${k===p?'selected':''}>${v.label}</option>`).join('')}
        </select>
        <button class="btn btn--primary" id="btnNuevaVenta">+ Nueva venta</button>
      </div>
    </div>

    <!-- KPI mini -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:20px;">
      ${[
        { label:'Ventas', val: kpi.cantidad + ' ventas', color: '' },
        { label:'Bruto', val: fmtMoney(kpi.bruto), color: '' },
        { label:'Neto recibido', val: fmtMoney(kpi.neto), color: '' },
        { label:'Ganancia', val: fmtMoney(kpi.ganancia), color: 'var(--success)' },
        cotVal > 0 ? { label:'Ganancia USD', val: 'US$ ' + Math.round(kpi.ganancia/cotVal).toLocaleString('es-AR'), color: 'var(--accent)' } : null,
      ].filter(Boolean).map(k => `
        <div class="card" style="padding:12px 16px;">
          <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:3px;">${k.label}</div>
          <div style="font-size:1rem;font-weight:700;color:${k.color||'var(--text)'};">${k.val}</div>
        </div>`).join('')}
    </div>

    <!-- Tabla -->
    <div class="card" style="overflow-x:auto;padding:0;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th><th>Producto</th><th>Cant.</th>
            <th>Precio unit.</th><th>Bruto</th>
            <th>Desc. ML</th><th>Desc. IIBB</th><th>Desc. Otros</th>
            <th>Neto</th>${cotVal>0?'<th>USD</th>':''}<th>Ganancia</th>
            <th>Canal</th><th>Cliente</th><th style="width:72px;"></th>
          </tr>
        </thead>
        <tbody>
          ${_ventas.length === 0
            ? `<tr><td colspan="14" style="text-align:center;color:var(--text-muted);padding:40px;">Sin ventas en este período</td></tr>`
            : _ventas.map(v => {
                const bruto  = (v.precio_unitario_ars||0)*(v.cantidad||1);
                const dML    = Number(v.descuento_ml_ars    ||0);
                const dIIBB  = Number(v.descuento_iibb_ars  ||0);
                const dOtros = Number(v.descuento_otros_ars ||0);
                const neto   = bruto - dML - dIIBB - dOtros;
                const ganancia = neto - Number(v.costo_total_snapshot||0);
                const prod   = v.productos?.nombre ?? v.notas ?? '—';
                const usdCol = cotVal > 0 ? `<td style="color:var(--text-muted);font-size:.82rem;">US$ ${Math.round(neto/cotVal).toLocaleString('es-AR')}</td>` : '';
                return `<tr>
                  <td style="white-space:nowrap;">${fmtDate(v.fecha)}</td>
                  <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${prod}">${prod}</td>
                  <td style="text-align:center;">${v.cantidad}</td>
                  <td>${fmtMoney(v.precio_unitario_ars)}</td>
                  <td style="color:var(--text-muted);">${fmtMoney(bruto)}</td>
                  <td style="color:${dML>0?'var(--danger,#e53935)':'var(--text-muted)'};">${dML>0?'-'+fmtMoney(dML):'—'}</td>
                  <td style="color:${dIIBB>0?'var(--danger,#e53935)':'var(--text-muted)'};">${dIIBB>0?'-'+fmtMoney(dIIBB):'—'}</td>
                  <td style="color:${dOtros>0?'var(--danger,#e53935)':'var(--text-muted)'};">${dOtros>0?'-'+fmtMoney(dOtros):'—'}</td>
                  <td><strong>${fmtMoney(neto)}</strong></td>
                  ${usdCol}
                  <td style="color:${ganancia>=0?'var(--success)':'var(--danger,#e53935)'};font-weight:600;">${fmtMoney(ganancia)}</td>
                  <td><span class="badge">${v.canal}</span></td>
                  <td style="color:var(--text-muted);font-size:.82rem;">${v.cliente_nombre??'—'}</td>
                  <td>
                    <div style="display:flex;gap:4px;">
                      <button class="btn btn--ghost btn--sm" data-edit="${v.id}" title="Editar">✏️</button>
                      <button class="btn btn--ghost btn--sm" data-del="${v.id}" title="Eliminar">✕</button>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('selectPeriodo').addEventListener('change', async e => {
    setPeriodoActual(e.target.value);
    await cargarDatos();
    render();
  });

  document.getElementById('btnNuevaVenta').addEventListener('click', () => abrirModal());

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
      await cargarDatos(); render();
    });
  });
}

function abrirModal(v = null) {
  _editId = v?.id ?? null;
  const esEdicion = !!v;

  showModal({
    icon: '🛍️',
    title: esEdicion ? 'Editar venta' : 'Nueva venta',
    subtitle: esEdicion ? `Modificando venta del ${fmtDate(v?.fecha)}` : 'Registrar venta manual',
    saveLabel: esEdicion ? '💾 Guardar cambios' : '💾 Registrar venta',
    sections: [
      {
        title: 'Datos generales',
        cols: 2,
        fields: [
          { name:'fecha', label:'Fecha', type:'date', required:true, value: v?.fecha ?? today() },
          { name:'canal', label:'Canal de venta', type:'select', required:true,
            value: v?.canal ?? 'efectivo', placeholder: false,
            options: [
              { value:'efectivo', label:'💵 Efectivo' },
              { value:'transferencia', label:'🏦 Transferencia' },
              { value:'mercadolibre', label:'🛒 Mercado Libre' },
              { value:'mercadolibre_alt', label:'🛒 ML cuenta alt' },
              { value:'otro', label:'📦 Otro' },
            ]},
          { name:'producto_id', label:'Producto (opcional)', type:'select', width:'full',
            value: v?.producto_id ?? '',
            options: _productos.map(p => ({ value: p.id, label: `${p.nombre} — ${fmtMoney(p.precio_venta_ars)}` })) },
          { name:'cantidad', label:'Cantidad', type:'number', required:true, min:1, value: v?.cantidad ?? 1 },
          { name:'precio_unitario_ars', label:'Precio unitario (ARS)', type:'number', required:true, step:'0.01', min:0,
            value: v?.precio_unitario_ars ?? '', placeholder:'0,00', id:'inp-precio' },
        ]
      },
      {
        title: 'Descuentos aplicados',
        cols: 3,
        fields: [
          { name:'descuento_ml_ars',    label:'Comisión ML (ARS)',   type:'number', step:'0.01', min:0, value: v?.descuento_ml_ars ?? 0,    hint:'Comisión de Mercado Libre' },
          { name:'descuento_iibb_ars',  label:'Ing. Brutos (ARS)',   type:'number', step:'0.01', min:0, value: v?.descuento_iibb_ars ?? 0,  hint:'Impuesto ingresos brutos' },
          { name:'descuento_otros_ars', label:'Otros descuentos',    type:'number', step:'0.01', min:0, value: v?.descuento_otros_ars ?? 0, hint:'Cupones, descuentos, etc.' },
          { name:'_total_desc', label:'Total descuentos', type:'text', value: fmtMoney((v?.descuento_ml_ars||0)+(v?.descuento_iibb_ars||0)+(v?.descuento_otros_ars||0)),
            hint:'Se actualiza automáticamente', width:'full', id:'inp-total-desc' },
        ]
      },
      {
        title: 'Datos del cliente',
        cols: 2,
        fields: [
          { name:'cliente_nombre', label:'Nombre del cliente', type:'text', value: v?.cliente_nombre ?? '', placeholder:'Opcional' },
          { name:'notas', label:'Notas / descripción', type:'text', value: v?.notas ?? '', placeholder:'Ej: Pack deslizadores grandes' },
        ]
      }
    ],
    onSave: guardar,
  });

  // Listeners en el modal
  const overlay = document.getElementById('mform-overlay');

  // Auto-fill precio desde producto
  overlay.querySelector('[name=producto_id]')?.addEventListener('change', e => {
    const p = _productos.find(x => x.id === e.target.value);
    if (p) overlay.querySelector('[name=precio_unitario_ars]').value = p.precio_venta_ars;
  });

  // Recalcular total descuentos
  ['descuento_ml_ars','descuento_iibb_ars','descuento_otros_ars'].forEach(n => {
    overlay.querySelector(`[name=${n}]`)?.addEventListener('input', () => {
      const total = ['descuento_ml_ars','descuento_iibb_ars','descuento_otros_ars']
        .reduce((s,k) => s + Number(overlay.querySelector(`[name=${k}]`)?.value || 0), 0);
      const el = overlay.querySelector('[name=_total_desc]');
      if (el) el.value = fmtMoney(total);
    });
  });

  // Hacer el campo total-desc readonly
  overlay.querySelector('[name=_total_desc]')?.setAttribute('readonly', '');
}

async function guardar(fd) {
  const dML    = Number(fd.descuento_ml_ars    || 0);
  const dIIBB  = Number(fd.descuento_iibb_ars  || 0);
  const dOtros = Number(fd.descuento_otros_ars || 0);

  if (!fd.fecha || !fd.precio_unitario_ars)
    return toast('Completá los campos obligatorios (fecha y precio)', 'error');

  const payload = {
    fecha:               fd.fecha,
    canal:               fd.canal,
    cantidad:            Number(fd.cantidad || 1),
    precio_unitario_ars: Number(fd.precio_unitario_ars),
    descuento_ml_ars:    dML,
    descuento_iibb_ars:  dIIBB,
    descuento_otros_ars: dOtros,
    descuento_ars:       dML + dIIBB + dOtros,
    cliente_nombre:      fd.cliente_nombre || null,
    notas:               fd.notas || null,
    producto_id:         fd.producto_id || null,
    cotizacion_usd_id:   _cotizacion?.id ?? null,
    costo_total_snapshot: 0,
  };

  try {
    if (_editId) { await updateVenta(_editId, payload); toast('Venta actualizada'); }
    else         { await createVenta(payload);           toast('Venta registrada'); }
    closeModal();
    await cargarDatos();
    render();
  } catch(e) { toast(e.message, 'error'); }
}

init();
