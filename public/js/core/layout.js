// ============================================================================
// LAYOUT — Sidebar y topbar inyectables (DRY entre páginas)
// ============================================================================

import { signOut } from './auth.js';

const NAV = [
  { group: 'Principal', items: [
    { href: '/app/dashboard.html',   label: 'Dashboard',     icon: 'home' },
    { href: '/app/ventas.html',      label: 'Ventas',        icon: 'shopping-bag' },
    { href: '/app/produccion.html',  label: 'Producción',    icon: 'box' },
  ]},
  { group: 'Inventario', items: [
    { href: '/app/filamentos.html',  label: 'Filamentos',    icon: 'layers' },
    { href: '/app/compras.html',     label: 'Compras',       icon: 'shopping-cart' },
    { href: '/app/productos.html',   label: 'Productos',     icon: 'package' },
  ]},
  { group: 'Finanzas', items: [
    { href: '/app/gastos.html',      label: 'Gastos',        icon: 'trending-down' },
    { href: '/app/objetivos.html',   label: 'Objetivos',     icon: 'target' },
    { href: '/app/reportes.html',    label: 'Reportes',      icon: 'bar-chart' },
  ]},
  { group: 'Sistema', items: [
    { href: '/app/configuracion.html', label: 'Configuración', icon: 'settings' },
  ]},
];

const ICONS = {
  home:          '<path d="M3 9.5L12 3l9 6.5V21H3V9.5z"/><path d="M9 21V12h6v9"/>',
  'shopping-bag':'<path d="M6 2L3 6v14h18V6l-3-4H6z"/><path d="M3 6h18M16 10a4 4 0 1 1-8 0"/>',
  box:           '<path d="M21 8L12 3 3 8v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  layers:        '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
  'shopping-cart':'<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  'trending-down':'<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>',
  target:        '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  'bar-chart':   '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  package:        '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  settings:      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

export function renderSidebar(activeHref = '') {
  const groupsHtml = NAV.map(g => `
    <div class="sidebar__group">
      <div class="sidebar__label">${g.group}</div>
      ${g.items.map(it => `
        <a class="sidebar__link ${activeHref.endsWith(it.href.split('/').pop()) ? 'is-active' : ''}" href="${it.href}">
          ${icon(it.icon)}<span>${it.label}</span>
        </a>
      `).join('')}
    </div>
  `).join('');

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar__brand">
        <span class="logo-mark">D3</span>
        <span>Deslizadores 3D</span>
      </div>
      <nav class="sidebar__nav">${groupsHtml}</nav>
      <div class="sidebar__footer">
        <button class="btn btn--ghost btn--sm" style="width:100%; justify-content:center;" id="logoutBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Cerrar sesión
        </button>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebarOverlay"></div>
  `;
}

export function renderTopbar({ title, breadcrumb = '', actions = '' }) {
  return `
    <header class="topbar">
      <div style="display:flex; align-items:center; gap:12px;">
        <button class="menu-toggle" id="menuToggle" aria-label="Menú">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div class="topbar__title">
          ${breadcrumb ? `<div class="breadcrumb">${breadcrumb}</div>` : ''}
          <h1>${title}</h1>
        </div>
      </div>
      <div class="topbar__actions" style="display:flex;align-items:center;gap:16px;">
        ${actions}
        <div id="topbar-clock" style="text-align:right;line-height:1.25;">
          <div id="clock-date" style="font-size:.7rem;color:var(--text-muted);text-transform:capitalize;"></div>
          <div id="clock-time" style="font-size:.95rem;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:.04em;"></div>
        </div>
        <button class="theme-toggle" data-theme-toggle aria-label="Cambiar tema"></button>
      </div>
    </header>
  `;
}

const DIAS_SEMANA = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function startClock() {
  function tick() {
    const now = new Date();
    const dateEl = document.getElementById('clock-date');
    const timeEl = document.getElementById('clock-time');
    if (!dateEl || !timeEl) return;
    dateEl.textContent = DIAS_SEMANA[now.getDay()] + ' ' + now.getDate() + ' ' + MESES_CORTO[now.getMonth()] + '. ' + now.getFullYear();
    timeEl.textContent = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0');
  }
  tick();
  clearInterval(window._clockInterval);
  window._clockInterval = setInterval(tick, 1000);
}

/** Monta el layout completo (sidebar + topbar) en un contenedor con id="app". */
export function mountLayout({ activeHref, title, breadcrumb, actions = '' } = {}) {
  const app = document.getElementById('app');
  if (!app) return;
  const main = app.innerHTML;
  app.innerHTML = `
    ${renderSidebar(activeHref)}
    ${renderTopbar({ title, breadcrumb, actions })}
    <main class="main">${main}</main>
  `;
  // Wire events
  document.getElementById('logoutBtn')?.addEventListener('click', signOut);
  startClock();
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  menuToggle?.addEventListener('click', () => {
    sidebar.classList.toggle('is-open');
    overlay.classList.toggle('is-visible');
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('is-open');
    overlay.classList.remove('is-visible');
  });
}
