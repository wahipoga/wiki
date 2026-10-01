(function () {
    'use strict';

    // Espera:
    //   window.ARTIGO_TIPO = "personagem"
    //   window.ARTIGO_SLUG = "wahi"

    function getIdiomaAtual() {
        return (document.documentElement.id || 'lang-pt').replace('lang-', '');
    }

    async function carregar() {
        const tipo = window.ARTIGO_TIPO;
        const slug = window.ARTIGO_SLUG;
        if (!tipo || !slug) return;

        const idioma = getIdiomaAtual();
        const base = `/${tipo}/${slug}/`;
        const conteudoEl = document.getElementById('artigoConteudo');
        const sidebarEl = document.getElementById('artigoSidebar');

        try {
            // Conteúdo por idioma: PT = conteudo.md, EN = conteudo-en.md
            const mdFile = idioma === 'pt' ? 'conteudo.md' : `conteudo-${idioma}.md`;

            const [meta, md, galeriaData] = await Promise.all([
                fetch(base + slug + '.json?v=' + Date.now()).then(r => r.json()),
                fetch(base + mdFile + '?v=' + Date.now())
                    .then
