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
            html += `<div class="wiki-header-box">${info.titulo}</div>`;
        }
        (info.campos || []).forEach(c => {
            html += `<div class="wiki-item"><strong>${c.label}:</strong> ${c.valor}`;
            if (c.nota) html += ` <span class="wiki-note">${c.nota}</span>`;
            html += '</div>';
        });

        // Relacionamentos
        if (info.relacionamentos && info.relacionamentos.length) {
            html += `<div class="wiki-item"><strong>Relacionamentos:</strong><br>`;
            html += info.relacionamentos.map(r => {
                const href = r.slug ? `/${inferirTipoDoSlug(r.slug)}/${r.slug}/` : '#';
                const link = r.slug
                    ? `<a href="${href}" class="wiki-text-link">${r.nome}</a>`
                    : r.nome;
                const nota = r.nota ? ` <span class="wiki-note">(${r.nota})</span>` : '';
                return `• ${link}${nota}`;
            }).join('<br>');
            html += '</div>';
        }

        // Histórias / Aparições
        if (info.historias) {
            html += `<div class="wiki-header-box">${info.historias.titulo || 'Histórias'}</div>`;
            (info.historias.campos || []).forEach(c => {
                html += `<div class="wiki-item"><strong>${c.label}:</strong> ${c.valor}</div>`;
            });
        }

        html += '</div>';
        return html;
    }

    // Heurística simples: se o slug existe em personagem/, é personagem.
    // Aqui só usamos /personagem/ por padrão — ajuste se tiver muitos tipos.
    function inferirTipoDoSlug(slug) {
        // Como não dá pra saber sem consultar, deixa como personagem por padrão.
        // Se quiser mais preciso, coloque o tipo no relacionamento: { tipo: 'bestiario', slug: 'x' }
        return 'personagem';
    }

    // ÍNDICE AUTOMÁTICO
    function gerarIndice(container) {
        const indiceEl = document.getElementById('artigoIndice');
        if (!indiceEl) return;

        const h2s = container.querySelectorAll('h2');
        if (!h2s.length) { indiceEl.style.display = 'none'; return; }

        let html = '<h3>Índice</h3><ul>';
        h2s.forEach((h2, i) => {
            const id = 'secao-' + i;
            h2.id = id;
            html += `<li><a href="#${id}">${h2.textContent}</a></li>`;
        });
        html += '</ul>';
        indiceEl.innerHTML = html;
    }

    // Links internos: [Texto](slug) → [Texto](/tipo/slug/)
    function converterLinksInternos(container, tipo) {
        container.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href') || '';
            // Só converte se for um slug simples (sem :, /, http)
            if (/^[a-z0-9-]+$/i.test(href)) {
                a.setAttribute('href', `/${tipo}/${href}/`);
            }
        });
    }

    // GALERIA (carrossel com botões + dots + lightbox)
    function renderGaleria(imagens) {
        const slides = imagens.map(src =>
            `<img src="${src}" alt="" loading="lazy">`
        ).join('');
        const dots = imagens.map((_, i) =>
            `<button class="galeria-dot${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="Imagem ${i + 1}"></button>`
        ).join('');
        return `
            <div class="galeria-carrossel">
                <div class="galeria-slides">${slides}</div>
                <button class="galeria-prev" aria-label="Anterior">‹</button>
                <button class="galeria-next" aria-label="Próximo">›</button>
                <div class="galeria-dots">${dots}</div>
            </div>
            <div class="lightbox" id="lightbox">
                <button class="lightbox-close" aria-label="Fechar">×</button>
                <img src="" alt="">
            </div>
        `;
    }

    function setupGaleria() {
        const carrossel = document.querySelector('.galeria-carrossel');
        if (!carrossel) return;
        const slides = carrossel.querySelector('.galeria-slides');
        const dots = carrossel.querySelectorAll('.galeria-dot');
        const prev = carrossel.querySelector('.galeria-prev');
        const next = carrossel.querySelector('.galeria-next');
        const imgs = slides.querySelectorAll('img');
        let atual = 0;

        function irPara(i) {
            atual = (i + imgs.length) % imgs.length;
            slides.style.transform = `translateX(-${atual * 100}%)`;
            dots.forEach((d, j) => d.classList.toggle('active', j === atual));
        }

        prev.addEventListener('click', () => irPara(atual - 1));
        next.addEventListener('click', () => irPara(atual + 1));
        dots.forEach(d => d.addEventListener('click', () => irPara(parseInt(d.dataset.i))));

        // Lightbox ao clicar
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = lightbox.querySelector('img');
        const closeBtn = lightbox.querySelector('.lightbox-close');

        imgs.forEach(img => {
            img.addEventListener('click', () => {
                lightboxImg.src = img.src;
                lightbox.classList.add('active');
            });
        });
        closeBtn.addEventListener('click', () => lightbox.classList.remove('active'));
        lightbox.addEventListener('click', e => {
            if (e.target === lightbox) lightbox.classList.remove('active');
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') lightbox.classList.remove('active');
        });
    }

    document.addEventListener('DOMContentLoaded', carregar);
})();
