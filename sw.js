/* =========================================================
   Service Worker — Wiki Laços Profanos
   Cache universal de imagens externas + JSONs do site
   ========================================================= */

const CACHE_NAME = 'lacos-cache-v4'; // ⚠️ v4 → limpa cache antigo

const TTL_IMAGEM = 24 * 60 * 60 * 1000; // 24h
const TTL_JSON   = 60 * 1000;            // 1min

// Extensões reconhecidas como imagem (fallback quando o host não manda Content-Type)
const EXT_IMG = /\.(png|jpe?g|gif|webp|svg|avif|ico|bmp|tiff?)(\?.*)?$/i;

/* ---------- classificação ---------- */
function classificar(req) {
  let u;
  try { u = new URL(req.url); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;

  const mesmoDominio = u.origin === self.location.origin;

  // 1. JSON do próprio domínio → cacheia com TTL curto
  if (mesmoDominio && u.pathname.endsWith('.json')) {
    return { tipo: 'json', ttl: TTL_JSON };
  }

  // 2. Qualquer coisa que PAREÇA imagem (por extensão) → cacheia
  //    Cobre i.imgur.com, cdn.imgchest.com, images.unsplash.com, etc.
  if (EXT_IMG.test(u.pathname)) {
    return { tipo: 'imagem', ttl: TTL_IMAGEM };
  }

  // 3. URLs externas sem extensão clara (ex: Unsplash com ?w=800)
  //    → também cacheia como imagem, mas só se for externo.
  //    O Content-Type da resposta vai confirmar depois.
  if (!mesmoDominio && req.destination === 'image') {
    return { tipo: 'imagem', ttl: TTL_IMAGEM };
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
    revalidar(cache, req).catch(() => {});
    return cached;
  }

  try {
    // ⚠️ NUNCA força mode/credentials — herda da request original
    // (é isso que faz hosts sem CORS funcionarem)
    const resp = await fetch(req);
    if (!resp) return resp;

    // Confirma que é imagem antes de guardar (quando dá pra ler o header)
    const ct = resp.headers.get('Content-Type') || '';
    const pareceImagem = info.tipo === 'imagem' && (
      ct.startsWith('image/') ||
      resp.type === 'opaque' // não dá pra ler header, confia na extensão
    );

    if (resp.ok || resp.type === 'opaque') {
      // Só cacheia se for imagem ou se for JSON (evita guardar HTML por engano)
      if (info.tipo === 'json' || pareceImagem) {
        const clone = await comTimestamp(resp);
        cache.put(req, clone.clone());
        return clone;
      }
    }
    return resp;
  } catch (err) {
    const velho = await cache.match(req);
    if (velho) return velho;
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function revalidar(cache, req) {
  try {
    const resp = await fetch(req);
    if (!resp) return;
    if (resp.ok || resp.type === 'opaque') {
      const ct = resp.headers.get('Content-Type') || '';
      if (ct.startsWith('image/') || resp.type === 'opaque' || req.url.endsWith('.json')) {
        const clone = await comTimestamp(resp);
        await cache.put(req, clone);
      }
    }
  } catch { /* silencioso */ }
}

/* ---------- utilitário ---------- */
async function comTimestamp(resp) {
  const blob = await resp.blob();
  const headers = new Headers();
  for (const [k, v] of resp.headers.entries()) {
    try { headers.set(k, v); } catch {}
  }
  headers.set('x-cached-at', String(Date.now()));
  if (!headers.get('Content-Type') && blob.type) {
    headers.set('Content-Type', blob.type);
  }
  return new Response(blob, {
    status: resp.status === 0 ? 200 : resp.status,
    statusText: resp.statusText || 'OK',
    headers,
  });
}