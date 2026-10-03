/**
 * config.js — SOURCE OF TRUTH BolBolaKu
 *
 * Menambah competitions/klub/negara = tambah 1 baris di sini. Tidak ada kode
 * lain yang perlu disentuh. Semua slug di bawah sudah diuji live terhadap
 * ESPN scoreboard endpoint (lihat docs/BLUEPRINT.md untuk hasil ujinya).
 *
 * Kolom `priority` mengatur urutan tampil: angka lebih kecil = lebih atas.
 * Kompetisi dengan `featured: true` diberi penekanan di UI.
 */

export const CONFIG = {
  appName: 'BolBolaKu',
  version: '1.0.0',

  /** Jendela jadwal yang ditarik dari API.
   *  Hanya hari ini + besok + lusa. Rentang panjang membebani jaringan
   *  tanpa manfaat: pengguna hampir selalu melihat 3 hari terdekat. */
  horizonDays: 3,

  /** TTL cache lokal (ms). 6 jam. */
  cacheTtlMs: 6 * 60 * 60 * 1000,

  /** Interval auto-refresh saat tab aktif (ms). */
  refreshMs: 5 * 60 * 1000,

  /** Kunci cache di localStorage. Bump version kalau bentuk data berubah. */
  cacheKey: 'bolbolaku.fixtures.v2',
  prefsKey: 'bolbolaku.prefs.v1',

  /** Zona waktu tampilan — dikunci WIB (UTC+7) sesuai permintaan. */
  timeZone: 'Asia/Jakarta',
  timeZoneLabel: 'WIB',

  /** Ambang menit untuk notifikasi browser sebelum kick-off. */
  notifyLeadMin: 30,

  /**
   * Endpoint ESPN. Tanpa API key.
   * eventsfor: scoreboard?dates=YYYYMMDD menerima satu tanggal (UTC).
   */
  api: {
    base: 'https://site.api.espn.com/apis/site/v2/sports/soccer',
    timeoutMs: 12000,
    retries: 2,

    /**
     * Sumber KEDUA: FIFA api resmi.
     * Dipakai karena ESPN tidak memuat seluruh turnamen resmi FIFA —
     * mis. FIFA ASEAN Cup (final Indonesia vs Thailand) tidak ada di ESPN.
     * Satu request mencakup SELURUH rentang tanggal, jadi murah.
     */
    fifaBase: 'https://api.fifa.com/api/v3',
    fifaCount: 500,

    /** Offset WIB (menit) untuk mengelompokkan laga per hari lokal. */
    utcOffsetMinutes: 7 * 60,
  },

  /**
   * COMPETITIONS
   * group  : 'liga' | 'eropa' | 'nasional' | 'asia' | 'amerika' | 'cup'
   * slug   : ESPN league slug
   * live   : true  -> terverifikasi punya jadwal saat blueprint ditulis
   *         false -> slot cadangan; otomatis muncul bila ESPN menambah jadwal
   * badge  : 2 huruf untuk badge ringkas
   */
  competitions: [
    // ---------- INDONESIA (paling atas: pengguna utama dari Indonesia) ----------
    { id: 'idn1',     name: 'Liga 1 Indonesia', short: 'IDN',  slug: 'idn.1',  group: 'indonesia', country: 'Indonesia', badge: 'IDN', live: true, priority: 0, featured: true },

    // ---------- Liga Eropa (grup utama) ----------
    { id: 'epl',      name: 'Premier League',   short: 'EPL',  slug: 'eng.1',            group: 'liga',   country: 'England',          badge: 'EN', live: true,  priority: 1 },
    { id: 'laliga',   name: 'LaLiga',           short: 'LAL',  slug: 'esp.1',            group: 'liga',   country: 'Spanyol',          badge: 'ES', live: true,  priority: 2 },
    { id: 'seriea',   name: 'Serie A',          short: 'SEA',  slug: 'ita.1',            group: 'liga',   country: 'Italia',           badge: 'IT', live: true,  priority: 3 },
    { id: 'bundes',   name: 'Bundesliga',       short: 'BUN',  slug: 'ger.1',            group: 'liga',   country: 'Jerman',           badge: 'DE', live: true,  priority: 4 },
    { id: 'ligue1',   name: 'Ligue 1',          short: 'LIG',  slug: 'fra.1',            group: 'liga',   country: 'Prancis',          badge: 'FR', live: true,  priority: 5 },
    { id: 'erediv',   name: 'Eredivisie',       short: 'ERE',  slug: 'ned.1',            group: 'liga',   country: 'Belanda',          badge: 'NL', live: true,  priority: 6 },
    { id: 'laliga2',  name: 'Liga 2',           short: 'L2',   slug: 'esp.2',            group: 'liga',   country: 'Spanyol',          badge: 'ES', live: true,  priority: 7 },
    { id: 'portugal', name: 'Liga Portugal',    short: 'POR',  slug: 'por.1',            group: 'liga',   country: 'Portugal',         badge: 'PT', live: true,  priority: 8 },
    { id: 'scotland', name: 'Scotland',         short: 'SCO',  slug: 'sco.1',            group: 'liga',   country: 'Skotlandia',        badge: 'SC', live: true,  priority: 9 },
    { id: 'belgium',  name: 'Belgian Pro',      short: 'BEL',  slug: 'bel.1',            group: 'liga',   country: 'Belgia',           badge: 'BE', live: true,  priority: 10 },
    { id: 'turkey',   name: 'Super Lig',        short: 'TUR',  slug: 'tur.1',            group: 'liga',   country: 'Turki',            badge: 'TR', live: true,  priority: 11 },
    { id: 'austria',  name: 'Bundesliga AT',    short: 'AUT',  slug: 'aut.1',            group: 'liga',   country: 'Austria',          badge: 'AT', live: true,  priority: 12 },

    // ---------- Liga Amerika & Asia ----------
    { id: 'brasil',   name: 'Brasileirão',      short: 'BRA',  slug: 'bra.1',            group: 'amerika', country: 'Brazil',           badge: 'BR', live: true,  priority: 20 },
    { id: 'mexico',   name: 'Liga MX',          short: 'MEX',  slug: 'mex.1',            group: 'amerika', country: 'Meksiko',          badge: 'MX', live: true,  priority: 21 },
    { id: 'mls',      name: 'MLS',              short: 'MLS',  slug: 'usa.1',            group: 'amerika', country: 'USA',              badge: 'US', live: true,  priority: 22 },
    { id: 'jleague',  name: 'J-League',         short: 'JPN',  slug: 'jpn.1',            group: 'asia',    country: 'Jepang',           badge: 'JP', live: true,  priority: 23 },
    { id: 'aleague',  name: 'A-League',         short: 'AUS',  slug: 'aus.1',            group: 'asia',    country: 'Australia',        badge: 'AU', live: true,  priority: 24 },

    // ---------- Eropa ----------
    { id: 'ucl',      name: 'Champions League', short: 'UCL',  slug: 'uefa.champions',   group: 'europa', country: 'Eropa',            badge: 'UCL', live: true,  priority: 5,  featured: true },
    { id: 'uel',      name: 'Europa League',    short: 'UEL',  slug: 'uefa.europa',      group: 'europa', country: 'Eropa',            badge: 'UEL', live: true,  priority: 6,  featured: true },
    { id: 'uecl',     name: 'Conference Lg',    short: 'UEC',  slug: 'uefa.europa.conf', group: 'europa', country: 'Eropa',            badge: 'UEC', live: true,  priority: 7,  featured: true },

    // ---------- Tim nasional ----------
    { id: 'nat-uefa',  name: 'Nations League',  short: 'NAT',  slug: 'uefa.nations',             group: 'nasional', country: 'Eropa',      badge: 'NAT', live: true,  priority: 30, featured: true },
    { id: 'nat-fifa',  name: 'Friendly Intl',   short: 'INT',  slug: 'fifa.friendly',             group: 'nasional', country: 'Dunia',      badge: 'INT', live: true,  priority: 31, featured: true },
    { id: 'nat-nc',    name: 'CONCACAF Nations', short: 'CNL',  slug: 'concacaf.nations.league',   group: 'nasional', country: 'CONCACAF',   badge: 'CNL', live: true,  priority: 32 },

    // ---------- Asia / Amerika Selatan ----------
    { id: 'afc',      name: 'AFC Champions',    short: 'AFC',  slug: 'afc.champions',            group: 'asia',     country: 'Asia',       badge: 'AFC', live: true,  priority: 40 },
    { id: 'libert',   name: 'Libertadores',     short: 'LIB',  slug: 'conmebol.libertadores',    group: 'amerika',  country: 'Amerika S',  badge: 'LIB', live: true,  priority: 41 },
    { id: 'suda',     name: 'Sudamericana',     short: 'SUD',  slug: 'conmebol.sudamericana',    group: 'amerika',  country: 'Amerika S',  badge: 'SUD', live: true,  priority: 42 },

    // ---------- Turnamen ----------
    { id: 'facup',    name: 'FA Cup',           short: 'FAC',  slug: 'eng.3',                    group: 'cup', country: 'England',  badge: 'FAC', live: true,  priority: 50 },

    // ---------- Slot cadangan (auto-appear bila ESPN menambah jadwal) ----------
    { id: 'afc-asian', name: 'Asian Cup',       short: 'ASC',  slug: 'afc.asian.cup',            group: 'asia',     country: 'Asia',       badge: 'ASC', live: false, priority: 60 },
    { id: 'caf-nat',   name: 'AFCON',           short: 'CAF',  slug: 'caf.nations',              group: 'nasional',  country: 'Afrika',     badge: 'CAF', live: false, priority: 61 },
    { id: 'concagold', name: 'CONCACAF Gold',   short: 'GC',   slug: 'concacaf.gold',            group: 'nasional',  country: 'CONCACAF',   badge: 'GC',  live: false, priority: 62 },
    { id: 'copaam',    name: 'Copa America',    short: 'AM',   slug: 'conmebol.america',         group: 'amerika',   country: 'Amerika S',  badge: 'AM',  live: false, priority: 63 },
    { id: 'worldcup',  name: 'World Cup',       short: 'WC',   slug: 'fifa.world',               group: 'nasional',  country: 'Dunia',      badge: 'WC',  live: false, priority: 64 },
    { id: 'euro',      name: 'Euro',            short: 'EUR',  slug: 'uefa.euro',                group: 'nasional',  country: 'Eropa',      badge: 'EUR', live: false, priority: 65 },
    { id: 'uclq',      name: 'UCL Qualifying',  short: 'UCQ',  slug: 'uefa.champions_qual',     group: 'europa',    country: 'Eropa',      badge: 'UCQ', live: false, priority: 66 },
    { id: 'uelq',      name: 'UEL Qualifying',  short: 'UEQ',  slug: 'uefa.europa_qual',        group: 'europa',    country: 'Eropa',      badge: 'UEQ', live: false, priority: 67 },
    { id: 'copadelrey',name: 'Copa del Rey',    short: 'CDR',  slug: 'esp.copadelrey',           group: 'cup',       country: 'Spanyol',    badge: 'CDR', live: false, priority: 68 },
    { id: 'coppa',     name: 'Coppa Italia',    short: 'CI',   slug: 'ita.coppa',                group: 'cup',       country: 'Italia',     badge: 'CI',  live: false, priority: 69 },
    { id: 'pokal',     name: 'DFB Pokal',       short: 'POK',  slug: 'ger.pok',                  group: 'cup',       country: 'Jerman',     badge: 'POK', live: false, priority: 70 },
    { id: 'cdfm',      name: 'Coupe de France', short: 'CDF',  slug: 'fra.cup',                  group: 'cup',       country: 'Prancis',    badge: 'CDF', live: false, priority: 71 },
    { id: 'knvb',      name: 'KNVB Beker',      short: 'KNB',  slug: 'ned.cup',                  group: 'cup',       country: 'Belanda',    badge: 'KNB', live: false, priority: 72 },
    { id: 'leagucup',  name: 'League Cup',      short: 'PLC',  slug: 'eng.league_cup',           group: 'cup',       country: 'England',    badge: 'PLC', live: false, priority: 73 },
    { id: 'wcq-uefa',  name: 'WCQ UEFA',        short: 'WQU',  slug: 'fifa.worldq.uefa',         group: 'nasional',  country: 'Eropa',      badge: 'WQU', live: false, priority: 74 },
    { id: 'wcq-conm',  name: 'WCQ CONMEBOL',    short: 'WQC',  slug: 'fifa.worldq.conmebol',     group: 'nasional',  country: 'Amerika S',  badge: 'WQC', live: false, priority: 75 },
    { id: 'wcq-conc',  name: 'WCQ CONCACAF',    short: 'WQ3',  slug: 'fifa.worldq.concacaf',     group: 'nasional',  country: 'CONCACAF',   badge: 'WQ3', live: false, priority: 76 },
    { id: 'wcq-afc',   name: 'WCQ AFC',         short: 'WQA',  slug: 'fifa.worldq.afc',          group: 'nasional',  country: 'Asia',       badge: 'WQA', live: false, priority: 77 },
    { id: 'cafchamp',  name: 'CAF Champions',   short: 'CFC',  slug: 'caf.champions',            group: 'africa',    country: 'Afrika',     badge: 'CFC', live: false, priority: 78 },
  ],

  /** Label grup untuk UI. */
  groups: [
    { id: 'semua',     label: 'Semua' },
    { id: 'indonesia', label: 'Indonesia' },
    { id: 'liga',     label: 'Liga' },
    { id: 'europa',   label: 'Eropa' },
    { id: 'nasional', label: 'Tim Nasional' },
    { id: 'asia',     label: 'Asia' },
    { id: 'amerika',  label: 'Amerika' },
    { id: 'africa',   label: 'Afrika' },
    { id: 'cup',      label: 'Piala' },
  ],

  /**
   * TEAM_COUNTRY — memetakan nama tim ke negara untuk filter "Negara".
   * Kunci dicocokkan lowercase. Tim yang tidak ada di sini tetap tampil,
   * hanya tidak punya badge negara.
   */
  teamCountry: {
    // Inggris
    'arsenal': 'England', 'aston villa': 'England', 'brentford': 'England',
    'brighton': 'England', 'burnley': 'England', 'chelsea': 'England',
    'crystal palace': 'England', 'everton': 'England', 'fulham': 'England',
    'leeds united': 'England', 'liverpool': 'England', 'manchester city': 'England',
    'manchester united': 'England', 'newcastle united': 'England', 'nottingham forest': 'England',
    'sunderland': 'England', 'tottenham hotspur': 'England', 'tottenham': 'England',
    'west ham united': 'England', 'wolverhampton': 'England', 'wolves': 'England',
    'coventry city': 'England', 'swansea city': 'England', 'leicester city': 'England',
    // Spanyol
    'real madrid': 'Spanyol', 'barcelona': 'Spanyol', 'atletico madrid': 'Spanyol',
    'sevilla': 'Spanyol', 'real sociedad': 'Spanyol', 'villarreal': 'Spanyol',
    'athletic club': 'Spanyol', 'real betis': 'Spanyol', 'valencia': 'Spanyol',
    'sevilla fc': 'Spanyol', 'espanyol': 'Spanyol', 'málaga': 'Spanyol', 'malaga': 'Spanyol',
    'girona': 'Spanyol', 'celta vigo': 'Spanyol', 'getafe': 'Spanyol', 'osasuna': 'Spanyol',
    'rayo vallecano': 'Spanyol', 'alaves': 'Spanyol',
    // Italia
    'inter': 'Italia', 'ac milan': 'Italia', 'juventus': 'Italia', 'napoli': 'Italia',
    'roma': 'Italia', 'lazio': 'Italia', 'atalanta': 'Italia', 'fiorentina': 'Italia',
    'bologna': 'Italia', 'torino': 'Italia', 'udinese': 'Italia', 'genoa': 'Italia',
    'cagliari': 'Italia', 'verona': 'Italia', 'parma': 'Italia', 'como': 'Italia',
    'spezia': 'Italia', 'empoli': 'Italia',
    // Jerman
    'bayern munich': 'Jerman', 'bayern münchen': 'Jerman', 'borussia dortmund': 'Jerman',
    'bayer leverkusen': 'Jerman', 'rb leipzig': 'Jerman', 'leipzig': 'Jerman',
    'vfb stuttgart': 'Jerman', 'eintracht frankfurt': 'Jerman', 'werder bremen': 'Jerman',
    'borussia monchengladbach': 'Jerman', 'freiburg': 'Jerman', 'wolfsburg': 'Jerman',
    'mainz 05': 'Jerman', 'augsburg': 'Jerman', 'heidenheim': 'Jerman', 'st. pauli': 'Jerman',
    '1. fc union berlin': 'Jerman', 'hamburger sv': 'Jerman',
    // Prancis
    'paris saint-germain': 'Prancis', 'psg': 'Prancis', 'marseille': 'Prancis',
    'lyon': 'Prancis', 'lens': 'Prancis', 'monaco': 'Prancis', 'nice': 'Prancis',
    'lille': 'Prancis', 'rennes': 'Prancis', 'strasbourg': 'Prancis', 'brest': 'Prancis',
    'auxerre': 'Prancis', 'angers': 'Prancis', 'le havre': 'Prancis', 'nantes': 'Prancis',
    'toulouse': 'Prancis',
    // Belanda
    'psv eindhoven': 'Belanda', 'ajax': 'Belanda', 'feyenoord': 'Belanda',
    'az alkmaar': 'Belanda', 'az': 'Belanda', 'twente': 'Belanda', 'utrecht': 'Belanda',
    'heerenveen': 'Belanda', 'groningen': 'Belanda', 'sparta rotterdam': 'Belanda',
    'nec nijmegen': 'Belanda', 'go ahead eagles': 'Belanda', 'fortuna sitard': 'Belanda',
    // Portugal
    'benfica': 'Portugal', 'porto': 'Portugal', 'sporting cp': 'Portugal', 'sporting': 'Portugal',
    'braga': 'Portugal', 'vitesse guimaraes': 'Portugal', 'famicao': 'Portugal',
    // Skotlandia
    'celtic': 'Skotlandia', 'rangers': 'Skotlandia', 'aberdeen': 'Skotlandia',
    'hearts': 'Skotlandia', 'hibs': 'Skotlandia', 'dundee': 'Skotlandia',
    'motherwell': 'Skotlandia', 'kilmarnock': 'Skotlandia',
    // Turki
    'galatasaray': 'Turki', 'fenerbahce': 'Turki', 'fenerbahçe': 'Turki', 'besiktas': 'Turki',
    'beşiktaş': 'Turki', 'trabzonspor': 'Turki', 'basaksehir': 'Turki', 'samsunspor': 'Turki',
    'rizespor': 'Turki', 'goztepe': 'Turki',
    // Belgia
    'anderlecht': 'Belgia', 'club brugge': 'Belgia', 'genk': 'Belgia', 'standard liege': 'Belgia',
    'gent': 'Belgia', 'copenhagen': 'Belanda', 'agf': 'Belanda', 'midtjylland': 'Denmark',
    // Meksiko
    'america': 'Meksiko', 'guadalajara': 'Meksiko', 'cruz azul': 'Meksiko', 'toluca': 'Meksiko',
    'pumas': 'Meksiko', 'tigres': 'Meksiko', 'monterrey': 'Meksiko', 'leon': 'Meksiko',
    // Amerika Selatan
    'flamengo': 'Brazil', 'palmeiras': 'Brazil', 'corinthians': 'Brazil', 'santos': 'Brazil',
    'gremio': 'Brazil', 'internacional': 'Brazil', 'sao paulo': 'Brazil', 'são paulo': 'Brazil',
    'vasco da gama': 'Brazil', 'fluminense': 'Brazil', 'botafogo': 'Brazil', 'cruzeiro': 'Brazil',
    'atletico mineiro': 'Brazil', 'athletico paranaense': 'Brazil', 'fortaleza': 'Brazil',
    'rivers plate': 'Argentina', 'boca juniors': 'Argentina', 'independiente': 'Argentina',
    'san lorenzo': 'Argentina', 'estudiantes': 'Argentina', 'club america': 'Meksiko',
    // Asia
    'alhilal': 'Arab Saudi', 'al nassr': 'Arab Saudi', 'al ittihad': 'Arab Saudi',
    'al ain': 'UAE', 'sadd': 'Qatar', 'urawa reds': 'Jepang', 'kawasaki': 'Jepang',
    'yokohama': 'Jepang', 'gamba osaka': 'Jepang', 'vissel kobe': 'Jepang',
    'jeonbuk': 'Korea Selatan', 'ulsan': 'Korea Selatan', 'seoul e-l': 'Korea Selatan',
    'shandong': 'China', 'shanghai port': 'China', 'cavalier': 'China',
    'pakhtakor': 'Uzbekistan', 'agf': 'Denmark',
    // Australia
    'melbourne city': 'Australia', 'sydney fc': 'Australia', 'western united': 'Australia',
    'brisbane roar': 'Australia', 'adelaide united': 'Australia',
    // Austria
    'red bull salzburg': 'Austria', 'sturm graz': 'Austria', 'rapid wien': 'Austria',
    'austria wien': 'Austria', 'lask': 'Austria', 'wacker': 'Austria',
  },

  /**
   * NATIONAL_TEAMS — timnas yang punya jadwal di feed 'nasional'
   * (dari uji live). Dipakai untuk label cepat.
   */
  nationalTeams: [
    'England', 'Spain', 'France', 'Germany', 'Portugal', 'Netherlands', 'Italy',
    'Brazil', 'Argentina', 'Uruguay', 'Colombia', 'Chile', 'Paraguay', 'Peru',
    'Morocco', 'Senegal', 'Nigeria', 'Egypt', 'Algeria', 'South Korea', 'Japan',
    'United States', 'Mexico', 'Belgium', 'Türkiye', 'Turkey', 'Croatia', 'Denmark',
    'Switzerland', 'Austria', 'Poland', 'Serbia', 'Sweden', 'Norway', 'Ukraine',
    'Kazakhstan', 'Cyprus', 'Armenia', 'Latvia', 'Montenegro', 'Bosnia-Herzegovina',
    'Faroe Islands', 'Moldova', 'Slovakia', 'Honduras', 'Guatemala', 'Suriname',
    'Congo DR', 'Uganda', 'China', 'Palestine', 'Mauritius', 'Sri Lanka', 'Fiji',
    'Vanuatu', 'Paraguay', 'Korea Republic', 'Republic of Ireland', 'Ghana', 'Côte d\'Ivoire',
  ],
};

/** Helper: ambil competitions yang punya jadwal terverifikasi. */
export const liveCompetitions = () =>
  CONFIG.competitions.filter((c) => c.live).sort((a, b) => a.priority - b.priority);
