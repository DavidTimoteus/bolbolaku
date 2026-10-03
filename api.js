/**
 * api.js — Ambil jadwal dari BEBERAPA sumber, lalu gabungkan.
 *
 * Tanggung jawab: JANGAN menyentuh DOM. Hanya mengembalikan data.
 * Pemisahan ini yang membuat filter/render bisa diuji terpisah
 * (skill: frontend-ui-engineering — "separate data fetching from presentation").
 *
 * MENGAPA MULTI-SUMBER
 * Satu sumber selalu punya lubang. Contoh nyata: ESPN tidak memuat jadwal
 * FIFA ASEAN Cup 2026 (final Indonesia vs Thailand), padahal itu turnamen
 * resmi FIFA yang sedang berlangsung. Sebaliknya ESPN lebih kaya kresta
 * klub. Karena itu kita gabungkan:
 *
 *   1. Cache lokal segar            (instan)
 *   2. Proxy lokal /api/fixtures    (satu origin, kalau dijalankan lokal)
 *   3. ESPN langsung                (kresta klub, banyak liga)
 *   4. FIFA api.fifa.com langsung   (turnamen resmi, SATU request untuk
 *                                    seluruh rentang — sangat efisien)
 *   → hasil 3 & 4 digabung + dedupe
 *   5. Cache lama                   (offline)
 *
 * Sumber 3 dan 4 dijalankan PARALEL, jadi kegagalan salah satu tidak
 * memperlambat atau menggagalkan yang lain.
 */

import { CONFIG } from './config.js';
import { classifyComp, stageLabel, stageID } from './competitions.js';

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

/** Kunci hari (YYYY-MM-DD) dari string ISO — dipakai untuk dedupe. */
function dayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return new Date(d.getTime() + CONFIG.api.utcOffsetMinutes * 60000)
    .toISOString().slice(0, 10);
}

