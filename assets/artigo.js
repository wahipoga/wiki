(function () {
    'use strict';

    // Esta função é usada em /personagem/wahi/index.html, etc.
    // Ela espera:
    //   - window.ARTIGO_TIPO = "personagem"
    //   - window.ARTIGO_SLUG = "wahi"

    async function carregar() {
        const tipo = window.ARTIGO_TIPO;
        const slug = window.ARTIGO_SLUG;
        if (!tipo || !slug) return;

        const base = `/${tipo}/${slug}/`;
        const conteudoEl = document.getElementById('artigoConteudo');
        const sidebarEl = document.getElementById('artigoSidebar');

        try {
            // 1. Carrega os 3 arquivos em paralelo
            const [meta, md, galeriaData] = await Promise.all([
                fetch(base + slug + '.json?v=' + Date.now()).then(r => r.json()),
                fetch(base + 'conteudo.md?v=' + Date.now()).then(r => r.text()).catch(() => ''),
                fetch(base + 'galeria.json?v=' + Date.now()).then(r => r.json()).catch(() => ({ imagens: [] }))
            ]);

            // 2. Título e imagem de topo
            document.title = `${meta.nome} — Wiki Laços Profanos`;
            const tituloEl = document.getElementById('artigoTitulo');
            if (tituloEl) tituloEl.textContent = meta.nome;

            const imgTopoEl = document.getElementById('artigoImagemTopo');
            if (imgTopoEl && meta.imagem) {
                imgTopoEl.innerHTML = `<img src="${meta.imagem}" alt="${meta.nome}">`;
            }

            // 3. Infobox (sidebar)
            if (sidebarEl) {
                sidebarEl.innerHTML = renderInfobox(meta.infobox);
            }

            // 4. Conteúdo (Markdown → HTML) + índice automático
            if (conteudoEl) {
                if (typeof marked !== 'undefined') {
                    marked.setOptions({ breaks: true, gfm: true });
                    const html = marked.parse(md);
                    conteudoEl.innerHTML = html;

                    // Gera o índice a partir dos H2
                    gerarIndice(conteudoEl);

                    // Links internos markdown [Texto](slug) viram /tipo/slug/
                    converterLinksInternos(conteudoEl, tipo);
                } else {
                    conteudoEl.innerHTML = '<p class="vazio">Erro ao carregar markdown.</p>';
                }
            }

            // 5. Galeria
            const galeriaEl = document.getElementById('artigoGaleria');
            if (galeriaEl && galeriaData.imagens && galeriaData.imagens.length) {
                galeriaEl.innerHTML = renderGaleria(galeriaData.imagens);
                setupGaleria();
            }
        } catch (e) {
            if (conteudoEl) {
                conteudoEl.innerHTML = `<p class="vazio">Erro ao carregar artigo: ${e.message}</p>`;
            }
        }
    }

    // INFOBOX — usa o CSS que você mandou (.wiki-container, .wiki-item, etc)
    function renderInfobox(info) {
        if (!info) return '';
        let html = '<div class="wiki-container">';

        // Bloco principal
        if (info.titulo) {
            html += `<div class="wiki-header-box">${info.titulo}</div
