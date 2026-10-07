(function () {
    'use strict';

    // ============================================
    // SERVICE WORKER — cache de imagens externas
    // ============================================
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register('/sw.js', { scope: '/' })
                .then(() => console.log('[SW] registrado'))
                .catch(err => console.warn('[SW] falhou:', err));
        });
    }

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
    // NORMALIZA PATH
    // ============================================
    function normalizarPath(path) {
        if (!path) return '/';
        return path
            .replace(/\.html$/, '')
            .replace(/\/$/, '')
            .toLowerCase() || '/';
    }

    // ============================================
    // CARREGA LANG.JSON
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
    // API GLOBAL — pro artigo.js e listar.js usarem
    // ============================================
    function exporAPI() {
        window.WikiAPI = {
            getIdioma: getIdiomaAtual,

            getPrefixoIdioma: () => {
                const lang = getIdiomaAtual();
                const url = window.__langData?.[lang]?.url || '/';
                if (url === '/' || url === '') return '';
                return url.replace(/\/$/, '');
            },

            getTexto: (chave) => {
                const lang = getIdiomaAtual();
                return window.__langData?.[lang]?.wiki?.[chave] || '';
            },

            getLink: (chave) => {
                const lang = getIdiomaAtual();
                return window.__langData?.[lang]?.links?.[chave] || '';
            },

            montarUrl: (caminho) => {
                const prefixo = window.WikiAPI.getPrefixoIdioma();
                let base = caminho.startsWith('/') ? caminho : '/' + caminho;
                if (!base.endsWith('/')) base += '/';
                return prefixo ? base.replace(/\/$/, '') + prefixo + '/' : base;
            },

            normalizarPath
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
                    <a href="/" class="logo" data-wiki="nome">Laços Profanos</a>
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
    // NORMALIZAR TEXTOS E LINKS
    // ============================================
    async function normalizar() {
        const lang = getIdiomaAtual();
        const cfg = window.__langData?.[lang];
        if (!cfg) return;

        if (cfg.wiki) {
            document.querySelectorAll('[data-wiki]').forEach(el => {
                const chave = el.dataset.wiki;
                const valor = cfg.wiki[chave];
                if (valor === undefined) return;
                if (el.tagName === 'IMG') {
                    el.src = valor;
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
                    const url = new URL(item.link);
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
                a.addEventListener('click', e => {
                    e.preventDefault();
                    trocarIdioma(a.dataset.lang);
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
    // TROCAR IDIOMA — dinâmico, qualquer idioma
    // ============================================
    function trocarIdioma(novoLang) {
        const langData = window.__langData || {};

        const prefixos = Object.values(langData)
            .map(l => l.url)
            .filter(u => u && u !== '/');

        let base = location.pathname;
        for (const p of prefixos) {
            const semBarra = p.replace(/\/$/, '');
            if (base.endsWith(p)) {
                base = base.slice(0, -p.length);
                break;
            }
            if (base.endsWith(semBarra)) {
                base = base.slice(0, -semBarra.length);
                break;
            }
        }
        if (!base.endsWith('/')) base += '/';

        const novoUrl = langData[novoLang]?.url || '/';
        if (novoUrl === '/' || novoUrl === '') {
            location.href = base;
        } else {
            const url = novoUrl.endsWith('/') ? novoUrl : novoUrl + '/';
            location.href = base.replace(/\/$/, '') + url;
        }
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
    // INIT
    // ============================================
    document.addEventListener('DOMContentLoaded', async () => {
        renderHeader();
        renderFooter();

        // Expõe a API ANTES do await, pra não dar race condition
        exporAPI();

        window.__langReady = carregarLangData();
        await window.__langReady;

        await normalizar();
        carregarNavbar();
        carregarIdiomas();
        setupScroll();
    });
})();
