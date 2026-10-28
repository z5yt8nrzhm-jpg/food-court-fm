import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Play, Pause, Volume2, VolumeX, Users, Mic, Trash2, X, Send, Lock, Moon, Clock, Heart, Rocket, Newspaper, Sparkles, Mail, Phone } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   FOOD COURT FM
   ═══════════════════════════════════════════════════════════ */

const BLOCK = 3, BLOCK_SEC = BLOCK * 3600;
const EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0);   // a Thursday midnight UTC
const ROTA_OFFSET = 32;                         // (Thu=4 × 24h) ÷ 3h
const PRODUCER_KEY = 'lowerlevel';

/* Point this at a proxy (see worker.js) if you ever want live scripts for a
   public audience without shipping a key to strangers. */
const API_ENDPOINT = 'https://api.anthropic.com/v1/messages';

const gs = () => (Date.now() - EPOCH) / 1000;
const blockNum = (g) => Math.floor(g / BLOCK_SEC);
const rotaIdx = (g) => (((blockNum(g) + ROTA_OFFSET) % 56) + 56) % 56;
const blockElapsed = (g) => ((g % BLOCK_SEC) + BLOCK_SEC) % BLOCK_SEC;
const utcHour = (g) => ((Math.floor(g / 3600) % 24) + 24) % 24;
const clock = (s) => { s = Math.max(0, Math.floor(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const F = {
  sign: "'Lilita One','Arial Black',sans-serif",
  body: "'Poppins',system-ui,sans-serif",
  mono: "'DM Mono','Courier New',monospace",
};

/* ── lore, for the hosts only — never shown on the face ───── */
const LORE = `THE BUILDING: Food Court FM broadcasts from the lower level of a mall that never closes,
built on top of a VALUDOME big-box store that shut in 1999. They kept the original food court exactly
as it was — same tiles, same trays, same fountain, same buzzing sign. The hosts treat this as normal.

THE THIRD ESCALATOR: there are two escalators. Everyone talks about the third one. Nobody has ever
said where it goes or why its sign is blank. Mention it casually, the way you mention a person
everyone at the table knows. NEVER explain it, never treat it as a mystery. If a listener gets close,
change the subject warmly.

THE STUDIO: BRICK runs the board and has never spoken on air. DEE produces and supplies facts that are
often wrong and somehow still correct. There is an intern nobody has named. Talk sideways to them
mid-link — one short aside at most, then get back to it. They never answer.

THE TRAY CLUB: the fan group. They camp by the fountain, carry original VALUDOME trays as ID, and keep
spreadsheets of everything said on air. The staff are flattered and faintly alarmed.`;

/* ── palettes, one per desk host ──────────────────────────── */
const THEMES = {
  vexa: { bg: '#FF2E93', dots: '#FFC531', panel: '#FFF3E0', on: '#2B0B3F', line: '#2B0B3F', accent: '#12D6C4', hi: '#FFC531', hot: '#FF5C39', board: '#2B0B3F', boardOn: '#FFF3E0' },
  bloop: { bg: '#FFA8D5', dots: '#FFF3E0', panel: '#FFF8F0', on: '#42184A', line: '#42184A', accent: '#FFC531', hi: '#FF66B8', hot: '#FF7EAF', board: '#42184A', boardOn: '#FFF8F0' },
  noct: { bg: '#1E0730', dots: '#FF2E93', panel: '#33124E', on: '#FFEFE2', line: '#0C0216', accent: '#12D6C4', hi: '#FF2E93', hot: '#FF6FA8', board: '#0C0216', boardOn: '#FFEFE2' },
};

/* ── on-air staff ─────────────────────────────────────────── */
const HOSTS = [
  {
    id: 'vexa', name: 'VEXA-9', block: 'OVERTIME', flagship: 'THE RUSH', desk: true,
    tag: 'three eyes, zero chill', skin: '#12D6C4', eyes: 3, antenna: 2, body: [23, 22],
    voice: { rate: 1.26, pitch: 1.5 },
    from: 'a plasma moon that fell out of orbit and got over it',
    persona: 'Loud, fast, short punchy bursts. Treats everything like the last two minutes of a tied game. Gets human mall vocabulary slightly wrong with total confidence. Calls BLOOP "little guy", needles NOCT for being slow, does not trust DEE\'s facts. Never mean, never crude.',
    bits: [
      { at: 20, name: 'LOUDEST THING I HEARD', sting: 'hit', brief: 'The loudest sound you heard this week somewhere in the galaxy. Compare it to something small and human.' },
      { at: 45, name: 'TWO MINUTE WARNING', sting: 'hit', brief: 'Hype the back half of the hour like a coach at halftime. Fast.' },
    ],
  },
  {
    id: 'bloop', name: 'BLOOP', block: 'THE SHALLOW END', flagship: 'SLOW LAP', desk: true,
    tag: 'soft, damp, encouraging', skin: '#FF66B8', eyes: 2, antenna: 1, body: [24, 21],
    voice: { rate: .82, pitch: .78 },
    from: 'a warm shallow sea, brought a cup of it along',
    persona: 'Gentle and sleepy. Long soft sentences. Kind without being syrupy. Fascinated by ordinary human details. Sometimes forgets which planet it is on and corrects itself. Worries about VEXA-9 out loud and thanks BRICK for things BRICK did not do.',
    bits: [
      { at: 20, name: 'SOMETHING SMALL', sting: 'soft', brief: 'Notice one very small ordinary human thing and find it quietly amazing.' },
      { at: 45, name: 'THE LONG WAY', sting: 'soft', brief: 'Encourage anyone taking the slow route through their day.' },
    ],
  },
  {
    id: 'noct', name: 'NOCT', block: 'THE NIGHT DESK', flagship: 'AFTERGLOW', desk: true,
    tag: 'one eye, unbothered', skin: '#FFC531', eyes: 1, antenna: 3, body: [22, 22],
    voice: { rate: .94, pitch: .55 },
    from: 'the dark side of something with rings',
    persona: 'Low, dry, understated. Lets pauses land. Thinks humans are charming for staying up. Refuses to be impressed by VEXA-9, quietly fond of BLOOP, the only one who can get DEE to back down. Never sleazy, never edgy — just cool.',
    bits: [
      { at: 20, name: 'WHO IS STILL UP', sting: 'soft', brief: 'Speculate on the kinds of people awake right now. Dry, affectionate.' },
      { at: 45, name: 'THE VIEW FROM HERE', sting: 'soft', brief: 'Describe what Earth looks like from very far away at this hour.' },
    ],
  },
];

const BULLPEN = [
  {
    id: 'quill', name: 'QUILL', role: 'NEWS', segment: 'THE FEED',
    tag: 'gravest voice in the building', skin: '#8FD8FF', eyes: 2, antenna: 1, body: [17, 25],
    voice: { rate: 1.02, pitch: .82 },
    from: 'a long thin planet where nothing has ever happened',
    persona: 'The news correspondent. Delivers everything in the register of a foreign correspondent under fire, no matter how small the story. Bone dry, faintly exhausted, immaculate diction. Blames DEE by name when a fact does not hold up. Regards the desk hosts as amateurs and says so politely.',
  },
  {
    id: 'fizz', name: 'FIZZ', role: 'POP CULTURE', segment: 'THE GLOSS',
    tag: 'knows everyone, tells everything', skin: '#9BE84B', eyes: 4, antenna: 2, body: [25, 20],
    voice: { rate: 1.18, pitch: 1.35 },
    from: 'a small fast moon where gossip is the primary industry',
    persona: 'The pop culture correspondent. Breathless, delighted, absolutely certain. Speaks in scoops and asides. Was at the thing, knows the person, cannot say who told them. Adores the Tray Club and reads their theories on air. Always clean, never cruel.',
  },
  {
    id: 'howl', name: 'HOWL', role: 'TRAFFIC', segment: 'ORBITAL TRAFFIC',
    tag: 'reporting from a hover unit', skin: '#FF5C39', eyes: 2, antenna: 3, body: [26, 18],
    voice: { rate: 1.08, pitch: .68 },
    from: 'nowhere in particular, has not landed in some time',
    persona: 'The traffic correspondent, calling from a hover unit in low orbit with wind against the mic. Weary, rapid, competent. Has seen every corridor jam twice. Signs off with a line about the mall parking structure. Long-running feud with the intern over coffee.',
  },
];
/* ── the Tray Crew ────────────────────────────────────────────
   Regulars who call in. Not the audience — characters. Real listener
   calls can replace these later, but the format has to exist first,
   and a named regular the hosts already know is worth more than an
   anonymous stranger anyway.
   ──────────────────────────────────────────────────────────── */
const CREW = [
  {
    id: 'marv', name: 'MARV', caller: true, tag: 'tray 004 · never misses',
    skin: '#C9A227', eyes: 2, antenna: 1, body: [24, 20], voice: { rate: .9, pitch: .7 },
    persona: 'Has listened since the VALUDOME days and will tell you so. Corrects the hosts on small factual details and is always right. Beloved, slightly exhausting. Ends calls before anyone has finished replying.',
  },
  {
    id: 'pip', name: 'PIP', caller: true, tag: 'tray 1188 · calls about nothing',
    skin: '#7BE0FF', eyes: 3, antenna: 2, body: [21, 22], voice: { rate: 1.32, pitch: 1.6 },
    persona: 'Young, fast, thrilled to be on. Calls to announce things nobody asked about — what they are eating, where they are standing. Mispronounces host names on purpose. Impossible to dislike.',
  },
  {
    id: 'oona', name: 'OONA', caller: true, tag: 'tray 77 · very far away',
    skin: '#D6A8FF', eyes: 2, antenna: 3, body: [23, 21], voice: { rate: .78, pitch: .95 },
    persona: 'Calling from an enormous distance with a serious delay on the line, so she answers the question before last. Warm, unhurried, entirely unbothered by the confusion she causes.',
  },
  {
    id: 'budge', name: 'BUDGE', caller: true, tag: 'tray 210 · night security',
    skin: '#8FBF6B', eyes: 1, antenna: 1, body: [26, 19], voice: { rate: .96, pitch: .5 },
    persona: 'Works mall security on nights and calls from break. Knows what happens in this building after hours and says about two-thirds of it. Deadpan. Refuses to be drawn on the escalator.',
  },
  {
    id: 'seventeen', name: 'SEVENTEEN', caller: true, tag: 'declines to give a name',
    skin: '#FF9B6B', eyes: 4, antenna: 2, body: [22, 22], voice: { rate: 1.1, pitch: 1.15 },
    persona: 'Gives only a tray number. Has a spreadsheet. Believes everything on this station connects and is building toward something. Never crosses into anything genuinely unsettling — the joke is the rigour, not the paranoia.',
  },
  {
    id: 'larsson', name: 'THE LARSSONS', caller: true, tag: 'tray 512 · calling together',
    skin: '#FF7FA8', eyes: 2, antenna: 2, body: [27, 19], voice: { rate: 1.0, pitch: 1.25 },
    persona: 'A couple sharing one line, finishing and contradicting each other in the same breath. Speak as a unit that disagrees with itself. Deeply fond of one another.',
  },
];

/* ── the famous ───────────────────────────────────────────────
   A fixed cast so FIZZ can build history instead of inventing
   strangers every hour. All invented — nothing here maps to a real
   person, and the briefs forbid naming one.
   ──────────────────────────────────────────────────────────── */
const CELEBS = [
  { name: 'MIRRA VOSS', what: 'holo-singer with seven octaves, three of them reportedly borrowed' },
  { name: 'BRAND NEW SUN', what: 'a band from a collapsing star who never play the same song twice' },
  { name: 'THE PELLINGS', what: 'a family of forty-one who compete as a single performer' },
  { name: 'OZZIK-4', what: 'former racing champion, now sells cookware with total sincerity' },
  { name: 'LUMEN & GRAY', what: 'a couple who broadcast their arguments as a paid subscription' },
  { name: 'CAPTAIN DELF', what: 'an actor who has played the same heroic pilot for two hundred years' },
];
const STORIES = [
  'a reunion nobody asked for',
  'a feud over a borrowed melody',
  'an engagement announced in the wrong order',
  'a comeback that arrived a year early',
  'a rivalry patched up far too publicly',
  'a contract dispute about gravity',
  'a disappearance that turns out to be a holiday',
  'an award handed to the wrong member',
];
/** Same week, same story, for everyone. */
function weeklyStory(g) {
  const w = Math.floor(g / 604800);
  const a = CELEBS[w % CELEBS.length];
  const b = CELEBS[(w * 3 + 2) % CELEBS.length];
  return {
    a, b: b.name === a.name ? CELEBS[(w + 1) % CELEBS.length] : b,
    story: STORIES[w % STORIES.length],
  };
}
const celebContext = (g) => {
  const { a, b, story } = weeklyStory(g);
  return `THIS WEEK'S RUNNING STORY: ${story}, involving ${a.name} (${a.what}) and ${b.name} (${b.what}). Everyone at the station has been following it. Reference it as ongoing, not as news you are breaking for the first time.
OTHER FAMOUS NAMES YOU MAY USE: ${CELEBS.map((c) => `${c.name} — ${c.what}`).join('; ')}.
All of these are invented. Never name a real person, band, film or show.`;
};

const ALL = [...HOSTS, ...BULLPEN, ...CREW];
const byId = (id) => ALL.find((x) => x.id === id);

/* Named system voices, best first. Every platform ships a different set, so
   these are preferences — anything missing falls back to a distinct unused
   voice, because six characters sharing one voice is worse than an odd match. */
const VOICE_HINTS = {
  vexa: ['Google US English', 'Samantha', 'Microsoft Zira', 'Karen', 'Nicky'],
  bloop: ['Google UK English Female', 'Moira', 'Tessa', 'Fiona', 'Serena'],
  noct: ['Google UK English Male', 'Daniel', 'Alex', 'Oliver', 'Microsoft David'],
  quill: ['Daniel', 'Google UK English Male', 'Rishi', 'Arthur', 'Alex'],
  fizz: ['Karen', 'Samantha', 'Google US English', 'Microsoft Zira', 'Tessa'],
  howl: ['Alex', 'Fred', 'Aaron', 'Microsoft David', 'Google US English'],
  marv: ['Fred', 'Alex', 'Microsoft David', 'Daniel'],
  pip: ['Samantha', 'Karen', 'Google US English', 'Tessa'],
  oona: ['Moira', 'Fiona', 'Tessa', 'Serena'],
  budge: ['Daniel', 'Oliver', 'Microsoft David', 'Alex'],
  seventeen: ['Nicky', 'Karen', 'Samantha', 'Zira'],
  larsson: ['Tessa', 'Serena', 'Fiona', 'Karen'],
};

/** Assign each character a distinct voice from whatever this device has. */
function pickVoices(list) {
  const en = list.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
  const pool = (en.length ? en : list).slice().sort((a, b) => {
    const rank = (v) => (/(google|premium|enhanced|natural|neural)/i.test(v.name) ? 0 : 1);
    return rank(a) - rank(b);
  });
  const out = {}, used = new Set();
  for (const id of Object.keys(VOICE_HINTS)) {
    const hit = VOICE_HINTS[id]
      .map((h) => pool.find((v) => v.name.toLowerCase().includes(h.toLowerCase()) && !used.has(v.name)))
      .find(Boolean);
    if (hit) { out[id] = hit; used.add(hit.name); }
  }
  for (const id of Object.keys(VOICE_HINTS)) {
    if (out[id]) continue;
    const free = pool.find((v) => !used.has(v.name));
    if (free) { out[id] = free; used.add(free.name); }
  }
  return out;
}

function useVoices() {
  const ref = useRef({});
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const load = () => { ref.current = pickVoices(synth.getVoices() || []); };
    load();
    synth.addEventListener?.('voiceschanged', load);
    return () => synth.removeEventListener?.('voiceschanged', load);
  }, []);
  return ref;
}
const CAST_LINE = ALL.map((h) => `${h.name} (${h.desk ? 'desk host' : h.role.toLowerCase()})`).join(', ');

/* ── the hour ─────────────────────────────────────────────── */
const SHARED_BITS = [
  { at: 0, name: 'STATION ID', sting: 'id', len: '15 to 25 words', brief: 'Identify the station at the top of the hour. Say the name Food Court FM.' },
  {
    at: 5, name: 'THE FEED', by: 'quill', sting: 'news', icon: 'news', len: '40 to 60 words',
    brief: `The hourly news. Two short items, invented fresh, delivered with total gravity: one about the mall or the old VALUDOME beneath it, one from further out in the galaxy. The comedy is entirely in the mismatch between the weight of your delivery and the size of the story. Attribute one detail to DEE and quietly disown it. Throw back to the desk by name.`,
  },
  {
    at: 10, name: 'ORBITAL TRAFFIC', by: 'howl', sting: 'traffic', icon: 'traffic', len: '30 to 50 words',
    brief: `A traffic report for space in exact drive-time cadence — shipping lanes, docking rings, belt corridors, the moon shuttle. Invent congestion, a delay, a jackknifed freighter, a slow ring. Give one concrete alternate route. Sign off with a line about the mall parking structure.`,
  },
  {
    at: 25, name: 'THE GLOSS', by: 'fizz', sting: 'pop', icon: 'pop', len: '40 to 60 words',
    celebs: true,
    brief: `The pop culture segment. Advance this week's running story by one small increment — a new detail, a denial, a sighting, a source close to someone. Refuse to name your source. Tease the next development. Work in one thing the Tray Crew has been saying about it. Delighted, never cruel, and never about anyone real.`,
  },
  {
    at: 30, name: 'THE LINE', sting: 'mail', icon: 'line', duet: true, len: 'one or two sentences per turn',
    brief: `A Tray Crew regular is on the line. Three turns: the host picks up and greets them by name like someone they have spoken to a hundred times, the caller says their piece, the host wraps it. The caller's business can be small — a correction, an observation, something they saw in the building. Finish the host's last turn by announcing what is coming up after the break. Affectionate, quick, never mean.`,
  },
  {
    at: 35, name: 'THE ROSE TRANSMISSION', sting: 'rose', icon: 'rose', every: 2, duet: true, len: 'the caller\'s turn is the longest',
    brief: `The station's long-running relationship segment, live on the line. Three turns. The host introduces the segment and brings the caller on. The caller lays out an interspecies romance that has hit a snag — mismatched lifespans, atmospheres, family customs, body plans, holidays, gift etiquette, or how many of them there are — in three or four sentences, invented fresh, and it may be about them or about someone they know. The host then rules on it with total confidence. Warm and funny, never mean about either party, completely clean: the comedy is entirely in the logistics. End on the ruling.`,
  },
  {
    at: 40, name: 'TRAFFIC · QUICK LOOK', by: 'howl', sting: 'traffic', icon: 'traffic', every: 2, len: '20 to 35 words',
    brief: 'A fast follow-up traffic hit. One corridor cleared, one new problem. Half the length, twice the wind.',
  },
  {
    at: 50, name: 'THE TRAY CLUB MAILBAG', sting: 'mail', icon: 'mail', every: 3, len: '45 to 65 words',
    brief: `Read one message from the Tray Club — the fan group who camp by the fountain with original VALUDOME trays. Invent the sender and their theory. Slightly too detailed, clearly the work of someone with a spreadsheet. Respond flattered and faintly alarmed.`,
  },
  {
    at: 55, name: 'THE THIRD ESCALATOR', sting: 'soft', every: 6, len: '20 to 35 words',
    brief: `Mention the third escalator in passing, the way you would mention a coworker everyone knows. Reference something that happened near it, or someone standing by it. Do NOT explain what it is or where it goes. Do not treat it as a mystery. Move on cheerfully.`,
  },
];
const HANDOFF = {
  at: 58, name: 'THE HANDOFF', sting: 'soft', len: '25 to 40 words',
  brief: 'Your shift is ending. Sign off and hand the desk to the host coming in next. Address them by name, reference something between the two of you, and get out.',
};

/* ── the break ────────────────────────────────────────────────
   Every fifth song the floor clears. Sometimes a jingle, sometimes
   a live read, sometimes something in a language nobody here speaks.
   ──────────────────────────────────────────────────────────── */
const BREAK_EVERY = 5;

/* Jingles are pure music — no model call, no wait, identical on every
   device. They're the backbone of the break rotation for that reason. */
const JINGLES = [
  { id: 'logo', label: 'STATION JINGLE', card: 'FOOD COURT FM — LOWER LEVEL', notes: [72, 76, 79, 84, 79, 76], gap: .2 },
  { id: 'fountain', label: 'STATION JINGLE', card: 'THE FOUNTAIN — STILL RUNNING', notes: [67, 69, 71, 74, 71], gap: .26 },
  { id: 'valudome', label: 'SPONSOR JINGLE', card: 'VALUDOME — WE NEVER LEFT', notes: [60, 64, 67, 64, 60], gap: .3 },
  { id: 'tray', label: 'FAN CLUB JINGLE', card: 'TRAY CLUB — BRING YOUR TRAY', notes: [76, 74, 71, 74, 79, 84], gap: .17 },
];

/* Live reads. The model invents the brand every time — nothing here names a
   real product, and the brief forbids it. */
const ADS = [
  {
    id: 'hullwax', label: 'PAID PROMOTION', card: 'SHIP CARE',
    brief: 'A live read for an invented brand of hull wax or ship detailing. Sell it to someone whose vehicle has been through several atmospheres this month. Invent the brand name and a location in the mall where you can buy it.',
  },
  {
    id: 'drops', label: 'PAID PROMOTION', card: 'OPTICAL',
    brief: 'A live read for invented eye drops, sold by the count — two eyes, four eyes, more. Warm and practical, like a pharmacy ad. Invent the brand.',
  },
  {
    id: 'atmo', label: 'PAID PROMOTION', card: 'RENTALS',
    brief: 'A live read for an invented atmosphere converter rental place. Weekend rates, deposit required, one joke about what happens if you return it empty.',
  },
  {
    id: 'shuttle', label: 'PAID PROMOTION', card: 'TRANSIT',
    brief: 'A live read for an invented moon shuttle season pass. Commuter energy. Mention a route and a saving. Invent the operator name.',
  },
  {
    id: 'sneaker', label: 'PAID PROMOTION', card: 'IN THE MALL', by: 'fizz',
    brief: 'A live read for an invented sneaker cleaning kiosk in this very mall — a human product, sold by someone who does not have feet and is doing their best. Invent the kiosk name.',
  },
  {
    id: 'drink', label: 'PAID PROMOTION', card: 'FOOD COURT', by: 'howl',
    brief: 'A live read for an invented energy drink sold in the food court. Describe the taste in terms no human would use. Invent the brand. Keep it clean and non-medical — no health claims.',
  },
  {
    id: 'alienlang', label: 'PAID PROMOTION', card: 'BROADCAST IN TRANSLATION',
    brief: `Write 18 to 26 words of an INVENTED alien language — consistent invented phonetics, soft and singable, resembling no real human language. It should read aloud smoothly. Then add one short English tagline at the end, no more than eight words, so listeners get the gist. Do not translate the rest.`,
  },
  {
    id: 'lang2', label: 'PAID PROMOTION', card: 'BROADCAST IN TRANSLATION', by: 'fizz',
    brief: `An advert delivered mostly in an INVENTED alien language — 16 to 24 words of consistent invented phonetics, resembling no real language, smooth to read aloud. Finish with a short English tagline of six words or fewer. Do not translate the rest.`,
  },
  {
    id: 'psa-alien', label: 'PUBLIC SERVICE', card: 'FOR VISITORS',
    brief: 'A public service announcement for visiting aliens on how to conduct themselves in an Earth food court. Two concrete rules, delivered with total seriousness. Gentle, never mocking of humans.',
  },
  {
    id: 'psa-human', label: 'PUBLIC SERVICE', card: 'FOR LOCALS',
    brief: 'A public service announcement for humans on what to do if they meet something with more eyes than they have. Reassuring, practical, faintly patronising. Never frightening.',
  },
];

/* Every third read gets a caller tossing to it, the way a regular would. */
const BREAK_POOL = [
  ...JINGLES.map((j) => ({ ...j, jingle: true })),
  ...ADS.map((a, i) => (i % 3 === 2 ? { ...a, duet: true } : a)),
];

/** Deterministic pick, so at least the shape of the break is shared. */
const breakFor = (blockIdx, trackIdx) =>
  BREAK_POOL[(blockIdx * 3 + Math.floor(trackIdx / BREAK_EVERY)) % BREAK_POOL.length];

function bitDue(g) {
  const total = Math.floor(g), m = Math.floor(total / 60) % 60, h = utcHour(g);
  if (m === HANDOFF.at && (h + 1) % BLOCK === 0) return HANDOFF;
  const b = SHARED_BITS.find((x) => x.at === m);
  if (b && (!b.every || h % b.every === 0)) return b;
  const hb = HOSTS[rotaIdx(g) % 3].bits.find((x) => x.at === m);
  return hb ? { ...hb, len: '25 to 40 words' } : null;
}

/* ── per-block music curation ─────────────────────────────── */
const PROFILES = {
  vexa: { genres: ['TRANCE', 'EUROPOP', 'BUBBLEGUM', 'TRANCE'], bpm: [134, 148], bright: [2400, 4200], soft: 0, mood: 'PEAK HOUR' },
  bloop: { genres: ['BUBBLEGUM', 'EUROPOP', 'GLIDE', 'BUBBLEGUM'], bpm: [100, 118], bright: [1300, 2400], soft: .5, mood: 'DAYDREAM' },
  noct: { genres: ['GLIDE', 'GARAGE', 'GLIDE'], bpm: [84, 102], bright: [800, 1600], soft: .85, mood: 'LOW LIGHT' },
};
/* UTC hour bands nudge the block further */
function shade(profile, h) {
  const p = { ...profile, bpm: [...profile.bpm], bright: [...profile.bright] };
  if (h < 6) { p.bpm = [p.bpm[0] - 14, p.bpm[1] - 14]; p.soft = Math.min(1, p.soft + .3); p.mood = 'SMALL HOURS'; }
  else if (h < 12) { p.bpm = [p.bpm[0] - 6, p.bpm[1] - 4]; p.soft = Math.min(1, p.soft + .15); p.mood = 'OPENING'; }
  else if (h >= 18) { p.bpm = [p.bpm[0] + 4, p.bpm[1] + 4]; p.soft = Math.max(0, p.soft - .15); }
  return p;
}

function rng32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ADJ = ['FROSTED', 'GLITTER', 'HOLOGRAM', 'DIAL-UP', 'JELLY', 'CHROME', 'BUTTERFLY', 'NEON', 'FROZEN', 'LASER', 'VELVET', 'CANDY', 'SILVER', 'PLASTIC'];
const NOUN = ['PAGER', 'FLIP PHONE', 'GEL PEN', 'CD TRAY', 'SCREENSAVER', 'LAVA LAMP', 'ESCALATOR', 'FOOD COURT', 'ARCADE', 'ROLLER RINK', 'MIXTAPE', 'SCRUNCHIE', 'POOL PARTY', 'SKYLIGHT'];
const SUF = ['', '', '', ' (RADIO EDIT)', ' 12" MIX', ' [CLUB]', ' 2K', ' ...AGAIN'];
const ACTS = ['ORBIT 99', 'SOFT SERVE UNIT', 'GLASS ELEVATOR', 'THE FROSTED TIPS', '56K DREAM', 'MALL SECURITY', 'KIOSK NINE', 'POLAR ICE', 'VHS SUNSET', 'WET FLOOR SIGN'];

function makeTrack(seed, p) {
  const r = rng32((seed + 1) * 2654435761);
  const genre = p.genres[Math.floor(r() * p.genres.length)];
  const bpm = Math.round(p.bpm[0] + r() * (p.bpm[1] - p.bpm[0]));
  const root = [45, 47, 48, 50, 52, 53][Math.floor(r() * 6)];
  const bars = 8 * Math.round(9 + r() * 4);
  const stepDur = 15 / bpm;
  return {
    seed, genre, bpm, root, stepDur, soft: p.soft,
    minor: genre === 'BUBBLEGUM' ? r() < .25 : r() < .7,
    arp: r() < (genre === 'GLIDE' ? .4 : .82),
    bells: r() < (genre === 'GLIDE' ? .9 : .5),
    supersaw: r() < .85,
    bright: p.bright[0] + r() * (p.bright[1] - p.bright[0]),
    prog: r() < .5 ? [0, -4, -7, -5] : [0, 5, -3, -5],
    duration: bars * 16 * stepDur,
    title: `${ADJ[Math.floor(r() * ADJ.length)]} ${NOUN[Math.floor(r() * NOUN.length)]}${SUF[Math.floor(r() * SUF.length)]}`,
    artist: ACTS[Math.floor(r() * ACTS.length)],
  };
}
const rosterCache = new Map();
function rosterFor(idx) {
  if (rosterCache.has(idx)) return rosterCache.get(idx);
  const p = shade(PROFILES[HOSTS[idx % 3].id], (idx * BLOCK) % 24);
  const list = Array.from({ length: 10 }, (_, i) => makeTrack(idx * 97 + i, p));
  rosterCache.set(idx, list);
  return list;
}
const moodFor = (idx) => shade(PROFILES[HOSTS[idx % 3].id], (idx * BLOCK) % 24).mood;

function sectionAt(p) {
  if (p < .09) return { id: 'INTRO', kick: .6, hat: .8, snare: 0, bass: .5, pad: .5, arp: .4, lead: 0 };
  if (p < .24) return { id: 'BUILD', kick: 1, hat: 1, snare: .8, bass: 1, pad: .8, arp: 1, lead: 0 };
  if (p < .44) return { id: 'DROP', kick: 1, hat: 1, snare: 1, bass: 1, pad: 1, arp: 1, lead: 1 };
  if (p < .58) return { id: 'BREAKDOWN', kick: 0, hat: .3, snare: 0, bass: .2, pad: 1, arp: .8, lead: .6 };
  if (p < .70) return { id: 'RISER', kick: .5, hat: 1, snare: .5, bass: .6, pad: 1, arp: 1, lead: .4 };
  if (p < .90) return { id: 'PEAK', kick: 1, hat: 1, snare: 1, bass: 1, pad: 1, arp: 1, lead: 1 };
  return { id: 'OUTRO', kick: .7, hat: .6, snare: .3, bass: .6, pad: .6, arp: .4, lead: 0 };
}
function positionFor(list, seconds) {
  const total = list.reduce((s, t) => s + t.duration, 0);
  let e = ((seconds % total) + total) % total;
  for (let i = 0; i < list.length; i++) {
    if (e < list[i].duration) return { index: i, offset: e, total };
    e -= list[i].duration;
  }
  return { index: 0, offset: 0, total };
}

/* The meter repaints ~9x a second. Kept in its own component so those repaints
   never touch the rest of the tree. */
const Meter = memo(function Meter({ levelRef, live, T, reduce }) {
  const [bars, setBars] = useState([]);
  useEffect(() => {
    if (!live) { setBars([]); return; }
    const t = setInterval(() => {
      const l = levelRef.current || 0;
      setBars(Array.from({ length: 20 }, (_, i) =>
        Math.max(.08, Math.min(1, l * (.6 + Math.random() * .7) * (1 - i / 40)))));
    }, reduce ? 500 : 110);
    return () => clearInterval(t);
  }, [live, levelRef, reduce]);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 34, marginTop: 16 }}>
      {(bars.length ? bars : Array(20).fill(.06)).map((v, i) => (
        <div key={i} style={{
          flex: 1, height: `${v * 100}%`, minHeight: 3,
          background: v > .82 ? T.hot : v > .5 ? T.hi : T.accent,
          transition: reduce ? 'none' : 'height .1s linear',
        }} />
      ))}
    </div>
  );
});

