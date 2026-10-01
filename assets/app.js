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
    // NAVBAR
    // ============================================
    async function carregarNavbar() {
        const navMenu = document.getElementById('navMenu');
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
                if (window.innerWidth <= 900) {
                    hamb.classList.remove('active');
                    navMenu.classList.remove('active');
                }
            });
        });

        document.addEventListener('click', e => {
            if (window.innerWidth <= 900
                && navMenu.classList.contains('active')
                && !navMenu.contains(e.target)
                && !hamb.contains(e.target)) {
                hamb.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });
    }

    // ============================================
    // IDIOMAS
    // ============================================
    async function carregarIdiomas() {
        const wrap = document.getElementById('languageDropdown');
        const dropdownContent = document.getElementById('dropdownContent');
        const currentLanguageSpan = document.getElementById('current-language');
        if (!wrap || !dropdownContent) return;

        const currentLang = getIdiomaAtual();

        try {
            const langData = await fetch('/lang.json?v=' + Date.now()).then(r => r.json());
            const ativos = Object.entries(langData).filter(([_, l]) => l.active !== false);

            // Só 1 idioma ativo → esconde o dropdown
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
    // TROCAR IDIOMA
    // ============================================
    function trocarIdioma(novoLang) {
        let base = location.pathname.replace(/\/(en|es)\/?$/, '/');
        if (!base.endsWith('/')) base += '/';

        if (novoLang === 'pt') {
            location.href = base;
        } else {
            location.href = base + novoLang;
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

    document.addEventListener('DOMContentLoaded', () => {
        carregarNavbar();
        carregarIdiomas();
        setupScroll();
    });
})();
