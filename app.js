/**
 * app.js — Presentation + state. Tidak memanggil fetch secara langsung;
 * menerima data dari api.js lalu merender.
 *
 * State disimpan di URL (searchParams) supaya filter bisa di-share dan
 * tombol "back" HP bekerja (skill: frontend-ui-engineering — URL state).
 */

import { CONFIG } from './config.js';
import { loadFixtures } from './api.js';
import { TEAM_COUNTRY } from './country-map.js';

/* ==================================================================
   State
   ================================================================== */
const state = {
  fixtures: [],
  savedAt: 0,
  stale: false,
  loading: false,
  loadFailed: false,      // true kalau sync gagal total (bukan sekadar kosong)
  online: navigator.onLine,

  group: 'semua',
  comps: new Set(),        // id kompetisi aktif
  country: '',
  team: '',
  query: '',
  range: 7,                // hari ke depan
  favOnly: false,          // hanya tampilkan match klub favorit
  favourites: new Set(),   // nama tim exact
  notified: new Set(),     // id match yang sudah dinotifikasi
};

/* ==================================================================
   Util
   ================================================================== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const WIB = new Intl.DateTimeFormat('id-ID', {
  timeZone: CONFIG.timeZone,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const DAY_SHORT = new Intl.DateTimeFormat('id-ID', {
  timeZone: CONFIG.timeZone,
  weekday: 'short',
});
const DAY_LONG = new Intl.DateTimeFormat('id-ID', {
  timeZone: CONFIG.timeZone,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const DATE_FULL = new Intl.DateTimeFormat('id-ID', {
  timeZone: CONFIG.timeZone,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Escape HTML — data dari API tidak pernah disuntik mentah ke DOM. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/**
 * Negara sebuah tim. Peta utama (TEAM_COUNTRY) dibangun otomatis dari
 * data ESPN oleh scripts/build_country_map.py — ratusan klub & timnas.
 * Peta manual di CONFIG hanya cadangan untuk nama yang tak ada di sana.
 */
function countryOf(team) {
  if (!team) return '';
  return TEAM_COUNTRY[team] || CONFIG.teamCountry[String(team).toLowerCase()] || '';
}

/** Tanggal lokal (WIB) sebagai key YYYY-MM-DD. */
function wibDateKey(iso) {
  // ESPN kirim ISO UTC. Ambil tanggal menurut zona WIB.
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CONFIG.timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CONFIG.timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/** Jarak hari dari hari ini (WIB) ke tanggal match. */
function daysAhead(iso) {
  const a = new Date(wibDateKey(iso) + 'T00:00:00+07:00');
  const b = new Date(todayKey() + 'T00:00:00+07:00');
  return Math.round((a - b) / 86400000);
}

function relativeLabel(days) {
  if (days === 0) return 'Hari ini';
  if (days === 1) return 'Besok';
  if (days === 2) return 'Lusa';
  if (days < 0) return 'Selesai';
  return `${days} hari lagi`;
}

/* ==================================================================
   Preferensi (favorit) — localStorage
   ================================================================== */
function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(CONFIG.prefsKey) || '{}');
    state.favourites = new Set(Array.isArray(raw.favourites) ? raw.favourites : []);
  } catch { state.favourites = new Set(); }
}
function savePrefs() {
  try {
    localStorage.setItem(CONFIG.prefsKey, JSON.stringify({
      favourites: Array.from(state.favourites),
    }));
  } catch { /* noop */ }
}
function isFav(team) { return state.favourites.has(team); }
function toggleFav(team) {
  if (isFav(team)) state.favourites.delete(team); else state.favourites.add(team);
  savePrefs();
}

/* ==================================================================
   Filter — satu fungsi murni, mudah diuji
   ================================================================== */