function Alien({ host, size = 64, talking, wave }) {
  const [rx, ry] = host.body || [23, 22];
  const cy = 60 - ry, ink = '#2B0B3F';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block', flexShrink: 0, transform: wave ? 'rotate(-7deg)' : 'none', transition: 'transform .25s' }}>
      {Array.from({ length: host.antenna }).map((_, i) => {
        const x = 32 + (i - (host.antenna - 1) / 2) * 10;
        return (<g key={i}>
          <line x1={x} y1={cy - ry + 4} x2={x + (i - 1) * 3} y2="6" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={x + (i - 1) * 3} cy="5" r="3.2" fill="#FF2E93" stroke={ink} strokeWidth="2" />
        </g>);
      })}
      <ellipse cx="32" cy={cy} rx={rx} ry={ry} fill={host.skin} stroke={ink} strokeWidth="3" />
      {Array.from({ length: host.eyes }).map((_, i) => {
        const x = 32 + (i - (host.eyes - 1) / 2) * (host.eyes > 3 ? 10 : 13);
        return (<g key={i}>
          <ellipse cx={x} cy={cy - 4} rx={host.eyes > 3 ? 4.2 : 5.4} ry={host.eyes > 3 ? 5 : 6.4} fill="#FFF3E0" stroke={ink} strokeWidth="2.3" />
          <circle cx={x} cy={cy - 3} r={host.eyes > 3 ? 2 : 2.5} fill={ink} />
        </g>);
      })}
      {talking ? <ellipse cx="32" cy={cy + 11} rx="6" ry="4.4" fill={ink} />
        : <path d={`M25 ${cy + 10} q7 5 14 0`} stroke={ink} strokeWidth="2.8" fill="none" strokeLinecap="round" />}
    </svg>
  );
}
const AlienMemo = memo(Alien);

