# BolBolaKu ⚽

Jadwal pertandingan sepak bola pria — ringan, cepat, PWA, waktu WIB (UTC+7).

**Live:** https://davidtimoteus.github.io/bolbolaku/

---

## Fitur

- **Filter berlapis** — grup kompetisi, liga spesifik, negara, klub
- **Rentang waktu** — hari ini, 3 hari, 7 hari, 14 hari
- **Favorit** — tandai tim (bintang), tersimpan di perangkat
- **Hitung mundur** — jam kick-off otomatis dalam WIB
- **Pencarian** — cari klub secara instan
- **URL bisa dibagikan** — filter tersimpan di query string
- **PWA** — bisa dipasang ke home screen, ada cache offline

---

## Kompetisi

| Grup | Kompetisi |
|------|-----------|
| **Liga Top Eropa** | Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, Eredivisie |
| **Eropa** | Champions League, Europa League, Conference League |
| **Domestik** | FA Cup, Copa del Rey, Coppa Italia, DFB Pokal, Coupe de France, KNVB Beker |
| **Tim Nasional** | UEFA Nations League, FIFA Friendly, CONCACAF Nations League |

**27 kompetisi** total, terverifikasi aktif di ESPN.

---

## Cara Kerja

Situs ini **statis murni** — tanpa backend, tanpa build step, tanpa framework.
Data diambil langsung dari ESPN public API (`site.api.espn.com`), yang
mengizinkan CORS (`Access-Control-Allow-Origin: *`).

```
index.html          Shell semantik + aksesibilitas
styles.css          Token design system (WCAG AA)
config.js           27 kompetisi + slug ESPN
api.js              Fetch + cache (memory -> localStorage -> network)
app.js              State, render, filter, hitung mundur WIB
sw.js               Service worker (offline)
manifest.webmanifest Metadata PWA
```

Data di-cache di `localStorage` selama 6 jam, jadi kunjungan berikutnya
tidak perlu memuat ulang semuanya.

---

## Menjalankan Secara Lokal

Karena memakai ES modules, file **tidak bisa** dibuka lewat `file://`.
Perlu server statis:

```bash
python -m http.server 8080
# lalu buka http://127.0.0.1:8080/
```

Untuk pengembangan penuh (termasuk proxy + cache bersama), repo pengembangan
menyediakan `api-server.py` yang juga melayani `/api/fixtures`. Di produksi
frontend otomatis memakai fallback ESPN langsung.

---

## Teknologi

Vanilla JavaScript (ES modules), CSS token-driven, tanpa dependensi runtime.