function applyFilters() {
  const q = state.query.trim().toLowerCase();

  return state.fixtures.filter((f) => {
    // rentang hari
    const d = daysAhead(f.dateUTC);
    if (d < 0 || d > state.range) return false;

    // grup
    if (state.group !== 'semua') {
      const comp = CONFIG.competitions.find((c) => c.id === f.compId);
      if (!comp || comp.group !== state.group) return false;
    }

    // kompetensi spesifik
    if (state.comps.size && !state.comps.has(f.compId)) return false;

    // negara
    if (state.country) {
      if (countryOf(f.home) !== state.country && countryOf(f.away) !== state.country) return false;
    }

    // klub / tim spesifik
    if (state.team) {
      if (f.home !== state.team && f.away !== state.team) return false;
    }

    // hanya klub favorit
    if (state.favOnly) {
      if (!isFav(f.home) && !isFav(f.away)) return false;
    }

    // cari
    if (q) {
      const hay = `${f.home} ${f.away} ${f.compName} ${f.venue}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}

/* ==================================================================
   Render
   ================================================================== */
function statusPill(f) {
  if (f.state === 'in') return '<span class="status status--live">Live</span>';
  if (f.finished) return '<span class="status status--ft">Full Time</span>';
  return '';
}

function isNational(f) {
  return f.compGroup === 'nasional';
}

function matchCard(f) {
  const live = f.state === 'in';
  // Skor hanya tampil kalau pertandingan sudah mulai/selesai. Placeholder
  // "–" sengaja dihapus: ia terbaca seperti teks rusak, bukan informasi.
  const showScore = (live || f.finished) &&
    f.homeScore !== null && f.awayScore !== null;

  // Tim yang memimpin dicetak tebal. Tanpa pembeda, laga selesai tampil
  // rata dan tidak bisa dipindai sekilas.
  const hLead = showScore && f.homeScore > f.awayScore;
  const aLead = showScore && f.awayScore > f.homeScore;
  const score = (v, lead) => (showScore
    ? `<span class="team__score${lead ? ' is-lead' : ''}">${v}</span>`
    : '');

  // Untuk timnas, nama negara == nama tim ("Fiji" / "Fiji") — mubazir.
  // Label negara hanya berguna untuk KLUB, jadi sembunyikan di timnas.
  const nat = f.compGroup === 'nasional';
  const homeC = nat ? '' : countryOf(f.home);
  const awayC = nat ? '' : countryOf(f.away);

  const fav = isFav(f.home);
  const star = `<button class="star${fav ? ' is-fav' : ''}" data-fav="${esc(f.home)}" `
    + `aria-label="${fav ? 'Hapus dari' : 'Tambah ke'} favorit: ${esc(f.home)}" `
    + `aria-pressed="${fav}" title="${fav ? 'Hapus dari' : 'Tambah ke'} favorit">`
    + `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"/></svg>`
    + `</button>`;

  // Satu baris tim: nama (+ negara kecil di bawahnya) dan skor sejajar
  // kanan. Grid 2 kolom membuat semua skor berbaris rapi antar kartu.
  const team = (name, ctry, cls, sc) => `
      <div class="team ${cls}">
        <span class="team__name" title="${esc(name)}">${esc(name)}</span>
        ${ctry ? `<span class="team__country">${esc(ctry)}</span>` : ''}
        ${sc}
      </div>`;

  return `
  <li>
    <article class="match${live ? ' match--live' : ''}${f.finished ? ' match--done' : ''}" data-id="${esc(f.id)}">
      <span class="match__comp" title="${esc(f.compName)}">${esc(f.compBadge)}</span>
      <div class="match__teams">
        ${team(f.home, homeC, 'team--home', score(f.homeScore, hLead))}
        ${team(f.away, awayC, 'team--away', score(f.awayScore, aLead))}
      </div>
      <div class="match__time">
        <span class="match__clock">${WIB.format(new Date(f.dateUTC))}</span>
        ${statusPill(f)}
      </div>
      ${star}
    </article>
  </li>`;
}

function renderList(list) {
  if (state.loading && state.fixtures.length === 0) {
    $('#list').innerHTML = Array.from({ length: 6 }, () => '<div class="skel"></div>').join('');
    $('#empty').hidden = true;
    return;
  }

  if (list.length === 0) {
    $('#list').innerHTML = '';
    const e = $('#empty');
    e.hidden = false;
    // Tiga keadaan berbeda, tiga pesan berbeda. Menampilkan "tidak ada
    // pertandingan" saat sync GAGAL adalah kebohongan yang membuat pengguna
    // mengira filternya salah, bukan koneksinya.
    const offline = !state.online;
    e.className = 'state' + (offline ? ' state--offline'
      : state.loadFailed ? ' state--error' : '');
    e.innerHTML = offline
      ? `<svg class="state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2l20 20"/><circle cx="12" cy="12" r="9"/></svg>
         <h2 class="state__title">Sedang offline</h2>
         <p class="state__text">Tidak ada cache tersimpan. Jadwal akan muncul otomatis begitu koneksi kembali.</p>`
      : state.loadFailed
      ? `<svg class="state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5h.01"/></svg>
         <h2 class="state__title">Gagal memuat jadwal</h2>
         <p class="state__text">Tidak bisa menghubungi sumber data. Periksa koneksi internet, lalu coba lagi.</p>
         <button class="state__retry" id="retry" type="button">Coba lagi</button>`
      : `<svg class="state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M9 12h6"/></svg>
         <h2 class="state__title">Tidak ada pertandingan</h2>
         <p class="state__text">Tidak ada jadwal yang cocok dengan filter ini. Coba perluas rentang hari atau kosongkan pencarian.</p>`;
    $('#count').textContent = '0';
    return;
  }

  e_reset('#empty');

  // Kelompokkan per hari (WIB).
  const groups = new Map();
  for (const f of list) {
    const key = wibDateKey(f.dateUTC);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }

  const today = todayKey();
  const html = Array.from(groups.entries()).map(([key, items]) => {
    const dt = new Date(key + 'T00:00:00+07:00');
    const rel = key === today ? 'Hari ini'
      : daysAhead(items[0].dateUTC) === 1 ? 'Besok'
      : daysAhead(items[0].dateUTC) === 2 ? 'Lusa'
      : '';
    return `
    <section class="daygroup" aria-labelledby="d-${key}">
      <header class="daygroup__head">
        <h2 class="daygroup__date" id="d-${key}">${esc(DAY_LONG.format(dt))}</h2>
        ${rel ? `<span class="daygroup__rel">${esc(rel)}</span>` : ''}
        <span class="daygroup__count">${items.length} pertandingan · ${CONFIG.timeZoneLabel}</span>
      </header>
      <ul class="grid">${items.map(matchCard).join('')}</ul>
    </section>`;
  }).join('');

  $('#list').innerHTML = html;
  $('#count').textContent = String(list.length);
}

function e_reset(sel) { $(sel).hidden = true; }

/* ==================================================================
   Filter bar
   ================================================================== */
function renderFilters() {
  const active = state.group === 'semua' ? null : state.group;

  // Grup. Chip ber-jumlah nol disembunyikan: menawarkan filter yang
  // dijamin kosong hanya membuat UI terasa belum jadi.
  $('#groupstrip').innerHTML = CONFIG.groups.map((g) => {
    const n = g.id === 'semua'
      ? state.fixtures.length
      : state.fixtures.filter((f) =>
          CONFIG.competitions.find((c) => c.id === f.compId)?.group === g.id).length;
    if (n === 0 && g.id !== 'semua') return '';
    return `<button class="chip" role="tab" aria-pressed="${active === g.id}" data-group="${g.id}">${esc(g.label)}<span class="chip__count">${n}</span></button>`;
  }).join('');

  // Kompetisi (hanya yang ada jadwalnya di hasil sync)
  const present = new Set(state.fixtures.map((f) => f.compId));
  const comps = CONFIG.competitions
    .filter((c) => present.has(c.id))
    .sort((a, b) => a.priority - b.priority);

  $('#compstrip').innerHTML = comps.map((c) => {
    const n = state.fixtures.filter((f) => f.compId === c.id).length;
    return `<button class="chip" aria-pressed="${state.comps.has(c.id)}" data-comp="${c.id}" title="${esc(c.name)}">
      ${esc(c.short)}<span class="chip__count">${n}</span></button>`;
  }).join('');

  // Negara — hanya negara yang benar-benar muncul
  const countries = new Map();
  for (const f of state.fixtures) {
    for (const t of [f.home, f.away]) {
      const c = countryOf(t);
      if (c) countries.set(c, (countries.get(c) || 0) + 1);
    }
  }
  const sorted = Array.from(countries.entries()).sort((a, b) => b[1] - a[1]);
  $('#country').innerHTML =
    `<option value="">Semua negara</option>` +
    sorted.map(([c, n]) => `<option value="${esc(c)}"${state.country === c ? ' selected' : ''}>${esc(c)} (${n})</option>`).join('');

  // Klub
  const teams = new Set();
  for (const f of state.fixtures) { teams.add(f.home); teams.add(f.away); }
  const tl = Array.from(teams).sort();
  $('#team').innerHTML =
    `<option value="">Semua klub/tim</option>` +
    tl.map((t) => `<option value="${esc(t)}"${state.team === t ? ' selected' : ''}>${esc(t)}</option>`).join('');

  // Rentang hari
  $$('[data-range]').forEach((b) =>
    b.setAttribute('aria-pressed', String(Number(b.dataset.range) === state.range)));
}

/**
 * Tandai wrapper strip yang isinya meluber supaya CSS bisa menampilkan
 * gradien "masih ada". Tanpa ini, baris liga terpotong begitu saja di
 * layar sempit dan pengguna tidak tahu masih ada pilihan lain.
 *
 * Sengaja tidak melempar error: pengukuran layout tidak boleh pernah
 * membatalkan render daftar.
 */
function markOverflowingStrips() {
  const wraps = document.querySelectorAll('.strip-wrap');
  for (const wrap of wraps) {
    const strip = wrap.querySelector('.strip');
    if (!strip) continue;
    wrap.classList.toggle(
      'is-overflowing',
      strip.scrollWidth > wrap.clientWidth + 2
    );
  }
}

function update() {
  const list = applyFilters();
  renderList(list);
  renderFilters();
  markOverflowingStrips();
  syncUrl();
}

/* URL state — filter bisa di-share & tombol back HP bekerja */
function syncUrl() {
  const p = new URLSearchParams();
  if (state.group !== 'semua') p.set('g', state.group);
  if (state.comps.size) p.set('c', Array.from(state.comps).join(','));
  if (state.country) p.set('n', state.country);
  if (state.team) p.set('t', state.team);
  if (state.query) p.set('q', state.query);
  if (state.range !== 7) p.set('r', String(state.range));
  const qs = p.toString();
  history.replaceState(null, '', qs ? '?' + qs : location.pathname);
}

function readUrl() {
  const p = new URLSearchParams(location.search);
  state.group = p.get('g') || 'semua';
  state.comps = new Set((p.get('c') || '').split(',').filter(Boolean));
  state.country = p.get('n') || '';
  state.team = p.get('t') || '';
  state.query = p.get('q') || '';
  state.range = Number(p.get('r')) || 7;
}

/* ==================================================================
   Countdown ke kick-off berikutnya
   ================================================================== */
let cdTimer = null;

function nextKickoff() {
  const now = Date.now();
  const upcoming = state.fixtures
    .filter((f) => !f.finished && new Date(f.dateUTC).getTime() > now)
    .sort((a, b) => a.dateUTC.localeCompare(b.dateUTC));
  return upcoming[0] || null;
}

function tickCountdown() {
  const box = $('#countdown');
  const f = nextKickoff();
  if (!f) { box.hidden = true; return; }
  box.hidden = false;

  const ms = new Date(f.dateUTC).getTime() - Date.now();
  if (ms <= 0) { box.hidden = true; return; }

  const t = Math.floor(ms / 1000);
  const dd = Math.floor(t / 86400);
  const hh = Math.floor((t % 86400) / 3600);
  const mm = Math.floor((t % 3600) / 60);
  const ss = t % 60;
  const p2 = (n) => String(n).padStart(2, '0');

  $('#cd-clock').textContent =
    dd > 0 ? `${dd}h ${p2(hh)}:${p2(mm)}:${p2(ss)}`
           : `${p2(hh)}:${p2(mm)}:${p2(ss)}`;
  $('#cd-meta').textContent = `${f.home} vs ${f.away} · ${f.compName}`;
}

/* ==================================================================
   Notifikasi browser
   ================================================================== */
let notifyTimer = null;

function checkNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const lead = CONFIG.notifyLeadMin * 60000;
  const now = Date.now();

  for (const f of state.fixtures) {
    if (state.notified.has(f.id)) continue;
    const kick = new Date(f.dateUTC).getTime();
    if (kick > now && kick - now <= lead) {
      const favMatch = isFav(f.home) || isFav(f.away);
      if (!favMatch) continue;                 // hanya klub favorit
      new Notification(`${f.home} vs ${f.away}`, {
        body: `${f.compName} • ${WIB.format(new Date(f.dateUTC))} ${CONFIG.timeZoneLabel}`,
        tag: f.id,
      });
      state.notified.add(f.id);
    }
  }
}

/* ==================================================================
   Toast
   ================================================================== */
let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('toast--show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('toast--show'), 3200);
}

/* ==================================================================
   Sync
   ================================================================== */
function setSync(stateName, text) {
  const el = $('#sync');
  el.dataset.state = stateName;
  $('#sync-text').textContent = text;
}

async function sync({ force = false, silent = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  state.loadFailed = false;
  setSync('loading', 'Menyinkron…');

  try {
    const res = await loadFixtures({
      force,
      onProgress: ({ done, total }) => {
        if (!silent) setSync('loading', `Mengambil ${done}/${total}`);
      },
    });

    state.fixtures = res.fixtures;
    state.savedAt = res.savedAt || Date.now();
    state.stale = !!res.stale;

    if (res.offline) {
      setSync('offline', 'Offline');
    } else if (res.fromCache) {
      setSync(res.stale ? 'offline' : 'ok', res.stale ? 'Cache lama' : 'Dari cache');
      if (res.stale && !silent) toast('Menampilkan cache lama — sedang offline');
    } else {
      const jam = WIB.format(new Date(state.savedAt));
      setSync('ok', `Diperbarui ${jam}`);
      if (res.fixtures.length === 0 && !silent) {
        toast('Jadwal belum tersedia untuk liga yang dipantau');
      }
    }
    update();
    tickCountdown();
    checkNotifications();
  } catch (err) {
    console.error(err);
    state.loadFailed = true;
    setSync('offline', 'Gagal');
    if (!silent) toast('Gagal mengambil jadwal. Coba lagi nanti.');
    if (state.fixtures.length === 0) renderList([]);
  } finally {
    state.loading = false;
  }
}

/* ==================================================================
   Wiring
   ================================================================== */
function bind() {
  // Grup
  $('#groupstrip').addEventListener('click', (e) => {
    const b = e.target.closest('[data-group]');
    if (!b) return;
    state.group = b.dataset.group;
    update();
  });

  // Kompetisi (multi-select)
  $('#compstrip').addEventListener('click', (e) => {
    const b = e.target.closest('[data-comp]');
    if (!b) return;
    const id = b.dataset.comp;
    if (state.comps.has(id)) state.comps.delete(id); else state.comps.add(id);
    update();
  });

  // Negara / klub
  $('#country').addEventListener('change', (e) => { state.country = e.target.value; update(); });
  $('#team').addEventListener('change', (e) => { state.team = e.target.value; update(); });

  // Rentang hari
  $('#ranges').addEventListener('click', (e) => {
    const b = e.target.closest('[data-range]');
    if (!b) return;
    state.range = Number(b.dataset.range);
    update();
  });

  // Cari
  let qTimer = null;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(qTimer);
    const v = e.target.value;
    qTimer = setTimeout(() => { state.query = v; update(); }, 200);
  });

  // Favorit (delegasi)
  $('#list').addEventListener('click', (e) => {
    const s = e.target.closest('[data-fav]');
    if (!s) return;
    toggleFav(s.dataset.fav);
    update();
    toast(isFav(s.dataset.fav) ? `${s.dataset.fav} masuk favorit` : `${s.dataset.fav} dihapus dari favorit`);
  });

  // Coba lagi saat sync gagal (tombol dirender dinamis di #empty)
  $('#empty').addEventListener('click', (e) => {
    if (e.target.closest('#retry')) sync({ force: true });
  });

  // Favorit saja
  $('#favonly').addEventListener('click', () => {
    state.query = '';
    $('#search').value = '';
    // Toggle cepat: tampilkan hanya match yang involve klub favorit
    const btn = $('#favonly');
    const on = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', String(!on));
    state.favOnly = !on;
    if (state.favOnly && state.favourites.size === 0) {
      toast('Belum ada klub favorit — ketuk ☆ pada kartu match');
      btn.setAttribute('aria-pressed', 'false');
      state.favOnly = false;
    }
    update();
  });

  // Notifikasi. Tombol lonceng di header; aria-pressed menandai
  // statusnya supaya terlihat menyala saat izin sudah diberikan.
  const notifyBtn = $('#notify');
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    notifyBtn.setAttribute('aria-pressed', 'true');
  }
  notifyBtn.addEventListener('click', async () => {
    if (!('Notification' in window)) { toast('Browser ini tidak mendukung notifikasi'); return; }
    const p = await Notification.requestPermission();
    notifyBtn.setAttribute('aria-pressed', String(p === 'granted'));
    toast(p === 'granted'
      ? 'Notifikasi aktif — kami kabari 30 menit sebelum kick-off'
      : 'Notifikasi ditolak browser');
    checkNotifications();
  });

  // Online/offline
  window.addEventListener('online', () => {
    state.online = true;
    toast('Kembali online — menyinkron…');
    sync({ force: true });
  });
  window.addEventListener('offline', () => {
    state.online = false;
    setSync('offline', 'Offline');
  });

  // Auto-refresh tiap 5 menit saat tab terlihat
  setInterval(() => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      sync({ silent: true });
    }
  }, CONFIG.refreshMs);

  // Countdown tiap detik
  cdTimer = setInterval(() => {
    tickCountdown();
    if (Math.floor(Date.now() / 60000) % 2 === 0) checkNotifications();
  }, 1000);

  // Pause countdown saat tab disembunyikan (hemat baterai)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tickCountdown();
  });
}

/* ==================================================================
   Boot
   ================================================================== */
function init() {
  loadPrefs();
  readUrl();
  $('#search').value = state.query;
  bind();
  renderList([]);          // skeleton
  renderFilters();
  markOverflowingStrips();
  sync();

  // Ukur ulang saat ukuran jendela berubah atau font selesai dimuat,
  // karena lebar strip baru final setelah font web selesai.
  window.addEventListener('resize', markOverflowingStrips);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(markOverflowingStrips);
  }

  // Service worker (PWA)
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline tetap jalan tanpa SW */ });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}