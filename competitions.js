/**
 * competitions.js — Klasifikasi kompetisi & identitas visual.
 *
 * Satu tempat untuk menjawab: "ini kompetisi jenis apa, dan bagaimana ia
 * harus TAMPIL?". Dipakai oleh api.js (saat menormalkan data) dan app.js
 * (saat merender kartu), supaya aturan tidak tersebar dan tidak bentrok.
 *
 * Mengapa perlu: sebelumnya semua kartu tampil identik, sehingga laga
 * timnas (Indonesia vs Thailand, final ASEAN Cup) terlihat sama dengan
 * laga klub liga biasa. Pengguna tidak bisa membedakan jenis kompetisi
 * sekilas — itu keluhan yang sah, bukan sekadar selera.
 */

/**
 * Jenis kompetisi. `kind` mengatur TATA LETAK kartu; `key` mengatur
 * warna aksen. Urutan pola PENTING: yang lebih spesifik dulu.
 */
const RULES = [
  // ---- Kompetisi antarnegara (timnas) ----
  { re: /asean|aff\b|suzuki/i,                 key: 'asean',    kind: 'national', label: 'Timnas', group: 'nasional', badge: 'ASE' },
  { re: /world\s*cup|piala\s*dunia|\bwc\b|world\s*cup\s*qual/i, key: 'worldcup', kind: 'national', label: 'Timnas', group: 'nasional', badge: 'WC' },
  { re: /euro\b|uefa\s*euro/i,                 key: 'euro',     kind: 'national', label: 'Timnas', group: 'nasional', badge: 'EUR' },
  { re: /nations\s*league/i,                   key: 'nations',  kind: 'national', label: 'Timnas', group: 'nasional', badge: 'NL' },
  { re: /copa\s*am|conmebol.*america/i,        key: 'copa',     kind: 'national', label: 'Timnas', group: 'nasional', badge: 'CA' },
  { re: /gold\s*cup/i,                         key: 'goldcup',  kind: 'national', label: 'Timnas', group: 'nasional', badge: 'GC' },
  { re: /afcon|africa\s*cup|african\s*cup/i,   key: 'afcon',    kind: 'national', label: 'Timnas', group: 'nasional', badge: 'AFC' },
  { re: /asian\s*cup|asia\s*cup/i,             key: 'asiancup', kind: 'national', label: 'Timnas', group: 'nasional', badge: 'ASC' },
  { re: /olympic|olimpiade/i,                  key: 'olympic',  kind: 'national', label: 'Timnas', group: 'nasional', badge: 'OLY' },
  { re: /friendly|friendlies|persahabatan|international/i, key: 'friendly', kind: 'national', label: 'Uji Coba', group: 'nasional', badge: 'INT' },

  // ---- Piala antarklub Eropa ----
  { re: /champions\s*league|\bucl\b/i,         key: 'ucl',      kind: 'club-cup', label: 'Antarklub', group: 'europa', badge: 'UCL' },
  { re: /europa\s*league|\buel\b/i,            key: 'uel',      kind: 'club-cup', label: 'Antarklub', group: 'europa', badge: 'UEL' },
  { re: /conference\s*league|\buecl\b/i,       key: 'uecl',     kind: 'club-cup', label: 'Antarklub', group: 'europa', badge: 'UEC' },
  { re: /libertadores/i,                       key: 'libert',   kind: 'club-cup', label: 'Antarklub', group: 'amerika', badge: 'LIB' },
  { re: /sudamericana/i,                       key: 'suda',     kind: 'club-cup', label: 'Antarklub', group: 'amerika', badge: 'SUD' },
  { re: /afc\s*champions|champions\s*league\s*elite/i, key: 'afccl', kind: 'club-cup', label: 'Antarklub', group: 'asia', badge: 'AFC' },
  { re: /caf\s*champions/i,                    key: 'cafcl',    kind: 'club-cup', label: 'Antarklub', group: 'africa', badge: 'CFC' },

  // ---- Liga domestik besar (identitas warna khas) ----
  { re: /premier\s*league|\bepl\b/i,           key: 'epl',      kind: 'league', label: 'Liga', group: 'liga', badge: 'EPL' },
  { re: /la\s*liga|laliga/i,                   key: 'laliga',   kind: 'league', label: 'Liga', group: 'liga', badge: 'LAL' },
  { re: /serie\s*a/i,                          key: 'seriea',   kind: 'league', label: 'Liga', group: 'liga', badge: 'SEA' },
  { re: /bundesliga/i,                         key: 'bundes',   kind: 'league', label: 'Liga', group: 'liga', badge: 'BUN' },
  { re: /ligue\s*1/i,                          key: 'ligue1',   kind: 'league', label: 'Liga', group: 'liga', badge: 'LIG' },
  { re: /eredivisie/i,                         key: 'erediv',   kind: 'league', label: 'Liga', group: 'liga', badge: 'ERE' },
  { re: /indonesia|liga\s*1\b/i,               key: 'idn',      kind: 'league', label: 'Liga', group: 'indonesia', badge: 'IDN' },
  { re: /brasileir|brazil/i,                   key: 'brasil',   kind: 'league', label: 'Liga', group: 'amerika', badge: 'BRA' },
  { re: /mls|major\s*league/i,                 key: 'mls',      kind: 'league', label: 'Liga', group: 'amerika', badge: 'MLS' },
  { re: /j[\s.-]*league/i,                     key: 'jleague',  kind: 'league', label: 'Liga', group: 'asia', badge: 'JPN' },
];

