(function () {
    'use strict';

    // ============================================
    // ESTADO GLOBAL
    // ============================================
    let __langCache = null;

    // ============================================
    // IDIOMA ATUAL — lê do <html id="lang-XX">
    // ============================================
    function getIdiomaAtual() {
        const id = document.documentElement.id || 'lang-pt';
        return id.replace('lang-', '');
    }

    // ============================================
    // NORMALIZA UM PREFIXO — aceita "", "/", "en", "/en", "en/", "/en/"
    // Retorna SEM barras: "" ou "en"
    // ============================================
    function limparPrefixo(valor) {
        if (!valor) return '';
        return String(valor).replace(/^\/+|\/+$/g, '');
    }

    // ============================================
    // LÊ O PREFIXO DO IDIOMA — aceita "url" OU "prefix"
    // ============================================
    function getPrefixoDoIdioma(lang) {
        const cfg = window.__langData?.[lang];
        if (!cfg) return '';
        return limparPrefixo(cfg.url ?? cfg.prefix ?? '');
    }

    // ============================================
    // NORMALIZA PATH PARA COMPARAÇÃO (lowercase, sem barra final, sem .html)
    // NÃO usar para reconstruir URL — só para comparar.
    // ============================================
    function normalizarPath(path) {
        if (!path) return '/';

        let p = String(path);

        try {
            if (/^https?:\/\//i.test(p)) {
                p = new URL(p).pathname;
            }
        } catch (_) { /* mantém como está */ }

        return p
            .replace(/\.html$/i, '')
            .replace(/\/+$/, '')
            .toLowerCase() || '/';
    }

    // ============================================
    // EXTRAI PATHNAME CRU (preserva case), sem .html, sem barra final
    // ============================================
    function pathCru(path) {
        let p = String(path || '/');
        try {
            if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
        } catch (_) { /* mantém */ }
        p = p.replace(/\.html$/i, '').replace(/\/+$/, '');
        return p || '/';
    }

    // ============================================
    // COMPARA POR SEGMENTOS (evita "/personagens" casar com "/personagem")
    // ============================================
    function segmentos(path) {
        return normalizarPath(path).split('/').filter(Boolean);
    }

    function prefixoBate(segPre, segPath) {
        if (segPre.length > segPath.length) return false;
        for (let i = 0; i < segPre.length; i++) {
            if (segPre[i] !== segPath[i]) return false;
        }
        return true;
    }

    // ============================================
    // MATCH DE PADRÃO COM {slug}
    // - Template absoluto (http...) → nunca casa (é redirect externo)
    // - Template sem {slug} → match literal por segmentos
    // - Template com {slug} → match por segmentos + slug preservando case
    // ============================================
    function matchComSlug(template, path) {
        const t = String(template);

        // URLs absolutas não participam do roteamento interno
        if (/^https?:\/\//i.test(t)) return null;

        const pRaw = pathCru(path);
        const pSegs = segmentos(pRaw);

        if (!t.includes('{slug}')) {
            const tSegs = segmentos(t);
            if (tSegs.length !== pSegs.length) return null;
            for (let i = 0; i < tSegs.length; i++) {
                if (tSegs[i] !== pSegs[i]) return null;
            }
            return {};
        }

        const [pre, pos] = t.split('{slug}');
        const preSegs = segmentos(pre);
        const posSegs = segmentos(pos || '');

        // path precisa ter pelo menos 1 segmento (o slug) entre pre e pos
        if (pSegs.length < preSegs.length + posSegs.length + 1) return null;

        // prefixo
        if (!prefixoBate(preSegs, pSegs)) return null;

        // sufixo (compara de trás pra frente)
        const pathFim = pSegs.slice(pSegs.length - posSegs.length);
        for (let i = 0; i < posSegs.length; i++) {
            if (pathFim[i] !== posSegs[i]) return null;
        }

        // slug = segmento do meio (só 1 segmento é permitido)
        const meio = pSegs.slice(preSegs.length, pSegs.length - posSegs.length);
        if (meio.length !== 1) return null;

        // Extrai o slug do path CRU (preserva case e caracteres originais)
        // Percorre pRaw por segmentos para achar o mesmo índice.
        const pRawSegs = pRaw.split('/').filter(Boolean);
        // pRawSegs tem o mesmo tamanho que pSegs (mesma estrutura), então:
        const slugOriginal = pRawSegs[preSegs.length];

        if (!slugOriginal) return null;
        return { slug: slugOriginal };
    }

    // ============================================
    // CARREGA LANG.JSON (sempre da raiz)
    // ============================================
    async function carregarLangData() {
        if (__langCache) return __langCache;
        try {
            __langCache = await fetch('/lang.json?v=' + Date.now()).then(r => r.json());
            window.__langData = __langCache;
            return __langCache;
        } catch (e) {
            console.warn('Erro lang.json:', e);
            __langCache = {};
            window.__langData = {};
            return {};
        }
    }

    // ============================================
    // CARREGA KEYS.JSON
    // ============================================
    async function carregarKeysData() {
        if (window.__keysCache) return window.__keysCache;
        try {
            window.__keysCache = await fetch('/keys.json?v=' + Date.now()).then(r => r.json());
            return window.__keysCache;
        } catch (e) {
            console.warn('Erro keys.json:', e);
            window.__keysCache = {};
            return {};
        }
    }

    // ============================================
    // PREFIXO DO IDIOMA ATUAL — "" ou "en"
    // ============================================
    function getPrefixoLimpo() {
        return getPrefixoDoIdioma(getIdiomaAtual());
    }

    // ============================================
    // API GLOBAL
    // ============================================
    function exporAPI() {
        window.WikiAPI = {
            getIdioma: getIdiomaAtual,

            getPrefixoIdioma: getPrefixoLimpo,

            getTexto: (chave) => {
                const lang = getIdiomaAtual();
                return window.__langData?.[lang]?.wiki?.[chave] || '';
            },

            getLink: (chave) => {
                const lang = getIdiomaAtual();
                return window.__langData?.[lang]?.links?.[chave] || '';
            },

            montarUrl: (caminho) => {
                const p = getPrefixoLimpo();
                let base = caminho.startsWith('/') ? caminho : '/' + caminho;
                if (!base.endsWith('/')) base += '/';
                return p ? `/${p}${base}` : base;
            },

            normalizarPath,

            // Útil para debug
            matchComSlug
        };
    }

    // ============================================
    // RENDER HEADER
    // ============================================
    function renderHeader() {
        const el = document.querySelector('site-header');
        if (!el) return;
        el.innerHTML = `
            <nav class="navbar" id="navbar">
                <div class="nav-container">
                    <a href="/" class="logo">
                        <img src="" alt="" data-wiki="logo" style="height:36px;display:none">
                        <span data-wiki="nome">Laços Profanos</span>
                    </a>
                    <div class="language-dropdown" id="languageDropdown">
                        <button class="language-btn" id="languageBtn">
                            <i class="fas fa-globe"></i>
                            <span id="current-language">Português</span>
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="dropdown-content" id="dropdownContent"></div>
                    </div>
                    <ul class="nav-menu" id="navMenu"></ul>
                    <button class="hamburger" id="hamburger" aria-label="Menu">
                        <span></span><span></span><span></span>
                    </button>
                </div>
            </nav>
        `;
    }

    // ============================================
    // RENDER FOOTER
    // ============================================
    function renderFooter() {
        const el = document.querySelector('site-footer');
        if (!el) return;
        el.innerHTML = `
            <footer>
                <p>
                    <span data-wiki="nomeCompleto">Wiki Laços Profanos</span> —
                    <a href="#" data-wiki="contribua" data-wiki-link="contribua">Contribua</a>
                </p>
            </footer>
        `;
    }

    // ============================================
    // NORMALIZAR TEXTOS, LINKS, LANG E DIR
    // ============================================
    async function normalizar() {
        const lang = getIdiomaAtual();

        document.documentElement.setAttribute('lang', lang);
        const rtlLangs = ['ar', 'he', 'fa', 'ur'];
        document.documentElement.setAttribute('dir', rtlLangs.includes(lang) ? 'rtl' : 'ltr');

        const cfg = window.__langData?.[lang];
        if (!cfg) return;

        if (cfg.wiki) {
            document.querySelectorAll('[data-wiki]').forEach(el => {
                const chave = el.dataset.wiki;
                const valor = cfg.wiki[chave];
                if (valor === undefined) return;
                if (el.tagName === 'IMG') {
                    el.src = valor;
                    el.style.display = '';
                } else if (el.tagName === 'A' && el.querySelector('img')) {
                    el.querySelector('img').src = valor;
                } else {
                    el.textContent = valor;
                }
            });
        }

        if (cfg.links) {
            document.querySelectorAll('[data-wiki-link]').forEach(el => {
                const chave = el.dataset.wikiLink;
                const valor = cfg.links[chave];
                if (valor === undefined) return;
                el.href = valor;
            });
        }

        const titleEl = document.querySelector('title[data-wiki-title]');
        if (titleEl && cfg.wiki?.nomeCompleto) {
            titleEl.textContent = `${titleEl.dataset.wikiTitle} — ${cfg.wiki.nomeCompleto}`;
        }
    }

    // ============================================
    // NAVBAR
    // ============================================
    async function carregarNavbar() {
        const navMenu = document.getElementById('navMenu');
        const navbar = document.getElementById('navbar');
        if (!navMenu) return;

        const currentLang = getIdiomaAtual();

        try {
            const navData = await fetch('/navbar.json?v=' + Date.now()).then(r => r.json());
            const items = (navData[currentLang] || navData['pt'] || [])
                .filter(item => item.active !== false);

            if (!items.length) { navMenu.innerHTML = ''; return; }

            const pathAtual = normalizarPath(location.pathname);
            const host = location.host;

            navMenu.innerHTML = items.map(item => {
                let ativo = false;
                try {
                    const url = new URL(item.link, location.origin);
                    ativo = url.host === host && normalizarPath(url.pathname) === pathAtual;
                } catch (_) {
                    ativo = normalizarPath(item.link) === pathAtual;
                }
                const classe = ativo ? 'disabled' : '';
                return `<li class="nav-item">
                    <a href="${item.link}" class="${classe}">
                        <i class="fas ${item.icon || 'fa-link'}"></i>
                        ${item.label}
                    </a>
                </li>`;
            }).join('');

            if (navbar) {
                navbar.classList.toggle('force-hamburger', items.length > 6);
            }

            setupHamburger();
        } catch (e) {
            console.warn('Erro navbar:', e);
            navMenu.innerHTML = '';
        }
    }

    // ============================================
    // HAMBURGER
    // ============================================
    function setupHamburger() {
        const hamburger = document.getElementById('hamburger');
        const navMenu = document.getElementById('navMenu');
        if (!hamburger || !navMenu) return;

        const novo = hamburger.cloneNode(true);
        hamburger.parentNode.replaceChild(novo, hamburger);
        const hamb = document.getElementById('hamburger');

        hamb.addEventListener('click', e => {
            e.stopPropagation();
            hamb.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        navMenu.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', () => {
                const navbar = document.getElementById('navbar');
                const forcado = navbar && navbar.classList.contains('force-hamburger');
                if (window.innerWidth <= 900 || forcado) {
                    hamb.classList.remove('active');
                    navMenu.classList.remove('active');
                }
            });
        });

        document.addEventListener('click', e => {
            const navbar = document.getElementById('navbar');
            const forcado = navbar && navbar.classList.contains('force-hamburger');
            const mobile = window.innerWidth <= 900;

            if ((mobile || forcado)
                && navMenu.classList.contains('active')
                && !navMenu.contains(e.target)
                && !hamb.contains(e.target)) {
                hamb.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });
    }

    // ============================================
    // IDIOMAS — DROPDOWN
    // ============================================
    async function carregarIdiomas() {
        const wrap = document.getElementById('languageDropdown');
        const dropdownContent = document.getElementById('dropdownContent');
        const currentLanguageSpan = document.getElementById('current-language');
        if (!wrap || !dropdownContent) return;

        const currentLang = getIdiomaAtual();

        try {
            const langData = await carregarLangData();
            const ativos = Object.entries(langData).filter(([_, l]) => l.active !== false);

            if (ativos.length <= 1) {
                wrap.style.display = 'none';
                return;
            }

            dropdownContent.innerHTML = ativos.map(([key, lang]) => {
                const isCurrent = key === currentLang;
                const check = isCurrent ? '<i class="fas fa-check"></i> ' : '';
                const classe = isCurrent ? 'active' : '';
                return `<a href="#" class="language-option ${classe}" data-lang="${key}">
                    ${check}${lang.name}
                </a>`;
            }).join('');

            if (currentLanguageSpan && langData[currentLang]) {
                currentLanguageSpan.textContent = langData[currentLang].name;
            }

            dropdownContent.querySelectorAll('a').forEach(a => {
                a.addEventListener('click', async e => {
                    e.preventDefault();
                    await trocarIdioma(a.dataset.lang);
                });
            });

            const btn = document.getElementById('languageBtn');
            btn.addEventListener('click', e => {
                e.stopPropagation();
                dropdownContent.classList.toggle('show');
            });

            document.addEventListener('click', e => {
                if (!e.target.closest('.language-dropdown')) {
                    dropdownContent.classList.remove('show');
                }
            });
        } catch (e) {
            console.warn('Erro idiomas:', e);
            wrap.style.display = 'none';
        }
    }

    // ============================================
    // ORDENA CHAVES DO KEYS.JSON PARA MATCH
    // 1. literais (sem {slug}) primeiro
    // 2. entre literais, mais específicos (mais longos) primeiro
    // 3. templates com {slug} por último
    // Templates absolutos (http...) vão pro fim e não casam.
    // ============================================
    function ordenarChaves(keys, langAtual) {
        return Object.keys(keys).sort((a, b) => {
            const va = String(keys[a]?.[langAtual] ?? '');
            const vb = String(keys[b]?.[langAtual] ?? '');
            const absA = /^https?:\/\//i.test(va) ? 1 : 0;
            const absB = /^https?:\/\//i.test(vb) ? 1 : 0;
            if (absA !== absB) return absA - absB;

            const tplA = va.includes('{slug}') ? 1 : 0;
            const tplB = vb.includes('{slug}') ? 1 : 0;
            if (tplA !== tplB) return tplA - tplB;

            // literais: mais longos primeiro (mais específicos)
            // templates: também por comprimento, mas em geral empatam
            return vb.length - va.length;
        });
    }

    // ============================================
    // TROCAR IDIOMA
    // 1. keys.json literal → match literal por segmentos
    // 2. keys.json com {slug} → match por padrão (conteúdo)
    // 3. fallback → só troca o prefixo
    // ============================================
    async function trocarIdioma(novoLang) {
        const langData = window.__langData || {};
        const langAtual = getIdiomaAtual();
        const pathAtual = location.pathname;

        try {
            const keys = await carregarKeysData();
            const chaves = ordenarChaves(keys, langAtual);

            for (const key of chaves) {
                const entry = keys[key];
                if (!entry || !entry[langAtual]) continue;

                const m = matchComSlug(entry[langAtual], pathAtual);
                if (!m) continue;

                const alvo = entry[novoLang];
                if (!alvo) continue;

                // Destino absoluto (http...) → vai direto
                const destino = alvo.includes('{slug}')
                    ? alvo.replace('{slug}', m.slug)
                    : alvo;

                __langCache = null;
                window.__langCache = null;
                window.__langData = null;
                window.__langReady = null;

                location.href = destino;
                return;
            }
        } catch (e) {
            console.warn('Erro ao consultar keys.json:', e);
        }

        // FALLBACK — só troca o prefixo (páginas fora do keys.json)
        const prefixos = Object.keys(langData)
            .map(k => getPrefixoDoIdioma(k))
            .filter(Boolean);

        let path = location.pathname;
        for (const p of prefixos) {
            const alvo = '/' + p + '/';
            if (path === alvo || path.startsWith(alvo)) {
                path = path.slice(alvo.length - 1);
                if (!path.startsWith('/')) path = '/' + path;
                break;
            }
        }

        const novoPrefixo = getPrefixoDoIdioma(novoLang);
        const destino = novoPrefixo ? `/${novoPrefixo}${path}` : path;

        __langCache = null;
        window.__langCache = null;
        window.__langData = null;
        window.__langReady = null;

        location.href = destino;
    }

    // ============================================
    // SCROLL
    // ============================================
    function setupScroll() {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;
        const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 30);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    // ============================================
    // PRECONNECT DINÂMICO
    // ============================================
    const __hostsPreconectados = new Set();

    function preconnectHost(url) {
        try {
            const u = new URL(url, location.href);
            if (!/^https?:$/.test(u.protocol)) return;
            if (u.origin === location.origin) return;
            if (__hostsPreconectados.has(u.origin)) return;
            __hostsPreconectados.add(u.origin);

            const l1 = document.createElement('link');
            l1.rel = 'preconnect';
            l1.href = u.origin;
            l1.crossOrigin = 'anonymous';
            document.head.appendChild(l1);

            const l2 = document.createElement('link');
            l2.rel = 'dns-prefetch';
            l2.href = u.origin;
            document.head.appendChild(l2);
        } catch { /* ignora */ }
    }

    function preconnectDeConteudo(dados) {
        const urls = [];

        if (typeof dados === 'string') {
            const reMd = /!\[[^\]]*\]\(([^)]+)\)/g;
            const reHtml = /<img[^>]+src=["']([^"']+)["']/gi;
            let m;
            while ((m = reMd.exec(dados))) urls.push(m[1]);
            while ((m = reHtml.exec(dados))) urls.push(m[1]);
        } else if (dados && typeof dados === 'object') {
            const varrer = (obj, chave) => {
                if (!obj) return;
                if (typeof obj === 'string') {
                    if (/imagem|image|img|foto|photo|capa|cover|thumb|avatar|banner/i.test(chave || '') ||
                        /^https?:\/\/.+\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?.*)?$/i.test(obj)) {
                        urls.push(obj);
                    }
                    return;
                }
                if (Array.isArray(obj)) {
                    obj.forEach(v => varrer(v, chave));
                    return;
                }
                for (const k in obj) varrer(obj[k], k);
            };
            varrer(dados, '');
        }

        urls.forEach(preconnectHost);
    }

    window.preconnectHost = preconnectHost;
    window.preconnectDeConteudo = preconnectDeConteudo;

    // ============================================
    // INIT
    // ============================================
    document.addEventListener('DOMContentLoaded', async () => {
        renderHeader();
        renderFooter();

        exporAPI();

        window.__langReady = carregarLangData();
        await window.__langReady;

        await normalizar();
        carregarNavbar();
        carregarIdiomas();
        setupScroll();
    });
})();
