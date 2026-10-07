(function () {
    'use strict';

    // Espera:
    //   window.CATEGORIA_SLUG = "personagem"
    //   window.CATEGORIA_JSON = "/personagem/personagens.json"

    let artigos = [];
    let ordem = 'padrao';

    async function carregar() {
        const grid = document.getElementById('artigosGrid');
        if (!grid) return;

        if (window.__langReady) await window.__langReady;

        try {
            const lista = await fetch(window.CATEGORIA_JSON + '?v=' + Date.now())
                .then(r => r.json());

            const slugs = Array.isArray(lista) ? lista : (lista.itens || []);
            const base = '/' + window.CATEGORIA_SLUG + '/';

            artigos = (await Promise.all(
                slugs.map(slug =>
                    fetch(`${base}${slug}/${slug}.json?v=` + Date.now())
                        .then(r => r.ok ? r.json() : null)
                        .then(data => data ? { ...data, slug } : { slug, nome: capitalizar(slug) })
                        .catch(() => ({ slug, nome: capitalizar(slug) }))
                )
            )).filter(Boolean);

if (window.preconnectDeConteudo) {
    window.preconnectDeConteudo(artigos);
}

            render();
            setupControles();
        } catch (e) {
            grid.innerHTML = `<p class="vazio">Erro ao carregar: ${e.message}</p>`;
        }
    }

    function capitalizar(texto) {
        return texto
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    function render() {
        const grid = document.getElementById('artigosGrid');
        const filtro = document.getElementById('filtroLocal');
        const termo = (filtro?.value || '').toLowerCase().trim();

        let lista = [...artigos];
        if (termo) {
            lista = lista.filter(a => (a.nome || '').toLowerCase().includes(termo));
        }
        if (ordem === 'az') {
            lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
        }

        if (!lista.length) {
            grid.innerHTML = '<p class="vazio">Nenhum artigo encontrado.</p>';
            return;
        }

        const api = window.WikiAPI;
        const prefixo = api?.getPrefixoIdioma() || '';

        grid.innerHTML = lista.map(a => {
            const base = `/${window.CATEGORIA_SLUG}/${a.slug}/`;
            const href = prefixo ? base.replace(/\/$/, '') + prefixo + '/' : base;
            return `
                <a class="artigo-card" href="${href}">
                    <img src="${a.imagem || 'https://placehold.co/300/1a1a1a/666?text=?'}"
                         alt="${a.nome}" loading="lazy"
                         onerror="this.src='https://placehold.co/300/1a1a1a/666?text=?'">
                    <h3>${a.nome}</h3>
                </a>
            `;
        }).join('');
    }

    function setupControles() {
        const btnAZ = document.getElementById('toggleAZ');
        const filtro = document.getElementById('filtroLocal');

        if (btnAZ) {
            btnAZ.addEventListener('click', () => {
                ordem = ordem === 'padrao' ? 'az' : 'padrao';
                btnAZ.classList.toggle('ativo', ordem === 'az');
                btnAZ.textContent = ordem === 'az'
                    ? 'Ordem: A-Z ✓'
                    : 'Ordem alfabética';
                render();
            });
        }

        if (filtro) {
            let t;
            filtro.addEventListener('input', () => {
                clearTimeout(t);
                t = setTimeout(render, 200);
            });
        }
    }

    document.addEventListener('DOMContentLoaded', carregar);
})();
