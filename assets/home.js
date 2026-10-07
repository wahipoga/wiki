(function () {
    'use strict';

    async function carregar() {
        const grid = document.getElementById('categoriasGrid');
        if (!grid) return;

        if (window.__langReady) await window.__langReady;

        try {
            const categorias = await fetch('/categorias.json?v=' + Date.now())
                .then(r => r.json());

            // 👇 ADICIONADO — pré-conecta os hosts das imagens das categorias
            if (window.preconnectDeConteudo) {
                window.preconnectDeConteudo(categorias);
            }

            if (!categorias.length) {
                grid.innerHTML = '<p class="vazio">Nenhuma categoria cadastrada.</p>';
                return;
            }

            const api = window.WikiAPI;
            const prefixo = api?.getPrefixoIdioma() || '';

            grid.innerHTML = categorias.map(cat => {
                const base = `/${cat.slug}/`;
                const href = prefixo ? base.replace(/\/$/, '') + prefixo + '/' : base;
                return `
                    <a class="categoria-card" href="${href}">
                        <img src="${cat.imagem}" alt="${cat.nome}" loading="lazy"
                             onerror="this.src='https://placehold.co/600x340/1a1a1a/666?text=?'">
                        <div class="info">
                            <h2>${cat.nome}</h2>
                            <p>${cat.descricao || ''}</p>
                        </div>
                    </a>
                `;
            }).join('');
        } catch (e) {
            grid.innerHTML = `<p class="vazio">Erro ao carregar categorias: ${e.message}</p>`;
        }
    }

    document.addEventListener('DOMContentLoaded', carregar);
})();
