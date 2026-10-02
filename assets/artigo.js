fetch('/assets/artigo.js?v=' + Date.now(), { cache: 'no-store' })
  .then(r => r.text())
  .then(t => {
    try {
      new Function(t);
      console.log('✅ Sem erro de sintaxe');
    } catch (e) {
      console.log('❌ Erro:', e.message);
    }
  })
