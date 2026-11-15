/* Keeps the app on the phone so it works offline (there is no internet on Mars). */
const CACHE = 'threeforks-en-v1';
const FILES = [
  './',
  'index.html',
  'css/styles.css',
  'vendor/leaflet.css',
  'vendor/leaflet.js',
  'js/data.js',
  'js/geo.js',
  'js/route.js',
  'js/plan.js',
  'js/navigate.js',
  'js/app.js',
  'img/hirise_three_forks.jpg',
  'img/hirise_context.jpg',
  'img/mastcamz_sol693.jpg',
  'img/icon.svg',
  'manifest.webmanifest',
  'img/hazcam/amalik_witness.jpg',
  'img/hazcam/atsah.jpg',
  'img/hazcam/bearwallow.jpg',
  'img/hazcam/coulettes.jpg',
  'img/hazcam/crosswind_lake.jpg',
  'img/hazcam/mageik.jpg',
  'img/hazcam/malay.jpg',
  'img/hazcam/montdenier.jpg',
  'img/hazcam/roubion.jpg',
  'img/hazcam/skyland.jpg',
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
