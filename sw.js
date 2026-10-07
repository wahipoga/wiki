/* =========================================================
   Service Worker — Wiki Laços Profanos
   Cache de imagens externas (Imgur, placehold.co, etc.)
   + JSONs locais, com TTL e stale-while-revalidate
   ========================================================= */

const CACHE_NAME = 'lacos-cache-v1';

// TTLs por tipo de recurso
const TTL_IMAGEM = 24 * 60 * 60 * 1000; // 24h — imagens mudam pouco
const TTL_JSON   = 60 * 1000;            // 1min — JSONs são pequenos e leves

// Hosts externos de imagem que devem ser cacheados
const HOSTS_IMAGEM = [
  'i.imgur.com',
  'placehold.co',
  // adicione outros se usar: 'cdn.discordapp.com', 'images.unsplash.com', ...
];

const EXT_IMG = /\.(png|jpe?g|gif|webp|svg|avif|ico|bmp)(\?.*)?$/i;

/* ---------- classificação de requisições ---------- */
function classificar(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;

  // Imagem de host conhecido → cacheia com TTL longo
  if (HOSTS_IMAGEM.some(h => u.hostname === h || u.hostname.endsWith('.' + h))) {
    return { tipo: 'imagem', ttl: TTL_IMAGEM };
  }
  // Qualquer URL terminando em extensão de imagem → também cacheia
  if (EXT_IMG.test(u.pathname)) {
    return { tipo: 'imagem', ttl: TTL_IMAGEM };
  }
  // JSON do próprio domínio → cacheia com TTL curto
  if (u.origin === self.location.origin && u.pathname.endsWith('.json')) {
    return { tipo: 'json', ttl: TTL_JSON };
  }
  return null;
}

/* ---------- ciclo de vida ---------- */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // limpa caches de versões antigas
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

  const info = classificar(req.url);
  if (!info) return;

  event.respondWith(responder(req, info));
});

/* ---------- lógica principal ---------- */
async function responder(req, info) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);

  if (cached) {
    const quando = Number(cached.headers.get('x-cached-at') || 0);
    const idade = Date.now() - quando;

    if (idade < info.ttl) {
      // fresco → serve direto
      return cached;
    }
    // expirado → devolve o antigo já e revalida em background
    revalidar(cache, req).catch(() => {});
    return cached;
  }

  // não tem no cache → busca da rede
  try {
    const resp = await fetch(req, { mode: 'cors', credentials: 'omit' });
    if (resp && (resp.ok || resp.type === 'opaque')) {
      const clone = await comTimestamp(resp);
      cache.put(req, clone.clone());
      return clone;
    }
    return resp;
  } catch (err) {
    // rede falhou → tenta cache expirado como fallback offline
    const velho = await cache.match(req);
    if (velho) return velho;
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function revalidar(cache, req) {
  try {
    const resp = await fetch(req, { mode: 'cors', credentials: 'omit' });
    if (resp && (resp.ok || resp.type === 'opaque')) {
      const clone = await comTimestamp(resp);
      await cache.put(req, clone);
    }
  } catch { /* silencioso */ }
}

/* ---------- utilitário: adiciona header x-cached-at ---------- */
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
