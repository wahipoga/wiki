# Como criar um personagem novo

1. Copie esta pasta para `personagem/<slug>/`
   Exemplo: `_template/personagem/` → `personagem/luke/`

2. Renomeie `personagem.json` para `<slug>.json`
   Exemplo: `personagem.json` → `luke.json`

3. Preencha `<slug>.json` (nome, imagem, infobox)

4. Edite `conteudo.md` (texto)

5. Edite `galeria.json` (URLs) — ou apague se não tiver galeria

6. Copie o `index.html` de `personagem/wahi/index.html` para `personagem/<slug>/index.html`
   Troque `window.ARTIGO_SLUG = 'wahi';` por `window.ARTIGO_SLUG = '<slug>';`

7. Adicione `"<slug>"` no array de `personagem/personagens.json`

8. Commit. O site atualiza sozinho.

## Referência real
Olhe `personagem/wahi/` como exemplo completo.
