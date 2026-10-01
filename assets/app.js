(function () {
    'use strict';

    // NAVBAR
    async function carregarNavbar() {
        const navMenu = document.getElementById('navMenu');
        if (!navMenu) return;
        const currentLang = (document.documentElement.id || 'lang-pt').replace('lang-', '');
        try {
            const navData = await fetch('/navbar.json?v=' + Date.now()).then(r => r.json());
            const items = Array.isArray(navData) ? navData : (navData[currentLang] || []);
            if (!items || !items.length) {
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
            navMenu.innerHTML = '<li class="nav-item"><a href="/">Início</a></li>';
        }
    }

    // HAMBURGER
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

    // IDIOMAS
    async function carregarIdiomas() {
        const dropdownContent = document.getElementById('dropdownContent');
        const currentLanguageSpan = document.getElementById('current-language');
        if (!dropdownContent) return;
        const currentLang = (document.documentElement.id || 'lang-pt').replace('lang-', '');
        try {
            const langData = await fetch('/lang.json?v=' + Date.now()).then(r => r.json());
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
        } catch (e) { console.warn('Erro idiomas:', e); }
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

    // SCROLL
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
