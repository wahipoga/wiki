(function () {
    'use strict';

    // Espera:
    //   window.CATEGORIA_SLUG = "personagem"
    //   window.CATEGORIA_JSON = "/personagem/personagens.json"

    let artigos = [];
    let ordem = 'padrao';

    function getIdiomaAtual() {
        return (document.documentElement.id || 'lang-pt').replace('lang-', '');
    }

    async function carregar() {
        const grid = document.getElementById('artigosGrid');
        if (!grid) return;

        try {
            const lista = await fetch(window.CATEGORIA_JSON + '?v=' + Date.now())
                .then(r => r.json());

            const slugs = Array.isArray(lista) ? lista : (lista.itens || []);
            const base = '/' + window.CATEGORIA_SLUG + '/';

            artigos = (await Promise.all(
                slugs.map(slug =>
                    fetch(`${base}${slug}/${slug}.json?v=` + Date.now())
                        .then(r => r.json())
                        .then(data => ({ ...data, slug }))
                        .catch(() => null)
                )
            )).filter(Boolean);

            render();
            setupControles();
        } catch (e) {
            grid.innerHTML = `<p class="vazio">Erro ao carregar: ${e.message}</p>`;
        }
    }

    function render() {
        const grid = document.getElementById('artigosGrid');
        const filtro = document.getElementById('filtroLocal');
        const termo = (filtro?.value || '').toLowerCase().trim();
        const idioma = getIdiomaAtual();

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

        grid.innerHTML = lista.map(a => {
            // Link do card aponta pro idioma certo
            const sufixo = idioma === 'pt' ? '' : `${idioma}`;
            const href = `/${window.CATEGORIA_SLUG}/${a.slug}/${sufixo}`;
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
