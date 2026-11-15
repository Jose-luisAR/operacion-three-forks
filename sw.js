/* Guarda la app en el teléfono para que funcione sin internet (en Marte no hay). */
const CACHE = 'threeforks-v4';
const ARCHIVOS = ['./', 'index.html', 'css/estilos.css', 'vendor/leaflet.css', 'vendor/leaflet.js',
  'js/datos.js', 'js/i18n.js', 'js/geo.js', 'js/ruta.js', 'js/planificar.js', 'js/navegar.js', 'js/app.js',
  'img/hirise_three_forks.jpg', 'img/hirise_contexto.jpg', 'img/mastcamz_sol670.jpg', 'img/mastcamz_sol690_692.jpg', 'img/mastcamz_sol693.jpg', 'img/icono.svg', 'manifest.webmanifest'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