/** Normalisasi nama tim untuk pencocokan antar-sumber. */
function teamKey(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // buang diakritik
    .replace(/\b(fc|cf|sc|ac|afc|fk|sk|cd|ud|sv|if|bk)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/** Kunci unik sebuah laga lintas-sumber. */
function matchKey(f) {
  const t = [teamKey(f.home), teamKey(f.away)].sort().join('|');
  return dayKey(f.dateUTC) + '::' + t;
}

/* ==================================================================
   Normalisasi — ESPN
   ================================================================== */
/**
 * Ubah satu event ESPN menjadi bentuk internal BolBolaKu.
 * `comp` dipakai mengisi metadata kompetisi; kalau null (liga tak terdaftar)
 * kita tetap klasifikasi dari nama liga supaya kartu tidak kehilangan
 * identitas visual.
 */
function normalizeEspn(ev, comp) {
  const c = ev.competitions?.[0];
  const competitors = c?.competitors || [];
  if (competitors.length < 2) return null;

  const home = competitors.find((x) => x.homeAway === 'home') || competitors[0];
  const away = competitors.find((x) => x.homeAway === 'away') || competitors[1];

  const statusType = ev.status?.type || {};
  const state = statusType.state || 'pre';            // pre | in | post
  const finished = state === 'post';

  const started = state !== 'pre';
  const toNum = (x) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  };
  const hScore = started ? toNum(home.score) : null;
  const aScore = started ? toNum(away.score) : null;
  const showScore = started && hScore !== null && aScore !== null;

  const compName = comp ? comp.name : (ev.league?.name || 'Lainnya');
  const cls = classifyComp(compName);
  // Grup dari config bersifat OTORITATIF untuk ESPN: kalau config sudah
  // menandai sebuah kompetisi sebagai 'nasional', jangan biarkan pola nama
  // menurunkannya jadi 'liga'. Tanpa ini, chip "Tim Nasional" (dari grup)
  // dan chip "Timnas" (dari jenis) menampilkan ANGKA BERBEDA untuk hal yang
  // sama — terlihat seperti data rusak.
  if (comp && comp.group === 'nasional') {
    cls.kind = 'national';
    cls.group = 'nasional';
  }

  return {
    id: 'espn-' + String(ev.id),
    compId: comp ? comp.id : null,
    compName,
    compShort: comp ? comp.short : (ev.league?.abbreviation || cls.badge),
    compGroup: comp ? comp.group : cls.group,
    compBadge: comp ? comp.badge : cls.badge,
    compCountry: comp ? (comp.country || '') : '',
    compKind: cls.kind,
    compKey: cls.key,
    compLabel: cls.label,
    stage: '',
    dateUTC: ev.date,
    home: home.team?.displayName || home.team?.shortDisplayName || '?',
    away: away.team?.displayName || away.team?.shortDisplayName || '?',
    // Logo kresta: pembeda terbesar antara tampilan amatir dan profesional.
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
    city: '',
    source: 'espn',
  };
}

/* ==================================================================
   Normalisasi — FIFA
   ================================================================== */
/** Ambil deskripsi dari array lokal FIFA ([{Locale, Description}]). */
function fifaText(arr) {
  if (!Array.isArray(arr) || !arr.length) return '';
  const en = arr.find((x) => /en/i.test(x.Locale || '')) || arr[0];
  return en.Description || '';
}

/** Ganti placeholder {format}/{size} pada URL gambar FIFA. */
function fifaLogo(side) {
  const url = side?.PictureUrl || '';
  if (!url) return '';
  // Format yang benar-benar mengembalikan PNG adalah 'sq' (persegi);
  // 'png' mengembalikan respons kosong. Diverifikasi dengan curl.
  return url.replace('{format}', 'sq').replace('{size}', '3');
}

/**
 * Ubah satu match FIFA menjadi bentuk internal.
 * Status FIFA: 0 = selesai, 3 = sedang berlangsung, lainnya = terjadwal.
 */
function normalizeFifa(m) {
  const home = m.Home || {};
  const away = m.Away || {};
  const homeName = fifaText(home.TeamName);
  const awayName = fifaText(away.TeamName);
  if (!homeName || !awayName) return null;

  const status = m.MatchStatus;
  const finished = status === 0;
  const live = status === 3;
  const state = finished ? 'post' : (live ? 'in' : 'pre');

  const hScore = Number.isFinite(m.HomeTeamScore) ? m.HomeTeamScore : null;
  const aScore = Number.isFinite(m.AwayTeamScore) ? m.AwayTeamScore : null;

  const compName = fifaText(m.CompetitionName) || 'FIFA';
  const cls = classifyComp(compName);
  // Babak: StageName sering hanya mengulang nama kompetisi; GroupName memuat
  // "Final"/"Group A". Ambil yang paling informatif.
  let stage = stageID(stageLabel(fifaText(m.GroupName), fifaText(m.StageName)));
  // Beberapa sumber mengisi stage dengan nama kompetisi itu sendiri
  // ("Friendlies 1" untuk kompetisi "Friendlies") — mubazir dan
  // membingungkan, jadi dibuang.
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  if (stage && norm(compName).startsWith(norm(stage).replace(/\d+$/, ''))) stage = '';

  return {
    id: 'fifa-' + String(m.IdMatch),
    compId: 'fifa-' + String(m.IdCompetition || ''),
    compName,
    compShort: cls.badge,
    compGroup: cls.group,
    compBadge: cls.badge,
    compCountry: '',
    compKind: cls.kind,
    compKey: cls.key,
    compLabel: cls.label,
    stage,
    dateUTC: m.Date,
    home: homeName,
    away: awayName,
    homeLogo: fifaLogo(home),
    awayLogo: fifaLogo(away),
    homeColor: '',
    awayColor: '',
    homeScore: finished || live ? hScore : null,
    awayScore: finished || live ? aScore : null,
    state,
    finished,
    detail: live ? (m.MatchTime || '') : (finished ? 'Selesai' : ''),
    venue: fifaText(m.Stadium?.Name),
    city: fifaText(m.Stadium?.CityName),
    source: 'fifa',
  };
}

/* ==================================================================
   Sumber 2: proxy lokal (opsional — hanya saat dijalankan lokal)
   ================================================================== */
async function viaProxy(comps, onProgress) {
  const slugs = comps.map((c) => c.slug);
  // Path RELATIF ke halaman, bukan absolut "/api/...". Di GitHub Pages
  // halaman disajikan dari /<repo>/, sehingga path absolut akan 404.
  const url = './api/fixtures?days=' + CONFIG.horizonDays +
              '&leagues=' + encodeURIComponent(slugs.join(','));
  const json = await fetchJSON(url);
  onProgress?.({ done: comps.length, total: comps.length, found: json.count || 0 });
  return json.events || [];
}

/* ==================================================================
   Sumber 3: ESPN langsung
   ================================================================== */
async function viaEspnDirect(comps, onProgress) {
  const days = dateRange(CONFIG.horizonDays);
  const jobs = [];
  for (const c of comps) for (const d of days) jobs.push({ c, d });

  const out = [];
  let done = 0;
  let cursor = 0;
  // 12 paralel menjaga waktu muat tetap beberapa detik tanpa membanjiri ESPN.
  const LIMIT = 12;

  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      try {
        const url = `${CONFIG.api.base}/${job.c.slug}/scoreboard?dates=${job.d}`;
        const data = await fetchJSON(url);
        for (const ev of (data.events || [])) {
          const n = normalizeEspn(ev, job.c);
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
   Sumber 4: FIFA langsung (satu request untuk seluruh rentang)
   ================================================================== */
async function viaFifa(onProgress) {
  const days = dateRange(CONFIG.horizonDays);
  const first = days[0];
  const last = days[days.length - 1];
  const iso = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  const url = `${CONFIG.api.fifaBase}/calendar/matches`
    + `?from=${iso(first)}T00:00:00Z&to=${iso(last)}T23:59:59Z`
    + `&count=${CONFIG.api.fifaCount}&language=en`;

  const json = await fetchJSON(url);
  const rows = Array.isArray(json?.Results) ? json.Results : [];
  const out = [];
  for (const m of rows) {
    const n = normalizeFifa(m);
    if (n) out.push(n);
  }
  onProgress?.({ done: 1, total: 1, found: out.length, source: 'fifa' });
  return out;
}

/* ==================================================================
   Penggabungan
   ================================================================== */
/**
 * Gabungkan hasil beberapa sumber. ESPN diutamakan (kresta klub lebih
 * lengkap); FIFA mengisi laga yang tidak ada di ESPN — inilah yang
 * memunculkan turnamen seperti FIFA ASEAN Cup.
 */
function mergeSources(espnList, fifaList) {
  const seen = new Map();
  const add = (f) => {
    const k = matchKey(f);
    const prev = seen.get(k);
    if (!prev) { seen.set(k, f); return; }
    // Sudah ada: lengkapi field yang kosong dari sumber lain, jangan buang.
    for (const field of ['homeLogo', 'awayLogo', 'venue', 'city', 'stage', 'detail']) {
      if (!prev[field] && f[field]) prev[field] = f[field];
    }
    if (prev.homeScore === null && f.homeScore !== null) {
      prev.homeScore = f.homeScore;
      prev.awayScore = f.awayScore;
      prev.state = f.state;
      prev.finished = f.finished;
    }
    // Pertahankan daftar sumber yang berkontribusi.
    prev.sources = Array.from(new Set([...(prev.sources || [prev.source]), f.source]));
  };

  for (const f of espnList) add(f);
  for (const f of fifaList) add(f);

  const list = Array.from(seen.values());
  for (const f of list) if (!f.sources) f.sources = [f.source];
  return list.sort((a, b) => String(a.dateUTC).localeCompare(String(b.dateUTC)));
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

  const finish = (list, extra) => {
    const fixtures = list.filter((f) => f && f.home && f.away);
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

  // --- ESPN: coba proxy dulu (cepat di lokal), lalu langsung ---
  const getEspn = async () => {
    try {
      const evs = await viaProxy(comps, onProgress);
      if (evs && evs.length) {
        const slugToComp = new Map(comps.map((c) => [c.slug, c]));
        return evs.map((ev) => {
          const slug = ev.league?.slug;
          return normalizeEspn(ev, slugToComp.get(slug) || null);
        }).filter(Boolean);
      }
    } catch { /* proxy tidak ada (deploy statis) — lanjut langsung */ }
    return viaEspnDirect(comps, onProgress);
  };

  // ESPN & FIFA berjalan PARALEL.
  const [espnRes, fifaRes] = await Promise.allSettled([getEspn(), viaFifa(onProgress)]);
  const espnList = espnRes.status === 'fulfilled' ? espnRes.value : [];
  const fifaList = fifaRes.status === 'fulfilled' ? fifaRes.value : [];

  const merged = mergeSources(espnList, fifaList);
  if (merged.length) {
    return finish(merged, {
      viaDirect: espnList.length > 0,
      viaFifa: fifaList.length > 0,
      counts: { espn: espnList.length, fifa: fifaList.length, total: merged.length },
    });
  }

  // --- Semua sumber gagal: pakai cache lama daripada layar kosong ---
  if (cached) {
    return { fixtures: cached.fixtures, fromCache: true, stale: true, savedAt: cached.savedAt };
  }

  return { fixtures: [], fromCache: false, stale: true, savedAt: 0, empty: true };
}
