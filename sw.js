/* =========================================================
   Service Worker — Wiki Laços Profanos
   Cache universal de imagens + JSONs do site
   Corrige Content-Type de imagens sem CORS (opaque)
   ========================================================= */

const CACHE_NAME = 'lacos-cache-v5'; // ⚠️ v5 → limpa cache antigo

const TTL_IMAGEM = 24 * 60 * 60 * 1000; // 24h
const TTL_JSON   = 60 * 1000;            // 1min

const EXT_IMG = /\.(png|jpe?g|gif|webp|svg|avif|ico|bmp|tiff?)(\?.*)?$/i;

// Mapa extensão → Content-Type (usado quando o host não manda header)
const MIME_POR_EXT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

function mimePorUrl(url) {
  const m = url.pathname.match(/\.([a-z0-9]+)$/i);
  if (!m) return null;
  return MIME_POR_EXT[m[1].toLowerCase()] || null;
}

/* ---------- classificação ---------- */
function classificar(req) {
  let u;
  try { u = new URL(req.url); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;

  const mesmoDominio = u.origin === self.location.origin;

  if (mesmoDominio && u.pathname.endsWith('.json')) {
    return { tipo: 'json', ttl: TTL_JSON };
  }
  if (EXT_IMG.test(u.pathname)) {
    return { tipo: 'imagem', ttl: TTL_IMAGEM, mime: mimePorUrl(u) };
  }
  if (!mesmoDominio && req.destination === 'image') {
    return { tipo: 'imagem', ttl: TTL_IMAGEM, mime: mimePorUrl(u) };
  }
  return null;
}

/* ---------- ciclo de vida ---------- */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(
      nomes
        .filter(n => n.startsWith('lacos-cache-') && n !== CACHE_NAME)
        .map(n => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

/* ---------- interceptação ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const info = classificar(req);
  if (!info) return;

  event.respondWith(responder(req, info));
});

/* ---------- lógica principal ---------- */
async function responder(req, info) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);

  if (cached) {
    const quando = Number(cached.headers.get('x-cached-at') || 0);
    if (Date.now() - quando < info.ttl) return cached;

    revalidar(cache, req, info).catch(() => {});
    return cached;
  }

  try {
    const resp = await fetch(req);
    if (!resp) return resp;

    if (resp.ok || resp.type === 'opaque') {
      const clone = await comTimestamp(resp, info);
      cache.put(req, clone.clone());
      return clone;
    }
    return resp;
  } catch (err) {
    const velho = await cache.match(req);
    if (velho) return velho;
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function revalidar(cache, req, info) {
  try {
    const resp = await fetch(req);
    if (!resp) return;
    if (resp.ok || resp.type === 'opaque') {
      const clone = await comTimestamp(resp, info);
      await cache.put(req, clone);
    }
  } catch { /* silencioso */ }
}

/* ---------- utilitário: SEMPRE define Content-Type ---------- */
async function comTimestamp(resp, info) {
  const blob = await resp.blob();

  const headers = new Headers();
  // Copia o que der pra copiar (em opaque, quase nada vem)
  for (const [k, v] of resp.headers.entries()) {
    try { headers.set(k, v); } catch {}
  }

  // 🔑 RESOLVE O BUG: se for imagem e não veio Content-Type, usa o da URL
  let ct = headers.get('Content-Type') || blob.type || '';
  if (!ct && info?.tipo === 'imagem') {
    ct = info.mime || 'image/jpeg'; // fallback seguro
  }
  if (ct) headers.set('Content-Type', ct);

  headers.set('x-cached-at', String(Date.now()));

  return new Response(blob, {
    status: resp.status === 0 ? 200 : resp.status,
    statusText: resp.statusText || 'OK',
    headers,
  });
}