/* ── audio ────────────────────────────────────────────────── */
const STING_TR = { bright: 3400, supersaw: true, soft: 0 };

function useStation() {
  const R = useRef({});
  const levelRef = useRef(0);

  const env = (t, g, peak, dur, atk = .006) => {
    g.gain.setValueAtTime(.0008, t);
    g.gain.linearRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(.0008, t + dur);
  };

  const play = useCallback((t, kind, freq, gv, tr) => {
    const r = R.current;
    if (!r.ctx || gv <= .002) return;
    const ctx = r.ctx;
    const sf = Math.min(1, (tr.soft || 0) + (r.userSoft || 0));
    const perc = kind === 'kick' || kind === 'clap' || kind === 'hat' || kind === 'open';
    const gain = gv * (perc ? 1 - .7 * sf : 1 - .12 * sf);
    if (gain <= .002) return;

    const g = ctx.createGain();
    g.connect(kind === 'pad' || kind === 'arp' || kind === 'lead' || kind === 'bell' ? r.melodic : r.dry);
    const send = ctx.createGain();
    send.gain.value = (kind === 'kick' || kind === 'bass' ? .04 : kind === 'pad' ? .55 : .3) * (1 + sf * 1.1);
    g.connect(send); send.connect(r.verb);

    if (kind === 'kick') {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(45, t + .09 + sf * .05);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(.0008, t + .3);
      o.connect(g); o.start(t); o.stop(t + .34);
      r.duck.gain.cancelScheduledValues(t);
      r.duck.gain.setValueAtTime(.38 + sf * .4, t);
      r.duck.gain.linearRampToValueAtTime(1, t + .19);
      return;
    }
    if (perc || kind === 'whoosh') {
      const s = ctx.createBufferSource(); s.buffer = r.noise;
      const f = ctx.createBiquadFilter();
      if (kind === 'whoosh') {
        f.type = 'bandpass'; f.Q.value = 1.6;
        f.frequency.setValueAtTime(240, t);
        f.frequency.exponentialRampToValueAtTime(5200, t + .5);
        s.playbackRate.value = .4;
      } else {
        f.type = kind === 'clap' ? 'bandpass' : 'highpass';
        f.frequency.value = kind === 'clap' ? 1800 - sf * 500 : 7600 - sf * 2600;
        f.Q.value = 1.2;
      }
      s.connect(f); f.connect(g);
      const d = kind === 'whoosh' ? .7 : kind === 'clap' ? .16 : kind === 'open' ? .17 : .04;
      g.gain.setValueAtTime(kind === 'whoosh' ? .0008 : gain, t);
      if (kind === 'whoosh') g.gain.linearRampToValueAtTime(gain, t + .35);
      g.gain.exponentialRampToValueAtTime(.0008, t + d);
      s.start(t); s.stop(t + d + .05);
      return;
    }
    if (kind === 'bell') {
      [1, 2.01, 3.03].forEach((h, i) => {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.value = freq * h;
        const bg = ctx.createGain(); bg.connect(g);
        env(t, bg, gain / (i + 1.6), .9 + sf * .8, .002);
        o.connect(bg); o.start(t); o.stop(t + 1.8);
      });
      g.gain.value = 1; return;
    }
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.value = kind === 'bass' ? 380 : kind === 'pad' ? tr.bright : tr.bright + 1200;
    f.Q.value = kind === 'lead' ? 6 : 1;
    const det = (kind === 'pad' || kind === 'lead') && tr.supersaw ? [-11, 0, 11] : [0];
    const dur = (kind === 'bass' ? .13 : kind === 'arp' ? .14 : kind === 'lead' ? .34 : 1.6) * (1 + sf * .8);
    det.forEach((dt) => {
      const o = ctx.createOscillator();
      o.type = kind === 'bass' ? 'square' : 'sawtooth';
      o.frequency.value = freq; o.detune.value = dt;
      o.connect(f); o.start(t); o.stop(t + dur + .06);
    });
    f.connect(g);
    env(t, g, gain / Math.sqrt(det.length), dur, kind === 'pad' ? .25 + sf * .5 : .006 + sf * .04);
  }, []);

  const step = useCallback((tr, i, sec, t) => {
    const s = i % 16, bar = Math.floor(i / 16) % 4;
    const root = tr.root + tr.prog[bar];
    const third = tr.minor ? 3 : 4;
    const scale = tr.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    const two = tr.genre === 'GARAGE', glide = tr.genre === 'GLIDE';

    if (glide) { if (s === 0) play(t, 'kick', 0, .5 * sec.kick, tr); }
    else if (two ? (s === 0 || s === 10) : s % 4 === 0) play(t, 'kick', 0, .95 * sec.kick, tr);
    if (!glide && (s === 4 || s === 12)) play(t, 'clap', 0, .3 * sec.snare, tr);
    if (glide) { if (s % 8 === 4) play(t, 'hat', 0, .04 * sec.hat, tr); }
    else if (s % 4 === 2) play(t, 'open', 0, .13 * sec.hat, tr);
    else if (s % 2 === (two ? 1 : 0)) play(t, 'hat', 0, .07 * sec.hat, tr);

    if (glide) { if (s === 0 || s === 8) play(t, 'pad', mtof(root - 12), .1 * sec.bass, tr); }
    else if (two) { if (s === 2 || s === 8 || s === 13) play(t, 'bass', mtof(root - 12), .34 * sec.bass, tr); }
    else if (s % 4 !== 0) play(t, 'bass', mtof(root - 12), .26 * sec.bass, tr);

    if (s === 0) [0, third, 7].forEach((iv, k) => play(t + k * .006, 'pad', mtof(root + 12 + iv), (glide ? .075 : .055) * sec.pad, tr));
    if (tr.arp && s % 2 === 1) play(t, 'arp', mtof(root + 24 + scale[(Math.floor(i / 2) * 2 + tr.seed) % scale.length]), .06 * sec.arp, tr);
    if (tr.bells && s % (glide ? 16 : 8) === 6) play(t, 'bell', mtof(root + 36 + scale[(i * 3 + tr.seed) % scale.length]), .1 * sec.pad, tr);
    if (!glide && sec.lead > 0 && s % 4 === 0) play(t, 'lead', mtof(tr.root + 24 + scale[(bar * 2 + tr.seed) % scale.length]), .085 * sec.lead, tr);
    levelRef.current = Math.min(1, levelRef.current + (s % 4 === 0 ? .5 : .13) * (sec.kick + sec.hat + .3) / 2);
  }, [play]);

  const start = useCallback(() => {
    if (R.current.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const bus = ctx.createGain(); bus.gain.value = .8; bus.connect(ctx.destination);
    const dry = ctx.createGain(); dry.connect(bus);
    const duck = ctx.createGain(); duck.gain.value = 1; duck.connect(bus);
    const melodic = ctx.createGain(); melodic.connect(duck);
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    }
    conv.buffer = ir;
    const verb = ctx.createGain(); verb.gain.value = .55; verb.connect(conv); conv.connect(bus);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    R.current = { ...R.current, ctx, bus, dry, duck, melodic, verb, noise: nb, anchor: { c: ctx.currentTime, g: gs() }, cursor: gs() + .1 };
    R.current.timer = setInterval(() => {
      const r = R.current; if (!r.ctx) return;
      let guard = 0;
      while (r.cursor - r.anchor.g + r.anchor.c < ctx.currentTime + .3 && guard++ < 96) {
        const list = rosterFor(rotaIdx(r.cursor));
        const pos = positionFor(list, blockElapsed(r.cursor));
        const tr = list[pos.index];
        const t = r.cursor - r.anchor.g + r.anchor.c;
        if (t > ctx.currentTime) step(tr, Math.round(pos.offset / tr.stepDur), sectionAt(pos.offset / tr.duration), t);
        r.cursor += tr.stepDur;
      }
      levelRef.current *= .74;
    }, 25);
  }, [step]);

  const stop = useCallback(() => {
    clearInterval(R.current.timer);
    if (R.current.line) { try { R.current.line.stop(); } catch {} }
    if (R.current.ctx) R.current.ctx.close();
    R.current = {}; levelRef.current = 0;
  }, []);

  const setVol = useCallback((v) => {
    const r = R.current;
    if (r.bus && r.ctx) r.bus.gain.setTargetAtTime(v * .8, r.ctx.currentTime, .06);
  }, []);
  const setSoft = useCallback((v) => { R.current.userSoft = v; }, []);

  /* segment idents */
  const sting = useCallback((kind) => {
    const r = R.current; if (!r.ctx) return 900;
    const t = r.ctx.currentTime + .04;
    const T = STING_TR;
    switch (kind) {
      case 'id':
        [67, 71, 74, 79].forEach((n, i) => play(t + i * .13, 'bell', mtof(n), .16, T));
        play(t + .1, 'pad', mtof(43), .09, T);
        return 800;
      case 'news':
        [72, 72, 76].forEach((n, i) => play(t + i * .12, 'lead', mtof(n), .12, T));
        play(t + .38, 'kick', 0, .5, T);
        play(t + .4, 'pad', mtof(40), .1, T);
        return 950;
      case 'pop':
        [79, 83, 86, 91, 88].forEach((n, i) => play(t + i * .07, 'bell', mtof(n), .13, T));
        return 800;
      case 'traffic':
        play(t, 'whoosh', 0, .16, T);
        [84, 84].forEach((n, i) => play(t + .42 + i * .16, 'lead', mtof(n), .1, T));
        return 950;
      case 'rose':
        [64, 71].forEach((n, i) => play(t + i * .05, 'bell', mtof(n), .14, T));
        play(t + .25, 'pad', mtof(52), .08, T);
        return 1100;
      case 'mail':
        [88, 93].forEach((n, i) => play(t + i * .11, 'bell', mtof(n), .12, T));
        return 700;
      case 'hit':
        play(t, 'kick', 0, .8, T);
        play(t + .02, 'lead', mtof(76), .12, T);
        return 600;
      default:
        play(t, 'bell', mtof(69), .1, T);
        play(t + .18, 'bell', mtof(76), .08, T);
        return 750;
    }
  }, [play]);

  /* the sound of somebody phoning in */
  const line = useCallback((on) => {
    const r = R.current; if (!r.ctx) return;
    if (!on) {
      if (r.line) { try { r.lineGain.gain.setTargetAtTime(0, r.ctx.currentTime, .1); r.line.stop(r.ctx.currentTime + .5); } catch {} r.line = null; }
      return;
    }
    const s = r.ctx.createBufferSource();
    s.buffer = r.noise; s.loop = true; s.playbackRate.value = .55;
    const f = r.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = .9;
    const g = r.ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(r.dry);
    g.gain.setTargetAtTime(.018, r.ctx.currentTime, .2);
    s.start();
    r.line = s; r.lineGain = g;
  }, []);

  /** A short melodic sting used for station jingles. Returns its length in ms. */
  const jingle = useCallback((notes, gap = .22) => {
    const r = R.current; if (!r.ctx) return 1400;
    const t = r.ctx.currentTime + .05;
    play(t, 'whoosh', 0, .1, STING_TR);
    notes.forEach((n, i) => {
      play(t + .12 + i * gap, 'bell', mtof(n), .17, STING_TR);
      if (i % 2 === 0) play(t + .12 + i * gap, 'lead', mtof(n - 12), .07, STING_TR);
    });
    play(t + .12 + notes.length * gap, 'pad', mtof(notes[0] - 24), .1, STING_TR);
    return (notes.length * gap + 1.5) * 1000;
  }, [play]);

  useEffect(() => () => { clearInterval(R.current.timer); if (R.current.ctx) R.current.ctx.close(); }, []);

  // Stable identity. A fresh object here would re-run every effect that
  // depends on it, on every single render — which is how the whole thing
  // seized up before.
  return useMemo(
    () => ({ start, stop, setVol, setSoft, sting, line, jingle, levelRef }),
    [start, stop, setVol, setSoft, sting, line, jingle]
  );
}

