(function () {
    'use strict';

    // Espera:
    //   window.ARTIGO_TIPO = "personagem"
    //   window.ARTIGO_SLUG = "wahi"   (ou "" pra página única na própria pasta)

    async function carregar() {
        const tipo = window.ARTIGO_TIPO;
        const slug = window.ARTIGO_SLUG ?? '';
        if (!tipo) return;

        const conteudoEl = document.getElementById('artigoConteudo');
        const sidebarEl = document.getElementById('artigoSidebar');

        // Espera a WikiAPI existir (o app.js define ela no DOMContentLoaded)
        let tentativas = 0;
        while (!window.WikiAPI && tentativas < 100) {
            await new Promise(r => setTimeout(r, 10));
            tentativas++;
        }
        if (!window.WikiAPI) {
            console.warn('WikiAPI não disponível — app.js não carregou?');
            return;
        }

        // Espera o lang.json carregar
        if (window.__langReady) await window.__langReady;

        const api = window.WikiAPI;
        const prefixo = api.getPrefixoIdioma();

        // Monta o base:
        //   slug preenchido → /tipo/slug/
        //   slug vazio      → /tipo/
        const caminho = slug ? `/${tipo}/${slug}/` : `/${tipo}/`;
        const base = prefixo
            ? caminho.replace(/\/$/, '') + prefixo + '/'
            : caminho;

        // Arquivo JSON: slug.json (se tem slug) ou tipo.json (se não tem)
        const jsonFile = slug ? `${slug}.json` : `${tipo}.json`;

        try {
            const meta = await fetch(base + jsonFile + '?v=' + Date.now())
                .then(r => r.ok ? r.json() : {})
                .catch(() => ({}));

            const md = await fetch(base + 'conteudo.md?v=' + Date.now())
                .then(r => r.ok ? r.text() : '')
                .catch(() => '');

            const galeriaData = await fetch(base + 'galeria.json?v=' + Date.now())
                .then(r => r.ok ? r.json() : { imagens: [] })
                .catch(() => ({ imagens: [] }));

            // Nome: do JSON, senão capitaliza o slug/tipo
            const nome = meta.nome || capitalizar(slug || tipo);
            const nomeCompleto = api.getTexto('nomeCompleto') || 'Wiki Laços Profanos';
            document.title = `${nome} — ${nomeCompleto}`;

            const nomeEl = document.getElementById('artigoNome');
            if (nomeEl) nomeEl.textContent = nome;

            const imgTopoEl = document.getElementById('artigoImagemTopo');
            if (imgTopoEl && meta.imagem) {
                imgTopoEl.innerHTML = `<img src="${meta.imagem}" alt="${nome}">`;
            }

            // Preenche a sidebar (só se tiver infobox)
            if (sidebarEl && meta.infobox) {
                sidebarEl.innerHTML = renderInfobox(meta.infobox, tipo);
            }

            // Se não tem nem infobox nem imagem, esconde a sidebar e expande o conteúdo
            const temInfobox = !!meta.infobox;
            const temImagem = !!meta.imagem;
            if (!temInfobox && !temImagem) {
                document.querySelector('.artigo-layout')?.classList.add('sem-sidebar');
            }

            const temGaleria = !!galeriaData.imagens?.length;

            if (conteudoEl) {
                if (typeof marked !== 'undefined') {
                    marked.setOptions({ breaks: true, gfm: true });
                    conteudoEl.innerHTML = marked.parse(md);

                    const introEl = document.getElementById('artigoIntro');
                    if (introEl) {
                        const primeiroH2 = conteudoEl.querySelector('h2');
                        while (conteudoEl.firstChild && conteudoEl.firstChild !== primeiroH2) {
                            introEl.appendChild(conteudoEl.firstChild);
                        }
                    }

                    gerarIndice(conteudoEl, nome, temGaleria);
                    converterLinksInternos(document.querySelector('.artigo-conteudo'), tipo);
                } else {
                    conteudoEl.innerHTML = '<p class="vazio">Erro: marked.js não carregado.</p>';
                }
            }

            const galeriaEl = document.getElementById('artigoGaleria');
            const galeriaTitulo = document.getElementById('galeria-titulo');
            if (galeriaEl && temGaleria) {
                if (galeriaTitulo) {
                    galeriaTitulo.textContent = api.getTexto('galeria') || 'Galeria';
                    galeriaTitulo.style.display = '';
                }
                galeriaEl.innerHTML = renderGaleria(galeriaData.imagens);
                setupGaleria();
            }
        } catch (e) {
            if (conteudoEl) {
                conteudoEl.innerHTML = `<p class="vazio">Erro ao carregar artigo: ${e.message}</p>`;
            }
        }
    }

    function capitalizar(texto) {
        return texto
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    function renderInfobox(info, tipoAtual) {
        if (!info) return '';
        let html = '<div class="wiki-container">';

        html += `<div class="wiki-header-box">${info.titulo || 'Informações'}</div>`;

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
            html += `<div class="wiki-header-box">${info.historias.titulo || 'Histórias / Aparições'}</div>`;
            (info.historias.campos || []).forEach(c => {
                html += `<div class="wiki-item"><strong>${c.label}:</strong> ${c.valor}</div>`;
            });
        }

        html += '</div>';
        return html;
    }

    function gerarIndice(container, nome, temGaleria) {
        const indiceEl = document.getElementById('artigoIndice');
        if (!indiceEl) return;
        const h2s = container.querySelectorAll('h2');
        if (!h2s.length && !temGaleria) { indiceEl.style.display = 'none'; return; }

        const api = window.WikiAPI;
        const tituloGaleria = api?.getTexto('galeria') || 'Galeria';

        const itens = [`<li><a href="#artigoNome">${nome}</a></li>`];
        h2s.forEach((h2, i) => {
            const id = 'secao-' + i;
            h2.id = id;
            itens.push(`<li><a href="#${id}">${h2.textContent}</a></li>`);
        });
        if (temGaleria) itens.push(`<li><a href="#galeria-titulo">${tituloGaleria}</a></li>`);

        const tituloIndice = api?.getTexto('indice') || 'Índice';
        indiceEl.innerHTML = `<h3>${tituloIndice}</h3><ul>${itens.join('')}</ul>`;
    }

    function converterLinksInternos(container, tipo) {
        if (!container) return;
        const api = window.WikiAPI;
        const prefixo = api?.getPrefixoIdioma() || '';
        container.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href') || '';
            if (/^[a-z0-9-]+$/i.test(href)) {
                const base = `/${tipo}/${href}/`;
                a.setAttribute('href', prefixo ? base.replace(/\/$/, '') + prefixo + '/' : base);
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', carregar);
    } else {
        carregar();
    }
})();
