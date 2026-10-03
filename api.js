/**
 * api.js — Ambil jadwal, dengan cache berlapis.
 *
 * Tanggung jawab: JANGAN menyentuh DOM. Hanya mengembalikan data.
 * Pemisahan ini yang membuat filter/render bisa diuji terpisah
 * (skill: frontend-ui-engineering — "separate data fetching from presentation").
 *
 * Jalur pengambilan, dari yang paling andal:
 *   1. Cache lokal yang masih segar        (instan, tanpa jaringan)
 *   2. Proxy lokal /api/fixtures           (satu origin, satu cache bersama)
 *   3. ESPN langsung                       (kalau app dibuka tanpa server)
 *   4. Cache lama                          (offline / semua jaringan gagal)
 *
 * Kalau semuanya kosong, kembalikan array kosong dan biarkan UI
 * menampilkan keadaan yang jujur — bukan layar kosong yang menyesatkan.
 */

import { CONFIG } from './config.js';

/* ==================================================================
   Cache
   ================================================================== */
function cacheRead() {
  try {
    const raw = localStorage.getItem(CONFIG.cacheKey);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || !Array.isArray(p.fixtures)) return null;
    return { ...p, stale: Date.now() - p.savedAt > CONFIG.cacheTtlMs };
  } catch {
    return null;
  }
}

function cacheWrite(fixtures) {
  try {
    localStorage.setItem(
      CONFIG.cacheKey,
      JSON.stringify({ savedAt: Date.now(), fixtures })
    );
  } catch {
    /* Kuota penuh atau storage diblokir — cache pelengkap, bukan syarat. */
  }
}

/* ==================================================================
   Fetch
   ================================================================== */
async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJSON(url, attempt = 0) {
  try {
    const resp = await fetchWithTimeout(url, CONFIG.api.timeoutMs);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return await resp.json();
  } catch (err) {
    if (attempt < CONFIG.api.retries) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      return fetchJSON(url, attempt + 1);
    }
    throw err;
  }
}

/** YYYYMMDD dalam UTC — ESPN memakai basis UTC untuk scoreboard. */
function ymdUTC(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function dateRange(days) {
  const today = new Date();
  const out = [];
  for (let i = 0; i < days; i++) {
    out.push(ymdUTC(new Date(today.getTime() + i * 86400000)));
  }
  return out;
}

/* ==================================================================
   Normalisasi
   ================================================================== */
/**
 * Ubah satu event ESPN menjadi bentuk internal BolBolaKu.
 *comp(compId) dipakai untuk mengisi metadata kompetisi; kalau nullptr
 * (event dari liga yang tidak terdaftar) tetapkan null — UI akan
 * menandainya "lainnya", bukan menyembunyikannya diam-diam.
 */
function normalize(ev, comp) {
  const c = ev.competitions?.[0];
  const competitors = c?.competitors || [];
  if (competitors.length < 2) return null;

  const home = competitors.find((x) => x.homeAway === 'home') || competitors[0];
  const away = competitors.find((x) => x.homeAway === 'away') || competitors[1];

  const statusType = ev.status?.type || {};
  const state = statusType.state || 'pre';            // pre | in | post
  const finished = state === 'post';

  // Skor hanya tampil kalau pertandingan sudah dimulai.
  const started = state !== 'pre';
  const toNum = (x) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  };
  const hScore = started ? toNum(home.score) : null;
  const aScore = started ? toNum(away.score) : null;
  const showScore = started && hScore !== null && aScore !== null;

  return {
    id: String(ev.id),
    compId: comp ? comp.id : null,
    compName: comp ? comp.name : (ev.league?.name || 'Lainnya'),
    compShort: comp ? comp.short : (ev.league?.abbreviation || '?'),
    compGroup: comp ? comp.group : 'lainnya',
    compBadge: comp ? comp.badge : (ev.league?.abbreviation || '?'),
    compCountry: comp ? (comp.country || '') : '',
    dateUTC: ev.date,
    home: home.team?.displayName || home.team?.shortDisplayName || '?',
    away: away.team?.displayName || away.team?.shortDisplayName || '?',
    // Logo kresta: pembeda terbesar antara tampilan amatir dan profesional.
    // ESPN menyediakannya per tim di scoreboard (team.logo).
    homeLogo: home.team?.logo || (home.team?.logos || [])[0]?.href || '',
    awayLogo: away.team?.logo || (away.team?.logos || [])[0]?.href || '',
    homeColor: home.team?.color ? '#' + home.team.color : '',
    awayColor: away.team?.color ? '#' + away.team.color : '',
    homeScore: showScore ? hScore : null,
    awayScore: showScore ? aScore : null,
    state,
    finished,
    detail: statusType.shortDetail || statusType.detail || '',
    venue: c?.venue?.fullName || '',
  };
}

/* ==================================================================
   Jalur 2: proxy lokal
   ================================================================== */
