import { requireAuth, getProfile } from '../core/auth.js';
import { mountLayout } from '../core/layout.js';
import { initTheme } from '../core/theme.js';
import { fmtDate, toast } from '../core/utils.js';
import { getIntegracion, iniciarOAuth, syncManual, desconectarML } from '../services/mercadolibre.js';

async function init() {
  initTheme();
  const session = await requireAuth();
  if (!session) return;
  document.getElementById('app').innerHTML = '';
  mountLayout({ activeHref: '/app/configuracion.html', title: 'Configuración', breadcrumb: 'Sistema' });

  const [perfil, integracion] = await Promise.all([
    getProfile().catch(() => null),
    getIntegracion().catch(() => null),
  ]);
  render(perfil, integracion, session);
}

function render(perfil, ml, session) {
  const main = document.querySelector('.main');
  if (!main) return;

  main.innerHTML = `
    <div style="max-width:700px;">
      <h2 style="margin:0 0 24px;">Configuración</h2>

      <!-- Cuenta -->
      <div class="card" style="margin-bottom:20px;">
        <h3 style="margin:0 0 16px;">Tu cuenta</h3>
        <p style="margin:0;color:var(--text-muted);">Email: <strong style="color:var(--text);">${session.user?.email ?? '—'}</strong></p>
        ${perfil?.full_name ? `<p style="margin:8px 0 0;color:var(--text-muted);">Nombre: <strong style="color:var(--text);">${perfil.full_name}</strong></p>` : ''}
        <p style="margin:8px 0 0;font-size:.8rem;color:var(--text-muted);">ID: ${session.user?.id?.slice(0, 8)}...</p>
      </div>

      <!-- Mercado Libre -->
      <div class="card" style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
          <div>
            <h3 style="margin:0 0 4px;">Mercado Libre</h3>
            <p style="margin:0;font-size:.85rem;color:var(--text-muted);">
              Sincroniza automáticamente tus ventas de ML al ERP.
            </p>
          </div>
          ${ml
            ? `<span class="badge" style="background:#e8f5e9;color:#2e7d32;">✓ Conectado</span>`
            : `<span class="badge" style="background:var(--bg-subtle);color:var(--text-muted);">Sin conectar</span>`}
        </div>

        ${ml ? `
          <div style="margin:16px 0;padding:16px;background:var(--bg-subtle);border-radius:8px;">
            <p style="margin:0 0 4px;font-size:.9rem;"><strong>Cuenta:</strong> ${ml.ml_nickname ?? 'Desconocido'}</p>
            <p style="margin:0 0 4px;font-size:.9rem;"><strong>Último sync:</strong> ${ml.last_sync_at ? fmtDate(ml.last_sync_at) : 'Nunca'}</p>
            <p style="margin:0;font-size:.85rem;color:var(--text-muted);">El sync automático corre cada 30 minutos.</p>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">
            <button class="btn btn--primary" id="btnSync">🔄 Sync manual ahora</button>
            <button class="btn btn--ghost" id="btnDesconectar" style="color:var(--danger,#e53935);">Desconectar cuenta</button>
          </div>` 
        : `
          <div style="margin:16px 0;padding:16px;background:var(--bg-subtle);border-radius:8px;font-size:.85rem;color:var(--text-muted);">
            <p style="margin:0 0 8px;">Al conectar, vas a ser redirigido a Mercado Libre para autorizar el acceso. Una vez autorizado:</p>
            <ul style="margin:0;padding-left:20px;">
              <li>Tus ventas se importan automáticamente cada 30 min</li>
              <li>Los pedidos ya pagados se registran como ventas en el ERP</li>
              <li>No se modifica nada en tu cuenta de ML</li>
            </ul>
          </div>
          <button class="btn btn--primary" id="btnConectar" style="margin-top:12px;">🔗 Conectar Mercado Libre</button>
        `}
      </div>

      <!-- Tema -->
      <div class="card" style="margin-bottom:20px;">
        <h3 style="margin:0 0 12px;">Apariencia</h3>
        <div style="display:flex;gap:10px;">
          <button class="btn btn--ghost" id="btnLight">☀️ Tema claro</button>
          <button class="btn btn--ghost" id="btnDark">🌙 Tema oscuro</button>
        </div>
      </div>

      <!-- Info técnica -->
      <div class="card">
        <h3 style="margin:0 0 12px;">Información del sistema</h3>
        <p style="margin:0 0 4px;font-size:.85rem;color:var(--text-muted);">Versión: <strong>1.0.0</strong></p>
        <p style="margin:0 0 4px;font-size:.85rem;color:var(--text-muted);">Base de datos: Supabase PostgreSQL</p>
        <p style="margin:0;font-size:.85rem;color:var(--text-muted);">Backend: Cloudflare Workers</p>
      </div>
    </div>
  `;

  // Eventos
  document.getElementById('btnConectar')?.addEventListener('click', async () => {
    toast('Redirigiendo a Mercado Libre...', 'info');
    await iniciarOAuth();
  });

  document.getElementById('btnSync')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnSync');
    btn.textContent = 'Sincronizando...';
    btn.disabled = true;
    try {
      const res = await syncManual();
      toast(`Sync completado: ${res.imported ?? 0} ventas importadas`);
    } catch (e) {
      toast('Error en sync: ' + e.message, 'error');
    } finally {
      btn.textContent = '🔄 Sync manual ahora';
      btn.disabled = false;
    }
  });

  document.getElementById('btnDesconectar')?.addEventListener('click', async () => {
    if (!confirm('¿Desconectar Mercado Libre? Las ventas ya importadas no se borran.')) return;
    try {
      await desconectarML(ml.id);
      toast('Cuenta desconectada');
      const mlActual = await getIntegracion().catch(() => null);
      render(perfil, mlActual, session);
    } catch (e) { toast(e.message, 'error'); }
  });

  document.getElementById('btnLight')?.addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('deslizadores3d_theme', 'light');
  });
  document.getElementById('btnDark')?.addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('deslizadores3d_theme', 'dark');
  });
}

init();
