// ============================================================================
// CLOUDFLARE WORKER — Deslizadores 3D API
// ----------------------------------------------------------------------------
// Responsabilidades:
//   1. OAuth de Mercado Libre (intercambio de código, refresh de tokens)
//   2. Sincronización de órdenes desde ML hacia Supabase
//   3. Actualización diaria de cotización USD (cron)
//
// Variables de entorno requeridas (wrangler secret put):
//   - ML_CLIENT_ID
//   - ML_CLIENT_SECRET
//   - ML_REDIRECT_URI  (ej: https://deslizadores-api.tu.workers.dev/api/ml/oauth/callback)
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY  (CUIDADO: clave con permisos completos, solo en Worker)
//   - APP_FRONTEND_URL  (ej: https://deslizadores3d.pages.dev)
// ============================================================================

const ML_AUTH_URL  = 'https://auth.mercadolibre.com.ar/authorization';
const ML_TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const ML_API       = 'https://api.mercadolibre.com';

// CORS helper
function cors(env, origin) {
  const allowed = env.APP_FRONTEND_URL || '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data, init = {}, env) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...cors(env), ...(init.headers || {}) },
  });
}

// ----------------------------------------------------------------------------
// Helper: petición a Supabase (vía REST con service_role)
// ----------------------------------------------------------------------------
async function sb(env, path, opts = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`);
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// ----------------------------------------------------------------------------
// OAUTH FLOW
// ----------------------------------------------------------------------------

/** GET /api/ml/oauth/start?user_id=... → redirige a ML */
function mlOAuthStart(req, env) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('user_id');
  if (!userId) return new Response('user_id requerido', { status: 400 });

  const auth = new URL(ML_AUTH_URL);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('client_id', env.ML_CLIENT_ID);
  auth.searchParams.set('redirect_uri', env.ML_REDIRECT_URI);
  auth.searchParams.set('state', userId); // pasamos user_id como state
  return Response.redirect(auth.toString(), 302);
}

/** GET /api/ml/oauth/callback?code=...&state=... */
async function mlOAuthCallback(req, env) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const userId = url.searchParams.get('state');
  if (!code || !userId) return new Response('Parámetros faltantes', { status: 400 });

  // Intercambiar código por tokens
  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('client_id', env.ML_CLIENT_ID);
  params.append('client_secret', env.ML_CLIENT_SECRET);
  params.append('code', code);
  params.append('redirect_uri', env.ML_REDIRECT_URI);

  const tokenRes = await fetch(ML_TOKEN_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: params.toString(),
  });

  const tokenText = await tokenRes.text();
  if (!tokenRes.ok) {
    return new Response(`Error obteniendo token [${tokenRes.status}]: ${tokenText}`, { status: 500 });
  }
  let tok;
  try { tok = JSON.parse(tokenText); }
  catch(e) { return new Response(`Respuesta inválida de ML: ${tokenText}`, { status: 500 }); }
  const expiresAt = new Date(Date.now() + (tok.expires_in || 21600) * 1000).toISOString();

  // Guardar en Supabase (upsert)
  await sb(env, '/ml_integracion', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      ml_user_id: String(tok.user_id),
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: expiresAt,
      scope: tok.scope,
      updated_at: new Date().toISOString(),
    }),
  });

  // Redirigir al frontend con éxito
  return Response.redirect(`${env.APP_FRONTEND_URL}/app/configuracion.html?ml=connected`, 302);
}

/** Renueva el access_token usando refresh_token. */
async function refreshMlToken(env, integ) {
  const res = await fetch(ML_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.ML_CLIENT_ID,
      client_secret: env.ML_CLIENT_SECRET,
      refresh_token: integ.refresh_token,
    }),
  });
  if (!res.ok) throw new Error('Refresh ML failed: ' + await res.text());
  const tok = await res.json();
  const updated = {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  await sb(env, `/ml_integracion?user_id=eq.${integ.user_id}`, {
    method: 'PATCH',
    body: JSON.stringify(updated),
  });
  return { ...integ, ...updated };
}

async function getValidIntegration(env, userId) {
  const [integ] = await sb(env, `/ml_integracion?user_id=eq.${userId}`);
  if (!integ) throw new Error('Sin integración ML para este usuario');
  if (new Date(integ.expires_at) <= new Date(Date.now() + 60000)) {
    return await refreshMlToken(env, integ);
  }
  return integ;
}

// ----------------------------------------------------------------------------
// SYNC DE ÓRDENES
// ----------------------------------------------------------------------------

/** POST /api/ml/sync?user_id=... */
async function mlSync(req, env) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('user_id');
  if (!userId) return json({ error: 'user_id requerido' }, { status: 400 }, env);

  try {
    const integ = await getValidIntegration(env, userId);
    const sellerId = integ.ml_user_id;

    // Traer órdenes recientes (últimos 30 días)
    const desde = new Date();
    desde.setDate(desde.getDate() - 30);
    const dFrom = desde.toISOString();

    let offset = 0;
    const limit = 50;
    let totalProcesados = 0;

    while (true) {
      const ordersUrl = `${ML_API}/orders/search?seller=${sellerId}&order.date_created.from=${dFrom}&offset=${offset}&limit=${limit}&sort=date_desc`;
      const r = await fetch(ordersUrl, {
        headers: { Authorization: `Bearer ${integ.access_token}` },
      });
      if (!r.ok) throw new Error('ML orders error ' + r.status);
      const payload = await r.json();
      const results = payload.results || [];
      if (!results.length) break;

      // Insertar/upsert en Supabase. RLS no aplica con service_role.
      const rows = results.map(o => ({
        user_id: userId,
        canal: 'mercadolibre',
        ml_order_id: String(o.id),
        ml_pack_id: o.pack_id ? String(o.pack_id) : null,
        fecha: (o.date_closed || o.date_created || '').slice(0, 10),
        cantidad: (o.order_items?.[0]?.quantity) || 1,
        precio_unitario: o.order_items?.[0]?.unit_price || 0,
        moneda: o.currency_id || 'ARS',
        comision_ml: o.order_items?.[0]?.sale_fee || 0,
        costo_envio: o.shipping?.cost || 0,
        comprador: o.buyer?.nickname || null,
        // producto_id queda null — el usuario debe linkear manualmente, o
        // se puede agregar lógica de matching por SKU/título.
      }));

      await sb(env, '/ventas', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });

      totalProcesados += rows.length;
      if (results.length < limit) break;
      offset += limit;
      if (offset > 1000) break; // safety
    }

    // Log de sincronización
    await sb(env, '/ml_sync_log', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId, tipo: 'ordenes', ok: true, procesados: totalProcesados,
      }),
    });
    await sb(env, `/ml_integracion?user_id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ultimo_sync_at: new Date().toISOString(),
        ultimo_sync_ok: true,
        ultimo_error: null,
      }),
    });

    return json({ ok: true, procesados: totalProcesados }, {}, env);
  } catch (err) {
    await sb(env, '/ml_sync_log', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, tipo: 'ordenes', ok: false, error: err.message }),
    }).catch(() => {});
    return json({ ok: false, error: err.message }, { status: 500 }, env);
  }
}

