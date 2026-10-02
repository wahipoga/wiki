(function () {
    'use strict';

    // ============================================
    // IDIOMA ATUAL — lê do <html id="lang-pt">
    // ============================================
    function getIdiomaAtual() {
        const id = document.documentElement.id || 'lang-pt';
        return id.replace('lang-', '');
    }

    // ============================================
    // NORMALIZA PATH — remove .html, barra final, minúsculas
    // ============================================
    function normalizar(path) {
        if (!path) return '/';
        return path
            .replace(/\.html$/, '')
            .replace(/\/$/, '')
            .toLowerCase() || '/';
    }

    // ============================================
    // CARREGA LANG.JSON (uma vez, guarda em cache)
    // ============================================
    let __langCache = null;

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
    // NORMALIZAR TEXTOS — nome, logo, contribua, título
    // ============================================
    async function normalizarTextos() {
        const lang = getIdiomaAtual();
        const langData = await carregarLangData();
        const cfg = langData[lang]?.wiki;
        if (!cfg) return;

        document.querySelectorAll('[data-wiki]').forEach(el => {
            const chave = el.dataset.wiki;
            const valor = cfg[chave];
            if (valor === undefined) return;

            if (el.tagName === 'IMG') {
                el.src = valor;
            } else if (el.tagName === 'A') {
                const img = el.querySelector('img');
                if (img) {
                    img.src = valor;
                } else {
                    el.textContent = valor;
                }
            } else {
                el.textContent = valor;
            }
        });

        const titleEl = document.querySelector('title[data-wiki-title]');
        if (titleEl) {
            titleEl.textContent = `${titleEl.dataset.wikiTitle} — ${cfg.nomeCompleto}`;
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

            const pathAtual = normalizar(location.pathname);
            const host = location.host;

            navMenu.innerHTML = items.map(item => {
                let ativo = false;
                try {
                    const url = new URL(item.link);
                    ativo = url.host === host && normalizar(url.pathname) === pathAtual;
                } catch (_) {
                    ativo = normalizar(item.link) === pathAtual;
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
                navbar.classList.toggle(
                    'force-hamburger',
                    items.length > 5
                );
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
    // TROCAR IDIOMA — usa prefix do lang.json
    // ============================================
    function trocarIdioma(novoLang) {
        const langData = window.__langData || {};
        const prefix = langData[novoLang]?.prefix ?? '';

        // remove prefixo antigo do path (ex.: /en, /es)
        let base = location.pathname.replace(/\/(en|es)\/?$/, '/');
        if (!base.endsWith('/')) base += '/';

        location.href = base + prefix.replace(/^\//, '');
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
        await normalizarTextos();
        carregarNavbar();
        carregarIdiomas();
        setupScroll();
    });
})();
