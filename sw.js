// URLs resolve within this app's scope, including a GitHub Pages repository path.
const SCOPE = self.registration.scope;
const PREFIX = 'streakfit-shell-' + new URL(SCOPE).pathname + '-';
const CACHE = PREFIX + 'v0310';
const SHELL = ['./', './index.html', './app.js', './style.css', './foundation.css', './accounts.css', './account-config.json',
  './manifest.webmanifest', './assets/icons/icon-192.png', './assets/icons/icon-512.png',
  './modules/units.js', './modules/rewards.js', './modules/learning.js', './modules/backup.js',
  './modules/planning.js', './modules/insights.js', './modules/local-integrity.js',
  './modules/experience-toolkit.js', './modules/account-rules.js', './modules/account-data.js', './modules/account-client.js', './modules/account-sync.js', './modules/accounts-ui.js'].map(path => new URL(path, SCOPE).href);

self.addEventListener('install', event => {
  // A failed download must not activate an incomplete shell. Updates wait until
  // existing app windows close, rather than interrupting an unfinished input.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key !== CACHE && (key.startsWith(PREFIX) ||
      new URL(SCOPE).pathname === '/' && /^streakfit-shell-v\d+$/.test(key)))
      .map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  url.search = ''; url.hash = '';
  if (!SHELL.includes(url.href)) return;
  // Serve HTML, CSS and modules from the same installed version, also offline.
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(url.href);
    return cached || fetch(event.request);
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({type: 'window'}).then(windows => {
    const window = windows.find(client => client.url.startsWith(SCOPE));
    return window ? window.focus() : clients.openWindow(SCOPE);
  }));
});
