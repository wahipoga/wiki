// ============================================
// SERVICE WORKER — cache de imagens externas
// ============================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js', { scope: '/' })
            .then(() => console.log('[SW] registrado'))
            .catch(err => console.warn('[SW] falhou:', err));
    });
}
