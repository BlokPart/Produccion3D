// ============================================================================
// CLOUDFLARE WORKER — Deslizadores 3D API
// ============================================================================

const ML_AUTH_URL  = 'https://auth.mercadolibre.com.ar/authorization';
const ML_TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const ML_API       = 'https://api.mercadolibre.com';

function cors(env) {
  return {
    'Access-Control-Allow-Origin': env.APP_FRONTEND_URL || '*',
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

// Helper Supabase — robusto ante body vacío
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

function mlOAuthStart(req, env) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('user_id');
  if (!userId) return new Response('user_id requerido', { status: 400 });

  const auth = new URL(ML_AUTH_URL);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('client_id', env.ML_CLIENT_ID);
  auth.searchParams.set('redirect_uri', env.ML_REDIRECT_URI);
  auth.searchParams.set('state', userId);
  return Response.redirect(auth.toString(), 302);
}

async function mlOAuthCallback(req, env) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const userId = url.searchParams.get('state');
  if (!code || !userId) return new Response('Parámetros faltantes', { status: 400 });

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

  await sb(env, '/ml_integracion', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      ml_user_id: String(tok.user_id),
      ml_nickname: tok.nickname || null,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: expiresAt,
      scope: tok.scope || null,
      updated_at: new Date().toISOString(),
    }),
  });

  return Response.redirect(`${env.APP_FRONTEND_URL}/app/configuracion.html?ml=connected`, 302);
}

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
  const data = await sb(env, `/ml_integracion?user_id=eq.${userId}`);
  const integ = Array.isArray(data) ? data[0] : data;
  if (!integ) throw new Error('Sin integración ML para este usuario');
  if (new Date(integ.expires_at) <= new Date(Date.now() + 60000)) {
    return await refreshMlToken(env, integ);
  }
  return integ;
}

// ----------------------------------------------------------------------------
// SYNC DE ÓRDENES
// ----------------------------------------------------------------------------

async function mlSync(req, env) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('user_id');
  if (!userId) return json({ error: 'user_id requerido' }, { status: 400 }, env);

  try {
    const integ = await getValidIntegration(env, userId);
    const sellerId = integ.ml_user_id;

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

      const rows = results.map(o => {
        const item = o.order_items?.[0];
        const saleFee = item?.sale_fee || 0;
        return {
          user_id: userId,
          canal: 'mercadolibre',
          ml_order_id: String(o.id),
          ml_pack_id: o.pack_id ? String(o.pack_id) : null,
          fecha: (o.date_closed || o.date_created || '').slice(0, 10),
          cantidad: item?.quantity || 1,
          precio_unitario_ars: item?.unit_price || 0,
          descuento_ars: saleFee,
          descuento_ml_ars: saleFee,
          descuento_iibb_ars: 0,
          descuento_otros_ars: 0,
          moneda: o.currency_id || 'ARS',
          comision_ml: saleFee,
          costo_envio: o.shipping?.cost || 0,
          comprador: o.buyer?.nickname || null,
          cliente_nombre: o.buyer?.nickname || null,
          costo_total_snapshot: 0,
          notas: item?.item?.title || null,
        };
      });

      await sb(env, '/ventas', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });

      totalProcesados += rows.length;
      if (results.length < limit) break;
      offset += limit;
      if (offset > 1000) break;
    }

    // Actualizar estado de integración
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
    await sb(env, `/ml_integracion?user_id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ultimo_sync_ok: false, ultimo_error: err.message }),
    }).catch(() => {});
    return json({ ok: false, error: err.message }, { status: 500 }, env);
  }
}

// ----------------------------------------------------------------------------
// COTIZACIÓN USD
// ----------------------------------------------------------------------------

async function refreshCotizacion(env) {
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
    tipo: 'blue',
    valor_ars: blue?.venta || oficial?.venta || 0,
    fuente: 'dolarapi.com',
  };

  await sb(env, '/cotizaciones_usd', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
  return { oficial, blue, mep, cripto };
}

// ----------------------------------------------------------------------------
// ROUTER
// ----------------------------------------------------------------------------
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(env) });

    try {
      if (url.pathname === '/api/ml/oauth/start')    return mlOAuthStart(req, env);
      if (url.pathname === '/api/ml/oauth/callback') return mlOAuthCallback(req, env);
      if (url.pathname === '/api/ml/sync')           return mlSync(req, env);
      if (url.pathname === '/api/exchange-rate') {
        const row = await refreshCotizacion(env);
        return json(row, {}, env);
      }
      if (url.pathname === '/api/health') return json({ ok: true, ts: Date.now() }, {}, env);
      return new Response('Not found', { status: 404 });
    } catch (err) {
      return json({ error: err.message }, { status: 500 }, env);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshCotizacion(env).catch(err => console.error('cron cotización', err)));
  },
};