// ----------------------------------------------------------------------------
// COTIZACIÓN USD (cron + endpoint)
// ----------------------------------------------------------------------------

async function refreshCotizacion(env) {
  // dolarapi.com — endpoint público y estable
  const r = await fetch('https://dolarapi.com/v1/dolares');
  const arr = await r.json();
  const find = (casa) => arr.find(x => x.casa === casa);
  const oficial = find('oficial');
  const blue = find('blue');
  const mep = find('bolsa');
  const cripto = find('cripto');

  const today = new Date().toISOString().slice(0, 10);
  const row = {
    fecha: today,
    oficial_compra: oficial?.compra,
    oficial_venta: oficial?.venta,
    blue_compra: blue?.compra,
    blue_venta: blue?.venta,
    mep_venta: mep?.venta,
    cripto_venta: cripto?.venta,
    fuente: 'dolarapi.com',
    fetched_at: new Date().toISOString(),
  };

  await sb(env, '/cotizaciones_usd', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
  return row;
}

// ----------------------------------------------------------------------------
// ROUTER
// ----------------------------------------------------------------------------
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(env) });

    try {
      // ML OAuth
      if (url.pathname === '/api/ml/oauth/start')    return mlOAuthStart(req, env);
      if (url.pathname === '/api/ml/oauth/callback') return mlOAuthCallback(req, env);

      // ML Sync
      if (url.pathname === '/api/ml/sync')           return mlSync(req, env);

      // Cotización
      if (url.pathname === '/api/exchange-rate') {
        const row = await refreshCotizacion(env);
        return json(row, {}, env);
      }

      // Healthcheck
      if (url.pathname === '/api/health') return json({ ok: true, ts: Date.now() }, {}, env);

      return new Response('Not found', { status: 404 });
    } catch (err) {
      return json({ error: err.message }, { status: 500 }, env);
    }
  },

  // Cron trigger (configurado en wrangler.toml): actualiza cotización
  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshCotizacion(env).catch(err => console.error('cron cotización', err)));
  },
};
