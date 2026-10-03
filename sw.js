/**
 * sw.js — Service worker BolBolaKu
 *
 * Strategi:
 *  - App shell (HTML/CSS/JS/ikon): cache-first, diperbarui di belakang.
 *    Shell kecil & statis, jadi aman.
 *  - Jadwal (ESPN + FIFA): TIDAK di-cache lewat SW (api.js sudah menangani
 *    cache sendiri dengan TTL + stale-while-revalidate). Double-caching akan
 *    membuat data basi sulit dipurge.
 */

const VERSION = 'v6';
const SHELL = `bolbolaku-shell-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './api.js',
  './config.js',
  './country-map.js',
  './competitions.js',
  './manifest.webmanifest',
  './assets/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => { /* satu aset gagal tidak memblokir install */ })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Jangan pernah menyentuh permintaan API atau font CDN di sini.
  if (url.origin !== self.location.origin) return;

  // Navigasi: network-first supaya versi terbaru cepat didapat, fallback shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(SHELL).then((c) => c.put('./index.html', copy));
          return resp;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Aset lain: cache-first, segarkan diam-diam.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(SHELL).then((c) => c.put(request, copy));
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});