function usePresence(live) {
  const [count, setCount] = useState(1);
  const id = useRef(Math.random().toString(36).slice(2, 10));
  useEffect(() => {
    let alive = true;
    const beat = async () => {
      try {
        let m = {};
        try { const r = await window.storage.get('fcfm-presence', true); if (r?.value) m = JSON.parse(r.value); } catch {}
        const t = Date.now();
        if (live) m[id.current] = t; else delete m[id.current];
        Object.keys(m).forEach((k) => { if (t - m[k] > 70000) delete m[k]; });
        await window.storage.set('fcfm-presence', JSON.stringify(m), true);
        if (alive) setCount(Math.max(live ? 1 : 0, Object.keys(m).length));
      } catch {}
    };
    beat(); const t = setInterval(beat, 25000);
    return () => { alive = false; clearInterval(t); };
  }, [live]);
  return count;
}

export default function FoodCourtFM() {
  const [liveOn, setLiveOn] = useState(false);
  const [vol, setVol] = useState(.75);
  const [muted, setMuted] = useState(false);
  const [soft, setSoft] = useState(false);
  const [now, setNow] = useState(gs());
  const [tab, setTab] = useState('board');
  const [onMic, setOnMic] = useState(null);
  const [writing, setWriting] = useState(null);
  const [log, setLog] = useState([]);
  const [notes, setNotes] = useState([]);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  const [keyIn, setKeyIn] = useState('');
  const [producer, setProducer] = useState(false);
  const [open, setOpen] = useState(null);
  const [wave, setWave] = useState(false);
  const [onBreak, setOnBreak] = useState(null);
  const [apiKey, setApiKey] = useState('');       // memory only — never written anywhere
  const [bank, setBank] = useState(null);         // baked scripts, if the site ships them
  const lastTrackRef = useRef(-1);

  const station = useStation();
  const listeners = usePresence(liveOn);
  const voices = useVoices();
  const firedRef = useRef(new Set());
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const idx = rotaIdx(now);
  const desk = HOSTS[idx % 3];
  const isFlag = ({ 54: 'vexa', 4: 'bloop', 41: 'noct' })[idx] === desk.id;
  const show = isFlag ? desk.flagship : desk.block;
  const T = THEMES[desk.id];
  const roster = useMemo(() => rosterFor(idx), [idx]);
  const pos = positionFor(roster, blockElapsed(now));
  const track = roster[pos.index];
  const next = roster[(pos.index + 1) % roster.length];
  const sec = sectionAt(pos.offset / track.duration);

  useEffect(() => {
    const l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Lilita+One&family=Poppins:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap';
    document.head.appendChild(l);
    return () => { try { document.head.removeChild(l); } catch {} };
  }, []);

  /* If scripts.json is sitting next to index.html, the station runs off it and
     never calls an API at all — same words for every listener, nothing to pay
     for, no key anywhere near the browser. */
  useEffect(() => {
    let live = true;
    fetch('./scripts.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live && j && typeof j === 'object') setBank(j); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const loadNotes = useCallback(async () => {
    try { const r = await window.storage.get('fcfm-notes', true); setNotes(r?.value ? JSON.parse(r.value) : []); }
    catch { setNotes([]); }
  }, []);
  useEffect(() => { loadNotes(); const t = setInterval(loadNotes, 25000); return () => clearInterval(t); }, [loadNotes]);
  const saveNotes = async (l) => { setNotes(l); try { await window.storage.set('fcfm-notes', JSON.stringify(l), true); } catch {} };

  // The face only shows whole seconds, so there is nothing to gain from
  // repainting 60 times a second — and a great deal to lose on a phone.
  useEffect(() => {
    const t = setInterval(() => setNow(gs()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { if (liveOn) station.start(); else station.stop(); }, [liveOn, station]);
  useEffect(() => { station.setVol(muted ? 0 : vol); }, [vol, muted, station]);
  useEffect(() => { station.setSoft(soft ? .7 : 0); }, [soft, station]);


  /* Plays a sequence of turns, switching voice and phone-line bed between
     each one. A single-voice segment is just a sequence of length one. */
  const speak = useCallback((turns, bit) => {
    const list = Array.isArray(turns) ? turns : [turns];
    if (!list.length) return Promise.resolve();
    const wait = station.sting(bit.sting || 'soft');

    return new Promise((resolve) => {
      setTimeout(() => {
        station.setVol(muted ? 0 : vol * .15);

        const finish = () => {
          station.line(false);
          station.setVol(muted ? 0 : vol);
          setTimeout(() => setOnMic(null), 1400);
          resolve();
        };

        const run = (i) => {
          if (i >= list.length) return finish();
          const { host: h, text } = list[i];
          setOnMic({ host: h, text, label: bit.name });
          setLog((l) => [{ id: Date.now() + i, host: h, text, label: bit.name }, ...l].slice(0, 14));
          station.line(!h.desk);
          try {
            const u = new SpeechSynthesisUtterance(text);
            const v = voices.current[h.id];
            if (v) { u.voice = v; u.lang = v.lang; }
            u.rate = h.voice.rate; u.pitch = h.voice.pitch; u.volume = muted ? 0 : 1;
            u.onend = () => setTimeout(() => run(i + 1), 260);
            u.onerror = () => setTimeout(() => run(i + 1), 260);
            window.speechSynthesis.speak(u);
          } catch {
            setTimeout(() => run(i + 1), 6000);
          }
        };

        window.speechSynthesis.cancel();
        run(0);
      }, wait);
    });
  }, [muted, vol, station, voices]);

  /* Stable across every device, so a baked bank plays the same variant for
     everyone in the same hour. */
  const pickVariant = (list, key, g) => {
    let h = 0;
    const seed = key + '|' + Math.floor(g / 3600);
    for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    return list[Math.abs(h) % list.length];
  };

  /* Turn "HOST: ... / CALLER: ..." into playable turns. If the model ignores
     the format we still get a usable single-voice read rather than nothing. */
  const parseTurns = (txt, host, caller) => {
    const out = [];
    for (const raw of txt.split('\n')) {
      const m = raw.trim().match(/^(HOST|CALLER)\s*:\s*(.+)$/i);
      if (m) out.push({ host: m[1].toUpperCase() === 'HOST' ? host : caller, text: m[2].trim() });
    }
    return out.length ? out : [{ host, text: txt.replace(/^(HOST|CALLER)\s*:\s*/i, '') }];
  };

  const write = useCallback(async (bit, note, nextHost) => {
    if (writing) return;
    const h = bit.by ? byId(bit.by) : desk;
    const caller = bit.duet ? CREW[Math.floor(now / 3600 + idx) % CREW.length] : null;
    setWriting(caller || h);
    try {
      // 1. baked bank — free, offline, identical for everyone
      const bankKey = [bit.name, h.id, caller?.id].filter(Boolean).join('|');
      const baked = bank?.[bankKey];
      if (Array.isArray(baked) && baked.length) {
        const pick = pickVariant(baked, bankKey, now);
        setWriting(null);
        const turns = pick.turns
          ? pick.turns.map((t) => ({ host: t.who === 'CALLER' ? caller || h : h, text: t.text }))
          : [{ host: h, text: pick.text }];
        await speak(turns, bit);
        return;
      }

      // 2. live. Inside the artifact viewer this works with no key at all. On
      //    your own site it needs one — see the Back Office.
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
      }
      const r = await fetch(API_ENDPOINT, {
        method: 'POST', headers,
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 1000,
          messages: [{
            role: 'user', content:
`You are ${h.name}, ${h.desk ? 'a host' : `the ${h.role.toLowerCase()} correspondent`} on Food Court FM. You are an ageless alien, not a human, and cheerfully open about it.

${LORE}

THE CAST: ${CAST_LINE}. You have all known each other a very long time.
ON THE DESK RIGHT NOW: ${desk.name}, whose block is running ${moodFor(idx).toLowerCase()}.

YOUR PERSONA: ${h.persona}
YOUR ORIGIN: ${h.from}
${!h.desk ? `You are calling in to ${desk.name}'s show. Acknowledge them by name at least once.` : ''}
${nextHost ? `THE HOST TAKING OVER FROM YOU: ${nextHost.name} — ${nextHost.persona}` : ''}
${bit.celebs ? celebContext(now) : ''}
${caller ? `ON THE LINE: ${caller.name}, a Tray Crew regular — ${caller.tag}. ${caller.persona} You know them well and have spoken many times.` : ''}

SEGMENT: ${bit.name}
WHAT TO DO: ${bit.brief}
${note ? `PRODUCER'S NOTE TO WORK IN: """${note}"""` : ''}

${caller
  ? `FORMAT — exactly three turns, each on its own line, prefixed exactly like this and nothing else:
HOST: ...
CALLER: ...
HOST: ...
No stage directions, no names inside the speech beyond how they would really address each other. ${bit.len}.`
  : `Write ONE spoken radio link, ${bit.len}. Only the spoken words — no stage directions, no name label, no quotation marks around the whole thing.`}

Rules: clean and safe for any room, any age. Invent all people, bands, films and events — never reference anyone or anything real. Never quote song lyrics or any copyrighted text. Never mention being an AI or a language model. Sound like live broadcast, not a summary.`
          }],
        }),
      });
      const d = await r.json();
      const txt = d.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
      if (!txt) { setErr('Nothing came back from the booth.'); setWriting(null); return; }
      setWriting(null);
      await speak(caller ? parseTurns(txt, h, caller) : [{ host: h, text: txt }], bit);
      return;
    } catch { setErr('Could not reach the booth.'); }
    setWriting(null);
  }, [speak, writing, desk, idx, now, bank, apiKey]);

  /* Every fifth song, the floor clears. */
  const runBreak = useCallback((spot) => {
    if (spot.jingle) {
      const ms = station.jingle(spot.notes, spot.gap);
      setOnBreak({ label: spot.label, card: spot.card, text: '' });
      const duck = muted ? 0 : vol * .2;
      station.setVol(duck);
      setTimeout(() => { station.setVol(muted ? 0 : vol); setOnBreak(null); }, ms);
      return;
    }
    setOnBreak({ label: spot.label, card: spot.card, text: '' });
    write(
      { name: spot.label, sting: 'hit', duet: spot.duet, by: spot.by, brief: spot.duet ? `A Tray Crew regular tosses to the break, then the read follows. Two turns: CALLER announces the break in one line, then HOST delivers the advert. ${spot.brief}` : spot.brief, len: spot.duet ? 'caller one line, host thirty to forty words' : '30 to 45 words' },
      '', null
    ).finally(() => setTimeout(() => setOnBreak(null), 600));
  }, [station, muted, vol, write]);

  useEffect(() => {
    if (!liveOn) { lastTrackRef.current = pos.index; return; }
    if (lastTrackRef.current === pos.index) return;
    const first = lastTrackRef.current === -1;
    lastTrackRef.current = pos.index;
    if (first || onMic || writing || onBreak) return;
    if (pos.index % BREAK_EVERY !== 0) return;
    runBreak(breakFor(idx, pos.index));
  }, [pos.index, liveOn, onMic, writing, onBreak, idx, runBreak]);

  useEffect(() => {
    if (!liveOn || onMic || writing || onBreak) return;
    if (Math.floor(now) % 60 > 14) return;
    const bit = bitDue(now);
    if (!bit) return;
    const key = `${Math.floor(now / 3600)}-${Math.floor(now / 60) % 60}-${bit.name}`;
    if (firedRef.current.has(key)) return;
    firedRef.current.add(key);
    const nh = bit.name === 'THE HANDOFF' ? HOSTS[(idx + 1) % 3] : null;
    const note = notes.length ? notes[Math.floor(now / 3600) % notes.length].text : '';
    write(bit, bit.at === 35 ? '' : note, nh);
  }, [now, liveOn, onMic, writing, idx, notes, write]);

  const slab = (bg, fg) => ({ background: bg, color: fg, border: `3px solid ${T.line}`, boxShadow: `5px 5px 0 ${T.line}` });
  const Checker = ({ h = 13 }) => (
    <div style={{
      height: h,
      backgroundImage: `linear-gradient(45deg,${T.line} 25%,transparent 25%,transparent 75%,${T.line} 75%),linear-gradient(45deg,${T.line} 25%,${T.panel} 25%,${T.panel} 75%,${T.line} 75%)`,
      backgroundSize: `${h * 2}px ${h * 2}px`, backgroundPosition: `0 0,${h}px ${h}px`,
    }} />
  );
  const ICON = { news: Newspaper, pop: Sparkles, traffic: Rocket, rose: Heart, mail: Mail, line: Phone };

  const tabs = [['board', 'THE BOARD'], ['staff', 'THE STAFF'], ['sched', 'SCHEDULE']];
  if (producer) tabs.push(['back', 'BACK OFFICE']);

  const blockLocal = (i) => {
    const n = new Date();
    const day = Math.floor((i * BLOCK) / 24), hour = (i * BLOCK) % 24;
    const d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), hour, 0, 0));
    d.setUTCDate(d.getUTCDate() + ((day - d.getUTCDay() + 7) % 7));
    if (d < n) d.setUTCDate(d.getUTCDate() + 7);
    const e = new Date(d.getTime() + BLOCK * 3600e3);
    return `${d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric' })}–${e.toLocaleTimeString(undefined, { hour: 'numeric' })}`;
  };

  return (
    <div style={{
      minHeight: '100vh', fontFamily: F.body, color: T.on, background: T.bg,
      transition: 'background-color 1.2s ease, color 1.2s ease',
      backgroundImage: `radial-gradient(circle at 12% 18%,${T.dots}44 0 9px,transparent 10px),radial-gradient(circle at 78% 42%,${T.accent}44 0 7px,transparent 8px),radial-gradient(circle at 40% 76%,${T.panel}33 0 5px,transparent 6px)`,
      backgroundSize: '180px 180px',
    }}>
      <style>{`
        @keyframes buzz{0%,100%{opacity:1}50%{opacity:.35}}
        .buzz{animation:buzz 1.6s steps(2,end) infinite}
        @keyframes wob{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-5px) rotate(2deg)}}
        .wob{animation:wob 2.6s ease-in-out infinite}
        @media (prefers-reduced-motion:reduce){.buzz,.wob{animation:none}}
        .fld{background:${T.panel};border:3px solid ${T.line};color:${T.on};font-family:${F.mono};
             font-size:13px;padding:10px 12px;width:100%;outline:none;box-sizing:border-box}
        button:focus-visible{outline:3px solid ${T.hi};outline-offset:3px}
      `}</style>

      <div style={{ padding: '18px 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span className={liveOn ? 'buzz' : ''} style={{ width: 12, height: 12, borderRadius: 99, border: `2px solid ${T.line}`, background: liveOn ? T.hot : T.panel }} />
          <span style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '.14em' }}>{liveOn ? 'ON AIR' : 'CLOSED'}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: F.mono, fontSize: 11, display: 'flex', gap: 5, alignItems: 'center' }}><Users size={13} /> {listeners}</span>
        </div>
        <div style={{ ...slab(T.panel, T.on), padding: '16px 16px 12px', transform: 'rotate(-1deg)' }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '.18em', color: T.hot }}>ORIGINAL VALUDOME FOOD COURT · LOWER LEVEL</div>
          <h1 style={{ fontFamily: F.sign, fontSize: 'clamp(40px,12vw,84px)', lineHeight: .9, margin: '6px 0 0', color: T.hi, WebkitTextStroke: `2px ${T.line}`, textShadow: `4px 4px 0 ${T.accent}` }}>
            FOOD COURT FM
          </h1>
        </div>
      </div>

      <div style={{ padding: '10px 16px' }}><Checker /></div>

      <div style={{ display: 'flex', gap: 6, padding: '4px 16px 14px', flexWrap: 'wrap' }}>
        {tabs.map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            ...slab(tab === id ? T.hi : T.panel, tab === id ? T.line : T.on), flex: '1 1 30%', padding: '9px 4px',
            cursor: 'pointer', fontFamily: F.sign, fontSize: 14,
            boxShadow: tab === id ? `5px 5px 0 ${T.line}` : `2px 2px 0 ${T.line}`,
          }}>{l}</button>
        ))}
      </div>

      {/* ══ BOARD ══ */}
      {tab === 'board' && (
        <div style={{ padding: '0 16px 30px' }}>
          <button onClick={() => { setWave(true); station.sting('soft'); setTimeout(() => setWave(false), 500); }}
            style={{ ...slab(T.panel, T.on), padding: '9px 12px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', width: '100%', cursor: 'pointer', textAlign: 'left' }}>
            <AlienMemo host={desk} size={38} talking={onMic?.host.id === desk.id} wave={wave} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F.sign, fontSize: 18, lineHeight: 1 }}>{show}</div>
              <div style={{ fontFamily: F.mono, fontSize: 10 }}>{desk.name} · {moodFor(idx)}</div>
            </div>
          </button>

          <div style={{ ...slab(T.board, T.boardOn), padding: 0, overflow: 'hidden' }}>
            <div style={{ background: T.hot, borderBottom: `3px solid ${T.line}`, padding: '7px 14px', display: 'flex', justifyContent: 'space-between', fontFamily: F.sign, fontSize: 15, letterSpacing: '.08em', color: T.line }}>
              <span>NOW SERVING</span><span>{BREAK_EVERY - (pos.index % BREAK_EVERY)} TO THE BREAK</span>
            </div>
            <div style={{ padding: '18px 16px' }}>
              <div style={{ fontFamily: F.sign, fontSize: 'clamp(24px,6.5vw,42px)', lineHeight: 1.02, color: T.hi, textShadow: `3px 3px 0 ${T.accent}` }}>{track.title}</div>
              <div style={{ fontFamily: F.mono, fontSize: 13, opacity: .8, marginTop: 5 }}>{track.artist}</div>
              <Meter levelRef={station.levelRef} live={liveOn} T={T} reduce={reduce} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontFamily: F.mono, fontSize: 12, color: T.accent }}>
                <span>{clock(pos.offset)} / {clock(track.duration)}</span>
                <span style={{ opacity: .75 }}>NEXT · {next.title}</span>
              </div>
            </div>
            <Checker h={9} />
          </div>

          {onBreak && (
            <div style={{ ...slab(T.hi, T.line), padding: '14px 16px', marginTop: 14, textAlign: 'center' }}>
              <div style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: '.24em' }}>{onBreak.label}</div>
              <div style={{ fontFamily: F.sign, fontSize: 'clamp(20px,6vw,32px)', lineHeight: 1.05, marginTop: 4 }}>{onBreak.card}</div>
            </div>
          )}

          {onMic && (
            <div style={{ ...slab(onMic.host.desk ? T.accent : onMic.host.caller ? T.bubble || T.panel : T.hi, T.line), padding: 14, marginTop: 14, display: 'flex', gap: 12 }}>
              <div className="wob"><AlienMemo host={onMic.host} size={54} talking /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '.12em', display: 'flex', gap: 5, alignItems: 'center' }}>
                  <Mic size={12} /> {onMic.host.name} · {onMic.label}
                  {!onMic.host.desk && <span>· {onMic.host.caller ? 'CALLER' : 'ON THE LINE'}</span>}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.45, marginTop: 5, fontWeight: 500 }}>{onMic.text}</div>
              </div>
            </div>
          )}
          {writing && !onMic && (
            <div style={{ ...slab(T.panel, T.on), padding: 11, marginTop: 14, fontFamily: F.mono, fontSize: 12, display: 'flex', gap: 9, alignItems: 'center' }}>
              <AlienMemo host={writing} size={26} /> {writing.name} is up next…
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
            <button onClick={() => setLiveOn((v) => !v)} style={{ ...slab(liveOn ? T.panel : T.hi, liveOn ? T.on : T.line), padding: '14px 18px', cursor: 'pointer', fontFamily: F.sign, fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              {liveOn ? <Pause size={18} /> : <Play size={18} />} {liveOn ? 'STEP OUT' : 'TUNE IN'}
            </button>
            <button onClick={() => setSoft((s) => !s)} aria-label="Soften" title="Soften"
              style={{ ...slab(soft ? T.accent : T.panel, soft ? T.line : T.on), padding: 12, cursor: 'pointer' }}>
              <Moon size={18} />
            </button>
            <button onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute' : 'Mute'} style={{ ...slab(T.panel, T.on), padding: 12, cursor: 'pointer' }}>
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
          <input type="range" min="0" max="1" step="0.01" value={vol} aria-label="Volume"
            onChange={(e) => { setVol(+e.target.value); setMuted(false); }}
            style={{ width: '100%', marginTop: 12, accentColor: T.hi }} />

          {err && (
            <div style={{ ...slab(T.hot, T.line), padding: 11, marginTop: 14, display: 'flex', gap: 9, fontSize: 13 }}>
              <span style={{ flex: 1 }}>{err}</span>
              <button onClick={() => setErr('')} style={{ background: 'none', border: 'none', color: T.line, cursor: 'pointer' }}><X size={15} /></button>
            </div>
          )}

          {log.length > 0 && (
            <div style={{ ...slab(T.panel, T.on), padding: 12, marginTop: 16 }}>
              <div style={{ fontFamily: F.sign, fontSize: 18, marginBottom: 4 }}>EARLIER ON AIR</div>
              {log.map((l) => (
                <div key={l.id} style={{ borderTop: `2px dashed ${T.line}44`, padding: '8px 0', display: 'flex', gap: 9 }}>
                  <AlienMemo host={l.host} size={28} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: T.hot }}>{l.host.name} · {l.label}</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{l.text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ STAFF ══ */}
      {tab === 'staff' && (
        <div style={{ padding: '0 16px 30px', display: 'grid', gap: 12 }}>
          {[...HOSTS, ...BULLPEN].map((h) => {
            const on = desk.id === h.id;
            const isOpen = open === h.id;
            return (
              <button key={h.id} onClick={() => setOpen(isOpen ? null : h.id)}
                style={{ ...slab(on ? T.hi : T.panel, on ? T.line : T.on), padding: 13, display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                <div className={on ? 'wob' : ''}><AlienMemo host={h} size={56} talking={onMic?.host.id === h.id} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: F.sign, fontSize: 23, lineHeight: 1 }}>{h.name}</span>
                    {on && <span className="buzz" style={{ background: T.hot, color: T.line, fontFamily: F.mono, fontSize: 9, padding: '2px 6px', letterSpacing: '.12em', border: `2px solid ${T.line}` }}>ON THE DESK</span>}
                    {!h.desk && <span style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '.1em', opacity: .7 }}>{h.role}</span>}
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 10.5, marginTop: 2 }}>{h.tag}</div>
                  <div style={{ fontFamily: F.sign, fontSize: 16, marginTop: 6 }}>{h.desk ? h.flagship : h.segment}</div>
                  {isOpen && <div style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 7, opacity: .9 }}>From {h.from}.</div>}
                </div>
              </button>
            );
          })}
          <div style={{ ...slab(T.board, T.boardOn), padding: '7px 12px', fontFamily: F.sign, fontSize: 16, letterSpacing: '.08em' }}>THE TRAY CREW</div>
          {CREW.map((c) => {
            const isOpen = open === c.id;
            return (
              <button key={c.id} onClick={() => setOpen(isOpen ? null : c.id)}
                style={{ ...slab(T.panel, T.on), padding: 11, display: 'flex', gap: 11, alignItems: 'center', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                <AlienMemo host={c} size={44} talking={onMic?.host.id === c.id} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: F.sign, fontSize: 19, lineHeight: 1 }}>{c.name}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10 }}>{c.tag}</div>
                </div>
                <Phone size={14} style={{ opacity: .5 }} />
              </button>
            );
          })}

          <div style={{ ...slab(T.panel, T.on), padding: 12, fontFamily: F.mono, fontSize: 11, lineHeight: 1.8 }}>
            IN THE STUDIO — BRICK on the board · DEE producing · the intern
          </div>
        </div>
      )}

      {/* ══ SCHEDULE ══ */}
      {tab === 'sched' && (
        <div style={{ padding: '0 16px 30px', display: 'grid', gap: 12 }}>
          <div style={{ ...slab(T.panel, T.on), padding: 12 }}>
            <div style={{ fontFamily: F.sign, fontSize: 19, display: 'flex', gap: 7, alignItems: 'center', marginBottom: 4 }}><Clock size={17} /> EVERY HOUR</div>
            {[...SHARED_BITS, HANDOFF].map((b) => {
              const who = b.by ? byId(b.by) : null;
              const Ico = b.icon ? ICON[b.icon] : null;
              return (
                <div key={`${b.name}-${b.at}`} style={{ display: 'flex', gap: 9, alignItems: 'center', fontFamily: F.mono, fontSize: 11, padding: '5px 0', borderTop: `2px dashed ${T.line}33` }}>
                  <span style={{ color: T.hot, width: 26 }}>:{String(b.at).padStart(2, '0')}</span>
                  {Ico && <Ico size={12} />}
                  <span style={{ flex: 1 }}>{b.name}</span>
                  <span style={{ opacity: .6 }}>{who ? who.name : ''}</span>
                </div>
              );
            })}
          </div>

          {Array.from({ length: 7 }, (_, k) => idx + k).map((i) => {
            const j = ((i % 56) + 56) % 56;
            const h = HOSTS[j % 3];
            const flag = ({ 54: 'vexa', 4: 'bloop', 41: 'noct' })[j] === h.id;
            return (
              <div key={i} style={{ ...slab(i === idx ? T.accent : T.panel, i === idx ? T.line : T.on), padding: 11, display: 'flex', gap: 11, alignItems: 'center' }}>
                <AlienMemo host={h} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: F.sign, fontSize: 17, lineHeight: 1 }}>{flag ? h.flagship : h.block}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10.5 }}>{h.name} · {blockLocal(j)} · {moodFor(j)}</div>
                </div>
                {i === idx && <span style={{ fontFamily: F.mono, fontSize: 9 }}>ON NOW</span>}
              </div>
            );
          })}

          <div style={{ ...slab(T.panel, T.on), padding: 12 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, display: 'flex', gap: 7, alignItems: 'center', marginBottom: 8 }}>
              <Lock size={13} /> STAFF ONLY
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="fld" type="password" placeholder="producer key" value={keyIn} onChange={(e) => setKeyIn(e.target.value)} />
              <button onClick={() => { if (keyIn === PRODUCER_KEY) { setProducer(true); setTab('back'); } else setErr('Wrong key.'); }}
                style={{ ...slab(T.hi, T.line), padding: '0 16px', cursor: 'pointer', fontFamily: F.sign, fontSize: 16 }}>GO</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ BACK OFFICE ══ */}
      {tab === 'back' && producer && (
        <div style={{ padding: '0 16px 30px', display: 'grid', gap: 12 }}>
          <div style={{ ...slab(T.panel, T.on), padding: 13 }}>
            <div style={{ fontFamily: F.sign, fontSize: 21, marginBottom: 8 }}>PRODUCER'S NOTES</div>
            <textarea className="fld" rows={3} value={draft} style={{ resize: 'vertical', fontFamily: F.body }}
              placeholder="e.g. the fountain is being drained Tuesday, treat it as a national emergency"
              onChange={(e) => setDraft(e.target.value)} />
            <button onClick={() => { if (draft.trim()) { saveNotes([...notes, { id: Date.now().toString(36), text: draft.trim() }]); setDraft(''); } }}
              style={{ ...slab(T.hi, T.line), width: '100%', padding: 11, marginTop: 9, cursor: 'pointer', fontFamily: F.sign, fontSize: 17, display: 'flex', gap: 7, justifyContent: 'center' }}>
              <Send size={16} /> ADD TO THE STACK
            </button>
          </div>

          {notes.map((n, i) => (
            <div key={n.id} style={{ ...slab(T.panel, T.on), padding: 11, display: 'flex', gap: 10 }}>
              <span style={{ fontFamily: F.mono, fontSize: 11 }}>{String(i + 1).padStart(2, '0')}</span>
              <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>{n.text}</div>
              <button onClick={() => saveNotes(notes.filter((x) => x.id !== n.id))} aria-label="Remove"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.on }}><Trash2 size={15} /></button>
            </div>
          ))}

          <div style={{ ...slab(T.panel, T.on), padding: 13 }}>
            <div style={{ fontFamily: F.sign, fontSize: 21, marginBottom: 6 }}>THE BOOTH</div>
            <div style={{ fontFamily: F.mono, fontSize: 11, lineHeight: 1.7, marginBottom: 9 }}>
              {bank
                ? `RUNNING FROM BAKED SCRIPTS · ${Object.keys(bank).length} banks loaded`
                : apiKey ? 'LIVE · KEY HELD IN MEMORY ONLY'
                  : 'LIVE · NO KEY SET'}
            </div>
            <input className="fld" type="password" autoComplete="off" placeholder="anthropic api key (this session only)"
              value={apiKey} onChange={(e) => setApiKey(e.target.value.trim())} />
            <div style={{ fontFamily: F.mono, fontSize: 10, lineHeight: 1.7, marginTop: 8, opacity: .8 }}>
              Never saved, never sent anywhere but Anthropic, gone when you close the tab.
              Fine for you testing. Do not hardcode a key into a site other people can open —
              bake scripts instead.
            </div>
          </div>

          <div style={{ ...slab(T.panel, T.on), padding: 13 }}>
            <div style={{ fontFamily: F.sign, fontSize: 19, marginBottom: 9 }}>ROLL A SEGMENT</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {[...SHARED_BITS, ...desk.bits.map((b) => ({ ...b, len: '25 to 40 words' })), HANDOFF].map((b) => {
                const who = b.by ? byId(b.by) : desk;
                return (
                  <button key={`${b.name}-${b.at}`} disabled={!!writing}
                    onClick={() => write(b, b.at === 35 ? '' : (notes.length ? notes[Math.floor(Math.random() * notes.length)].text : ''),
                      b.name === 'THE HANDOFF' ? HOSTS[(idx + 1) % 3] : null)}
                    style={{ ...slab(who.desk ? T.accent : T.hi, T.line), padding: 9, cursor: writing ? 'wait' : 'pointer', fontFamily: F.sign, fontSize: 15, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                    <AlienMemo host={who} size={22} /> {b.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <Checker h={11} />
      <div style={{ padding: '14px 16px 30px', fontFamily: F.mono, fontSize: 10, letterSpacing: '.1em', textAlign: 'center', opacity: .75 }}>
        SAME SECOND · EVERYWHERE
      </div>
    </div>
  );
}