async function viaProxy(comps, onProgress) {
  const slugs = comps.map((c) => c.slug);
  // Path RELATIF ke halaman, bukan absolut "/api/...".
  //  - Di lokal (server di root) keduanya sama.
  //  - Di GitHub Pages halaman disajikan dari /<repo>/, sehingga path
  //    absolut akan menunjuk domain root dan 404.
  //  - Modul ini juga di-import secara dinamis, dan pada import() base
  //    URL bukan "/" melainkan lokasi api.js itu sendiri.
  // Relative path menyelesaikan ketiganya dengan benar.
  const url = './api/fixtures?days=' + CONFIG.horizonDays +
              '&leagues=' + encodeURIComponent(slugs.join(','));
  const json = await fetchJSON(url);
  onProgress?.({ done: comps.length, total: comps.length, found: json.count || 0 });
  return json.events || [];
}

/* ==================================================================
   Jalur 3: ESPN langsung
   ================================================================== */
async function viaDirect(comps, onProgress) {
  const days = dateRange(CONFIG.horizonDays);
  const jobs = [];
  for (const c of comps) for (const d of days) jobs.push({ c, d });

  const out = [];
  let done = 0;
  let cursor = 0;
  // Mode ini adalah SATU-SATUNYA jalur di deploy statis (tanpa backend),
  // jadi ia harus cukup gesit: 27 liga x 14 hari = 378 permintaan.
  // 12 paralel menjaga waktu muat tetap beberapa detik tanpa membanjiri ESPN.
  const LIMIT = 12;

  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      try {
        const url = `${CONFIG.api.base}/${job.c.slug}/scoreboard?dates=${job.d}`;
        const data = await fetchJSON(url);
        for (const ev of (data.events || [])) {
          const n = normalize(ev, job.c);
          if (n) out.push(n);
        }
      } catch {
        /* Satu hari/liga gagal tidak boleh menggagalkan seluruh sync. */
      }
      done++;
      onProgress?.({ done, total: jobs.length, found: out.length });
    }
  }

  await Promise.all(Array.from({ length: LIMIT }, worker));
  return out;
}

/* ==================================================================
   Public API
   ================================================================== */
export async function loadFixtures({ onProgress, force = false } = {}) {
  const cached = cacheRead();

  if (cached && !cached.stale && !force) {
    return { fixtures: cached.fixtures, fromCache: true, stale: false, savedAt: cached.savedAt };
  }

  if (!navigator.onLine) {
    if (cached) {
      return { fixtures: cached.fixtures, fromCache: true, stale: true,
               savedAt: cached.savedAt, offline: true };
    }
    return { fixtures: [], fromCache: false, stale: true, savedAt: 0, offline: true };
  }

  const comps = CONFIG.competitions.filter((c) => c.live);
  const byId = new Map(comps.map((c) => [c.id, c]));

  const finish = (list, extra) => {
    // Buang duplikat: satu event bisa muncul di lebih dari satu endpoint.
    const seen = new Set();
    const fixtures = list
      .filter((f) => {
        const key = f.id || (f.home + f.away + f.dateUTC);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.dateUTC.localeCompare(b.dateUTC));

    if (fixtures.length) cacheWrite(fixtures);
    return {
      fixtures,
      fromCache: false,
      stale: false,
      savedAt: Date.now(),
      partial: fixtures.length === 0,
      ...(extra || {}),
    };
  };

  // --- Jalur utama: proxy lokal ---
  let proxyEvents = null;
  try {
    proxyEvents = await viaProxy(comps, onProgress);
  } catch {
    proxyEvents = null;   // Lanjut ke fallback, jangan menggagalkan sync
  }

  if (proxyEvents) {
    const slugToComp = new Map(comps.map((c) => [c.slug, c]));
    const list = proxyEvents
      .map((ev) => {
        // Server menyisipkan league.slug; kalau event datang dari cache
        // versi lama, fall back ke pencocokan nama liga yang sama.
        const slug = ev.league?.slug;
        const comp = slugToComp.get(slug) || null;
        return normalize(ev, comp);
      })
      .filter(Boolean);
    if (list.length) return finish(list);
    // Proxy hidup tapi kosong: pakai cache lama daripada blank.
    if (cached) {
      return { fixtures: cached.fixtures, fromCache: true, stale: true, savedAt: cached.savedAt };
    }
    return finish([], {});
  }

  // --- Fallback: ESPN langsung ---
  try {
    const list = await viaDirect(comps, onProgress);
    if (list.length) return finish(list, { viaDirect: true });
  } catch {
    /* Falls through ke cache */
  }

  // --- Cache lama ---
  if (cached) {
    return { fixtures: cached.fixtures, fromCache: true, stale: true, savedAt: cached.savedAt };
  }

  return { fixtures: [], fromCache: false, stale: true, savedAt: 0, empty: true };
}