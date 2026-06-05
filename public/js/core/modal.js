/**
 * Modal system reutilizable — genera modales consistentes con secciones y grilla.
 */

export function showModal({ title, subtitle = '', icon = '', sections = [], saveLabel = '💾 Guardar', onSave }) {
  document.getElementById('mform-overlay')?.remove();

  const sectionsHtml = sections.map(s => `
    <div class="mf-section">
      ${s.title ? `<div class="mf-section__title">${s.title}</div>` : ''}
      <div class="mf-grid mf-grid--${s.cols || 2}">
        ${(s.fields || []).map(renderField).join('')}
      </div>
    </div>`).join('');

  document.body.insertAdjacentHTML('beforeend', `
    <div id="mform-overlay" class="modal-overlay">
      <div class="mf">
        <div class="mf__header">
          ${icon ? `<span class="mf__icon">${icon}</span>` : ''}
          <div style="flex:1;min-width:0;">
            <h3 class="mf__title">${title}</h3>
            ${subtitle ? `<p class="mf__sub">${subtitle}</p>` : ''}
          </div>
          <button class="mf__close" data-mf-close>✕</button>
        </div>
        <form id="mform-form" class="mf__body" novalidate autocomplete="off">
          ${sectionsHtml}
        </form>
        <div class="mf__footer">
          <button type="button" class="btn btn--ghost" data-mf-close>Cancelar</button>
          <button type="button" class="btn btn--primary" id="mf-save-btn">${saveLabel}</button>
        </div>
      </div>
    </div>`);

  const overlay = document.getElementById('mform-overlay');
  overlay.querySelectorAll('[data-mf-close]').forEach(b => b.addEventListener('click', closeModal));
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('mf-save-btn').addEventListener('click', () => {
    if (onSave) onSave(getFormData());
  });

  // Focus first input
  setTimeout(() => overlay.querySelector('input,select,textarea')?.focus(), 50);
  return overlay;
}

export function closeModal() {
  document.getElementById('mform-overlay')?.remove();
}

export function getFormData() {
  const form = document.getElementById('mform-form');
  if (!form) return {};
  const out = {};
  new FormData(form).forEach((v, k) => { out[k] = v; });
  // checkboxes
  form.querySelectorAll('input[type=checkbox]').forEach(cb => {
    out[cb.name] = cb.checked;
  });
  return out;
}

export function setFieldValue(name, value) {
  const el = document.querySelector(`#mform-form [name="${name}"]`);
  if (el) el.value = value ?? '';
}

function renderField(f) {
  if (f.type === 'divider') return `<div class="mf-divider mf-col-full">${f.label || ''}</div>`;
  if (f.type === 'note') return `<div class="mf-note mf-col-full">${f.label}</div>`;

  const full = f.width === 'full' ? 'mf-col-full' : '';
  const req  = f.required ? '<span style="color:var(--danger,#e53935);margin-left:2px;">*</span>' : '';

  let control = '';
  if (f.type === 'select') {
    const opts = (f.options || []).map(o =>
      `<option value="${o.value ?? o}" ${(o.value ?? o) == (f.value ?? '') ? 'selected' : ''}>${o.label ?? o}</option>`
    ).join('');
    control = `<select name="${f.name}" class="mf__input" ${f.required ? 'required' : ''}>
      ${f.placeholder !== false ? `<option value="">${f.placeholder || 'Seleccioná...'}</option>` : ''}
      ${opts}</select>`;
  } else if (f.type === 'textarea') {
    control = `<textarea name="${f.name}" class="mf__input mf__textarea"
      rows="${f.rows || 2}" placeholder="${f.placeholder || ''}"
      ${f.required ? 'required' : ''}>${f.value || ''}</textarea>`;
  } else if (f.type === 'checkbox') {
    return `<label class="mf-checkbox ${full}" style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 0;">
      <input type="checkbox" name="${f.name}" ${f.value ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--accent);">
      <span style="font-size:.9rem;">${f.label}</span>
    </label>`;
  } else {
    control = `<input type="${f.type || 'text'}" name="${f.name}" class="mf__input"
      value="${f.value ?? ''}" placeholder="${f.placeholder || ''}"
      ${f.required ? 'required' : ''}
      ${f.min !== undefined ? `min="${f.min}"` : ''}
      ${f.max !== undefined ? `max="${f.max}"` : ''}
      ${f.step !== undefined ? `step="${f.step}"` : ''}
      ${f.id ? `id="${f.id}"` : ''}>`;
  }

  return `<div class="mf__field ${full}">
    <label class="mf__label">${f.label}${req}</label>
    ${control}
    ${f.hint ? `<div class="mf__hint">${f.hint}</div>` : ''}
  </div>`;
}