/** Kompetisi yang tidak cocok pola apa pun. */
const FALLBACK = { key: 'other', kind: 'league', label: 'Kompetisi', group: 'lainnya', badge: '?' };

/** Buang simbol merek (™ ® ©) dan spasi ganda supaya pola mudah cocok. */
function clean(name) {
  return String(name || '')
    .replace(/[™®©]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Badge 3 huruf dari nama kompetisi bila tidak ada aturan khusus. */
function autoBadge(name) {
  const words = clean(name).split(' ').filter((w) => /^[A-Za-z]/.test(w));
  if (words.length >= 3) return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  if (words.length === 2) return (words[0].slice(0, 2) + words[1][0]).toUpperCase();
  return clean(name).slice(0, 3).toUpperCase() || '?';
}

/**
 * Klasifikasikan sebuah kompetisi.
 * @param {string} name  Nama kompetisi apa adanya dari sumber data.
 * @returns {{key:string,kind:string,label:string,group:string,badge:string}}
 */
export function classifyComp(name) {
  const n = clean(name);
  for (const r of RULES) {
    if (r.re.test(n)) return { key: r.key, kind: r.kind, label: r.label, group: r.group, badge: r.badge };
  }
  return { ...FALLBACK, badge: autoBadge(n) };
}

/**
 * Ambil babak/fase dari nama stage (mis. "Final", "Semi-finals", "Group A").
 * Berguna untuk laga turnamen: "Final" adalah konteks yang wajib terlihat.
 */
export function stageLabel(...candidates) {
  for (const c of candidates) {
    const s = clean(c);
    if (!s) continue;
    // Buang "Group X" yang tidak informatif bila ada kandidat lain,
    // tapi tetap kembalikan apa adanya kalau itu satu-satunya konteks.
    if (/^group\s+[a-z0-9]+$/i.test(s)) continue;
    if (/^(league\s+[a-z]|regular\s+season|table)$/i.test(s)) continue;
    return s;
  }
  for (const c of candidates) {
    const s = clean(c);
    if (s) return s;
  }
  return '';
}

/** Label babak dalam Bahasa Indonesia. */
export function stageID(s) {
  const t = clean(s);
  const map = [
    [/^final$/i, 'Final'],
    [/^semi[\s-]*finals?$/i, 'Semifinal'],
    [/^quarter[\s-]*finals?$/i, 'Perempat Final'],
    [/round of 16|8th finals?/i, '16 Besar'],
    [/round of 32/i, '32 Besar'],
    [/^group\s+([a-z0-9]+)$/i, (m) => `Grup ${m[1].toUpperCase()}`],
    [/qualif/i, 'Kualifikasi'],
    [/play[\s-]*off/i, 'Play-off'],
    [/1st round|first round/i, 'Babak 1'],
  ];
  for (const [re, out] of map) {
    const m = t.match(re);
    if (m) return typeof out === 'function' ? out(m) : out;
  }
  return t;
}
