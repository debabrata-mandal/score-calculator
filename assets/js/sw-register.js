if ('serviceWorker' in navigator) {
  const appVersionMeta = document.querySelector('meta[name="app-version"]');
  const appVersion = appVersionMeta ? appVersionMeta.getAttribute('content') : 'v0';

  const swCode = `
    const CACHE_NAME = 'rummy-score-${appVersion}';
    self.addEventListener('fetch', (event) => {
      // Don't cache the main HTML file - always fetch fresh
      if (event.request.url.includes('.html') || event.request.url === self.registration.scope) {
        event.respondWith(
          fetch(event.request, {
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
          })
        );
      }
    });
  `;

  const blob = new Blob([swCode], { type: 'application/javascript' });
  const swUrl = URL.createObjectURL(blob);

  navigator.serviceWorker.register(swUrl)
    .then(() => console.log('Service Worker registered for cache control'))
    .catch(() => console.log('Service Worker registration failed (this is normal on some browsers)'));
}

