(function () {
    'use strict';

    // ============================================
    // NAVBAR — carrega navbar.json e monta o menu
    // ============================================
    async function carregarNavbar() {
        const navMenu = document.getElementById('navMenu');
        if (!navMenu) return;

        const htmlEl = document.documentElement;
        const langId = htmlEl.id || 'lang-pt';
        const currentLang = langId.replace('lang-', '');

        try {
            const navData = await fetch('/navbar.json?v=' + Date.now()).then(r => r.json());

            // Se navbar.json for um objeto com chaves de idioma
            // (ex: { "pt": [...], "en": [...] }) pega o do idioma atual
            const items = Array.isArray(navData) ? navData : (navData[currentLang] || []);

            if (!items || items.length === 0) {
                navMenu.innerHTML = '<li class="nav-item"><a href="/">Início</a></li>';
                return;
            }

            const path = location.pathname;
            navMenu.innerHTML = items.map(item => {
                const ativo = path === item.link || (item.link !== '/' && path.startsWith(item.link));
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
            console.warn('Erro ao carregar navbar:', e);
            navMenu.innerHTML = '<li class="nav-item"><a href="/">Início</a></li>';
        }
    }

    // ============================================
    // HAMBURGER — abre/fecha menu mobile
    // ============================================
    function setupHamburger() {
        const hamburger = document.getElementById('hamburger');
        const navMenu = document.getElementById('navMenu');
        if (!hamburger || !navMenu) return;

        // Evita duplicar listeners
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
    // IDIOMA — carrega lang.json
    // ============================================
    async function carregarIdiomas() {
        const dropdownContent = document.getElementById('dropdownContent');
        const currentLanguageSpan = document.getElementById('current-language');
        if (!dropdownContent) return;

        const htmlEl = document.documentElement;
        const langId = htmlEl.id || 'lang-pt';
        const currentLang = langId.replace('lang-', '');

        try {
            const langData = await fetch('/lang.json?v=' + Date.now()).then(r => r.json());

            // Espera formato: { "pt": { name, url, active }, "en": {...} }
            const entries = Object.entries(langData);

            dropdownContent.innerHTML = entries.map(([key, lang]) => {
                const isCurrent = key === currentLang;
                const checkIcon = isCurrent ? '<i class="fas fa-check"></i> ' : '';
                const classe = isCurrent ? 'active' : '';
                return `<a href="${lang.url}" class="language-option ${classe}" data-lang="${key}">
                    ${checkIcon}${lang.name}
                </a>`;
            }).join('');

            if (currentLanguageSpan && langData[currentLang]) {
                currentLanguageSpan.textContent = langData[currentLang].name;
            }
        } catch (e) {
            console.warn('Erro ao carregar idiomas:', e);
        }

        // Toggle dropdown
        const btn = document.getElementById('languageBtn');
        if (btn) {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                dropdownContent.classList.toggle('show');
            });

            document.addEventListener('click', e => {
                if (!e.target.closest('.language-dropdown')) {
                    dropdownContent.classList.remove('show');
                }
            });
        }
    }

    // ============================================
    // BUSCA NA NAVBAR — digita + Enter → busca.html?q=...
    // ============================================
    function setupBusca() {
        const input = document.getElementById('navBusca');
        if (!input) return;

        // Se está na busca.html, pré-preenche com ?q=
        if (location.pathname.endsWith('/busca.html')) {
            const q = new URLSearchParams(location.search).get('q') || '';
            input.value = q;
        }

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const termo = input.value.trim();
                if (termo.length < 2) return;
                location.href = '/busca.html?q=' + encodeURIComponent(termo);
            }
        });
    }

    // ============================================
    // NAVBAR SCROLL — borda mais forte ao rolar
    // ============================================
    function setupScroll() {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;

        const onScroll = () => {
            navbar.classList.toggle('scrolled', window.scrollY > 30);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    document.addEventListener('DOMContentLoaded', () => {
        carregarNavbar();
        carregarIdiomas();
        setupBusca();
        setupScroll();
    });
})();
