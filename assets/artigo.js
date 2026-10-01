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
                    .then(r => r.ok ? r.text() : fetch(base + 'conteudo.md').then(r2 => r2.text()))
                    .catch(() => ''),
                fetch(base + 'galeria.json?v=' + Date.now())
                    .then(r => r.json()).catch(() => ({ imagens: [] }))
            ]);

            document.title = `${meta.nome} — Wiki Laços Profanos`;

            const tituloEl = document.getElementById('artigoTitulo');
            if (tituloEl) tituloEl.textContent = meta.nome;

            const imgTopoEl = document.getElementById('artigoImagemTopo');
            if (imgTopoEl && meta.imagem) {
                imgTopoEl.innerHTML = `<img src="${meta.imagem}" alt="${meta.nome}">`;
            }

            if (sidebarEl) {
                sidebarEl.innerHTML = renderInfobox(meta.infobox, tipo);
            }

            if (conteudoEl) {
                if (typeof marked !== 'undefined') {
                    marked.setOptions({ breaks: true, gfm: true });
                    conteudoEl.innerHTML = marked.parse(md);
                    gerarIndice(conteudoEl);
                    converterLinksInternos(conteudoEl, tipo);
                } else {
                    conteudoEl.innerHTML = '<p class="vazio">Erro: marked.js não carregado.</p>';
                }
            }

            const galeriaEl = document.getElementById('artigoGaleria');
            if (galeriaEl && galeriaData.imagens?.length) {
                galeriaEl.innerHTML = renderGaleria(galeriaData.imagens);
                setupGaleria();
            }
        } catch (e) {
            if (conteudoEl) {
                conteudoEl.innerHTML = `<p class="vazio">Erro ao carregar artigo: ${e.message}</p>`;
            }
        }
    }

    function renderInfobox(info, tipoAtual) {
        if (!info) return '';
        let html = '<div class="wiki-container">';

        if (info.titulo) {
            html += `<div class="wiki-header-box">${info.titulo}</div>`;
        }
        (info.campos || []).forEach(c => {
            html += `<div class="wiki-item"><strong>${c.label}:</strong> ${c.valor}`;
            if (c.nota) html += ` <span class="wiki-note">${c.nota}</span>`;
            html += '</div>';
        });

        if (info.relacionamentos?.length) {
            html += `<div class="wiki-item"><strong>Relacionamentos:</strong><br>`;
            html += info.relacionamentos.map(r => {
                const tipoRel = r.tipo || tipoAtual;
                const href = r.slug ? `/${tipoRel}/${r.slug}/` : '#';
                const link = r.slug
                    ? `<a href="${href}" class="wiki-text-link">${r.nome}</a>`
                    : r.nome;
                const nota = r.nota ? ` <span class="wiki-note">(${r.nota})</span>` : '';
                return `• ${link}${nota}`;
            }).join('<br>');
            html += '</div>';
        }

        if (info.historias) {
            html += `<div class="wiki-header-box">${info.historias.titulo || 'Histórias'}</div>`;
            (info.historias.campos || []).forEach(c => {
                html += `<div class="wiki-item"><strong>${c.label}:</strong> ${c.valor}</div>`;
            });
        }

        html += '</div>';
        return html;
    }

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

    function converterLinksInternos(container, tipo) {
        container.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href') || '';
            if (/^[a-z0-9-]+$/i.test(href)) {
                a.setAttribute('href', `/${tipo}/${href}/`);
            }
        });
    }

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
