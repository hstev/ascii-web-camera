// ASCII//CAM — live camera rendered as ASCII.
// Everything runs locally in the browser; no frame ever leaves the device.

const $ = (s) => document.querySelector(s);

const FONT = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
const CHAR_ASPECT = 0.6; // width / height of a monospace cell
const COLOR_LEVELS = 16;
const FADE_IN_MS = 900; // noise-to-image transition when the camera starts
const TRAIL_MS = 520; // how long the pointer glow lingers
const RIPPLE_MS = 1300;

// ---------- Translations ----------
const I18N = {
  en: {
    screen: 'Camera view rendered as ASCII',
    language: 'Language',
    controls: 'Controls',
    idleTitle: 'See yourself in code.',
    idleMsg: 'Turn on your camera to render what it sees as live ASCII. Nothing leaves your device.',
    enable: 'Enable camera',
    retry: 'Try again',
    deniedTitle: 'Camera access is blocked.',
    deniedMsg: 'Allow camera access from the icon in the address bar, then try again.',
    errorTitle: 'Couldn’t open the camera.',
    errorMsg: 'Check that it’s connected and that no other app is using it.',
    unsupportedTitle: 'Camera not available.',
    unsupportedMsg: 'This browser can’t use the camera here. Open the app over HTTPS or from localhost.',
    settings: 'Settings',
    closeSettings: 'Close settings',
    palette: 'Palette',
    paletteName: (n) => `${n} palette`,
    background: 'Background',
    foreground: 'Characters',
    charset: 'Characters',
    cs_matrix: 'Matrix (katakana)',
    cs_classic: 'Classic',
    cs_detailed: 'Detailed',
    cs_blocks: 'Blocks',
    cs_binary: 'Binary',
    density: 'Density',
    cols: 'cols',
    contrast: 'Contrast',
    rain: 'Digital rain',
    crt: 'CRT effect',
    invert: 'Invert',
    mirror: 'Mirror',
    capture: 'Take photo (Space bar)',
    flip: 'Switch camera',
    photo: 'Photo',
    photoAlt: 'Captured ASCII photo',
    close: 'Close',
    share: 'Share',
    download: 'Download',
    copyText: 'Copy text',
    copied: 'ASCII copied to clipboard',
    copyFailed: 'Couldn’t copy the text',
    shareFailed: 'Couldn’t share',
    shareFallback: 'Your browser can’t share images, so it was downloaded',
    captureFailed: 'Couldn’t capture the image',
    palettes: { matrix: 'Matrix', amber: 'Amber', cyan: 'Cyan', neon: 'Neon', paper: 'Paper' },
  },
  es: {
    screen: 'Vista de la cámara convertida a ASCII',
    language: 'Idioma',
    controls: 'Controles',
    idleTitle: 'Mírate en código.',
    idleMsg: 'Activa la cámara para convertir lo que ves en ASCII en tiempo real. Nada sale de tu dispositivo.',
    enable: 'Activar cámara',
    retry: 'Reintentar',
    deniedTitle: 'La cámara está bloqueada.',
    deniedMsg: 'Permite el acceso a la cámara desde el icono de la barra de direcciones y vuelve a intentarlo.',
    errorTitle: 'No se pudo abrir la cámara.',
    errorMsg: 'Revisa que esté conectada y que ninguna otra app la esté usando.',
    unsupportedTitle: 'Cámara no disponible.',
    unsupportedMsg: 'Este navegador no permite usar la cámara aquí. Abre la app con HTTPS o desde localhost.',
    settings: 'Ajustes',
    closeSettings: 'Cerrar ajustes',
    palette: 'Paleta',
    paletteName: (n) => `Paleta ${n}`,
    background: 'Fondo',
    foreground: 'Caracteres',
    charset: 'Caracteres',
    cs_matrix: 'Matrix (katakana)',
    cs_classic: 'Clásico',
    cs_detailed: 'Detallado',
    cs_blocks: 'Bloques',
    cs_binary: 'Binario',
    density: 'Densidad',
    cols: 'col',
    contrast: 'Contraste',
    rain: 'Lluvia digital',
    crt: 'Efecto CRT',
    invert: 'Invertir',
    mirror: 'Espejo',
    capture: 'Tomar foto (barra espaciadora)',
    flip: 'Cambiar cámara',
    photo: 'Foto',
    photoAlt: 'Foto capturada en arte ASCII',
    close: 'Cerrar',
    share: 'Compartir',
    download: 'Descargar',
    copyText: 'Copiar texto',
    copied: 'ASCII copiado al portapapeles',
    copyFailed: 'No se pudo copiar el texto',
    shareFailed: 'No se pudo compartir',
    shareFallback: 'Tu navegador no comparte imágenes: la descargamos',
    captureFailed: 'No se pudo capturar la imagen',
    palettes: { matrix: 'Matrix', amber: 'Ámbar', cyan: 'Cian', neon: 'Neón', paper: 'Papel' },
  },
};
const t = (key) => I18N[settings.lang][key];

// ---------- Charsets & palettes ----------
const DENSE_FIRST = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ";

const CHARSETS = {
  matrix: { chars: ' .:ｰｨｼﾂﾘｱｳｴｵｶｷｸｹｺｻｽｾｿﾀﾁﾃﾅﾆﾇﾈﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾙﾚﾛﾜ012345789Z', random: true },
  classic: { chars: ' .:-=+*#%@' },
  detailed: { chars: [...DENSE_FIRST].reverse().join('') },
  blocks: { chars: ' ░▒▓█' },
  binary: { chars: ' 01', random: true },
};

const PALETTES = [
  { id: 'matrix', bg: '#020a04', fg: '#00ff41', hi: '#d4ffd9' },
  { id: 'amber', bg: '#0d0700', fg: '#ffb000', hi: '#fff1c9' },
  { id: 'cyan', bg: '#00080d', fg: '#00e5ff', hi: '#e0fdff' },
  { id: 'neon', bg: '#0c0010', fg: '#ff2bd6', hi: '#ffe3fa' },
  { id: 'paper', bg: '#f1ede3', fg: '#1b1b1b', hi: '#000000' },
];

const DEFAULTS = {
  lang: 'en',
  palette: 'matrix',
  bg: PALETTES[0].bg,
  fg: PALETTES[0].fg,
  charset: 'matrix',
  cols: matchMedia('(max-width: 600px)').matches ? 72 : 132,
  contrast: 1.3,
  rain: true,
  crt: true,
  invert: false,
  mirror: true,
};

const STORAGE_KEY = 'ascii-cam:settings';
const settings = { ...DEFAULTS, ...loadSettings() };
if (!CHARSETS[settings.charset]) settings.charset = DEFAULTS.charset;
if (!I18N[settings.lang]) settings.lang = DEFAULTS.lang;

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function saveSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* no storage */ }
}

// ---------- Elements ----------
const canvas = $('#screen');
const ctx = canvas.getContext('2d', { alpha: false });
const video = $('#video');
const sampler = document.createElement('canvas');
const sctx = sampler.getContext('2d', { willReadFrequently: true });
const atlas = document.createElement('canvas');
const actx = atlas.getContext('2d');

// ---------- State ----------
let cols = 0, rows = 0, gw = 0, gh = 0;
let values = new Float32Array(0);
let touch = new Float32Array(0); // pointer energy per cell, recomputed every frame
let radial = new Float32Array(0); // distance from the centre, for the ambient field
let charIdx = new Uint16Array(0);
let drops = [];
let chars = [];
let colors = [];
let state = 'idle'; // idle | starting | live | denied | error | unsupported
let stream = null;
let facing = 'user';
let fadeUntil = 0;
let lo = 0, hi = 1;
let lastT = performance.now();

// ---------- Colours ----------
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const rgb = (c) => `rgb(${c[0]} ${c[1]} ${c[2]})`;
const luminance = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

function currentPalette() {
  const p = PALETTES.find((p) => p.id === settings.palette);
  if (p) return p;
  const fg = hexToRgb(settings.fg);
  return { id: 'custom', bg: settings.bg, fg: settings.fg, hi: rgbToHex(mix(fg, [255, 255, 255], 0.75)) };
}

function buildColors() {
  const p = currentPalette();
  const bg = hexToRgb(p.bg), fg = hexToRgb(p.fg), hiC = hexToRgb(p.hi);
  colors = [];
  for (let i = 0; i < COLOR_LEVELS; i++) {
    const k = i / (COLOR_LEVELS - 1);
    // Low levels never vanish completely; the top ones approach tinted white.
    const c = k < 0.82 ? mix(bg, fg, 0.18 + (k / 0.82) * 0.82) : mix(fg, hiC, (k - 0.82) / 0.18);
    colors.push(rgb(c));
  }
  const root = document.documentElement.style;
  root.setProperty('--bg', p.bg);
  root.setProperty('--fg', p.fg);
  root.setProperty('--hi', p.hi);
  root.colorScheme = luminance(bg) > 0.5 ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]').content = p.bg;
}

// Atlas: one row per colour level, one column per character. Drawn once,
// after which every cell is a cheap drawImage.
function buildAtlas() {
  chars = [...CHARSETS[settings.charset].chars];
  atlas.width = chars.length * gw;
  atlas.height = COLOR_LEVELS * gh;
  actx.clearRect(0, 0, atlas.width, atlas.height);
  actx.font = `600 ${Math.round(gh * 0.86)}px ${FONT}`;
  actx.textAlign = 'center';
  actx.textBaseline = 'middle';
  for (let c = 0; c < COLOR_LEVELS; c++) {
    const color = colors[c];
    actx.fillStyle = color;
    actx.shadowColor = color;
    actx.shadowBlur = settings.crt ? gw * 0.9 * (c / COLOR_LEVELS) : 0;
    for (let i = 1; i < chars.length; i++) {
      const x = i * gw, y = c * gh;
      actx.save();
      actx.beginPath();
      actx.rect(x, y, gw, gh);
      actx.clip();
      actx.fillText(chars[i], x + gw / 2, y + gh / 2 + gh * 0.04);
      actx.restore();
    }
  }
}

// ---------- Layout ----------
function layout() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth * dpr, H = window.innerHeight * dpr;
  gw = Math.max(4, Math.floor(W / settings.cols));
  gh = Math.round(gw / CHAR_ASPECT);
  cols = Math.ceil(W / gw);
  rows = Math.ceil(H / gh);
  canvas.width = cols * gw;
  canvas.height = rows * gh;
  sampler.width = cols;
  sampler.height = rows;
  values = new Float32Array(cols * rows);
  touch = new Float32Array(cols * rows);
  charIdx = new Uint16Array(cols * rows);
  radial = new Float32Array(cols * rows);
  const ay = gh / gw;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) radial[y * cols + x] = Math.hypot(x - cols / 2, (y - rows / 2) * ay);
  }
  buildColors();
  buildAtlas();
  initRain();
}

// ---------- Digital rain ----------
function newDrop(initial) {
  return {
    y: initial ? Math.random() * rows * 1.5 - rows * 0.5 : -Math.random() * rows * 0.8,
    speed: 0.008 + Math.random() * 0.022, // rows per ms
    len: 6 + Math.random() * Math.max(8, rows * 0.35),
  };
}
function initRain() {
  drops = Array.from({ length: cols }, () => newDrop(true));
}
function applyRain(dt, strength) {
  for (let x = 0; x < cols; x++) {
    const d = drops[x];
    d.y += d.speed * dt;
    if (d.y - d.len > rows) drops[x] = newDrop(false);
    const head = Math.floor(d.y);
    for (let k = 0; k < d.len; k++) {
      const y = head - k;
      if (y < 0) break;
      if (y >= rows) continue;
      const v = (k === 0 ? 1 : (1 - k / d.len) * 0.78) * strength;
      const i = y * cols + x;
      if (v > values[i]) values[i] = v;
    }
  }
}

// ---------- Pointer / touch: plasma effect ----------
const trail = []; // { x, y, t } in cell units
const ripples = []; // { x, y, t, amp }
let lastRipple = 0;

function toCell(e) {
  // The canvas uses object-fit: cover, so undo that scale and offset.
  const scale = Math.max(window.innerWidth / canvas.width, window.innerHeight / canvas.height);
  const offX = (window.innerWidth - canvas.width * scale) / 2;
  const offY = (window.innerHeight - canvas.height * scale) / 2;
  return { x: (e.clientX - offX) / scale / gw, y: (e.clientY - offY) / scale / gh };
}

function addRipple(p, amp) {
  ripples.push({ x: p.x, y: p.y, t: performance.now(), amp });
  if (ripples.length > 8) ripples.shift();
}

window.addEventListener('pointermove', (e) => {
  if ($('#photo').open) return;
  const now = performance.now();
  const coalesced = e.getCoalescedEvents?.() ?? [];
  const events = coalesced.length ? coalesced : [e];
  for (const ev of events) {
    const p = toCell(ev);
    const prev = trail[trail.length - 1];
    // Fill gaps on fast moves so the trail stays continuous.
    if (prev && now - prev.t < 80) {
      const steps = Math.min(12, Math.floor(Math.hypot(p.x - prev.x, p.y - prev.y) / 1.5));
      for (let s = 1; s < steps; s++) {
        const k = s / steps;
        trail.push({ x: prev.x + (p.x - prev.x) * k, y: prev.y + (p.y - prev.y) * k, t: now });
      }
    }
    trail.push({ ...p, t: now });
  }
  if (trail.length > 600) trail.splice(0, trail.length - 600);
  if (now - lastRipple > 200) {
    lastRipple = now;
    addRipple(trail[trail.length - 1], 0.55);
  }
}, { passive: true });

window.addEventListener('pointerdown', (e) => {
  if ($('#photo').open) return;
  const p = toCell(e);
  trail.push({ ...p, t: performance.now() });
  addRipple(p, 1);
}, { passive: true });

function computeTouch(now) {
  while (trail.length && now - trail[0].t > TRAIL_MS) trail.shift();
  while (ripples.length && now - ripples[0].t > RIPPLE_MS) ripples.shift();
  if (!trail.length && !ripples.length) return false;
  touch.fill(0);
  const ay = gh / gw; // a cell's height in column units
  const R = Math.max(2.5, cols * 0.035);

  for (const p of trail) {
    const age = (now - p.t) / TRAIL_MS;
    const amp = (1 - age) * (1 - age);
    const r = R * (1 + age * 0.7);
    const x0 = Math.max(0, Math.floor(p.x - r)), x1 = Math.min(cols - 1, Math.ceil(p.x + r));
    const y0 = Math.max(0, Math.floor(p.y - r / ay)), y1 = Math.min(rows - 1, Math.ceil(p.y + r / ay));
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - p.y) * ay;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - p.x;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= r) continue;
        const f = 1 - d / r;
        const v = f * f * amp;
        const i = y * cols + x;
        if (v > touch[i]) touch[i] = v;
      }
    }
  }

  const maxR = Math.max(cols, rows * ay) * 0.45;
  for (const rp of ripples) {
    const age = (now - rp.t) / RIPPLE_MS;
    const radius = age * maxR * (0.5 + rp.amp * 0.5);
    const width = 1.6 + age * 3;
    const amp = rp.amp * (1 - age) ** 1.3;
    const out = radius + width;
    const x0 = Math.max(0, Math.floor(rp.x - out)), x1 = Math.min(cols - 1, Math.ceil(rp.x + out));
    const y0 = Math.max(0, Math.floor(rp.y - out / ay)), y1 = Math.min(rows - 1, Math.ceil(rp.y + out / ay));
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - rp.y) * ay;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - rp.x;
        const k = 1 - Math.abs(Math.sqrt(dx * dx + dy * dy) - radius) / width;
        if (k <= 0) continue;
        const i = y * cols + x;
        touch[i] = Math.min(1, touch[i] + k * amp);
      }
    }
  }
  for (let i = 0; i < values.length; i++) {
    const tv = touch[i];
    if (tv > 0.01) values[i] = Math.min(1, Math.max(values[i], tv) + tv * 0.6);
  }
  return true;
}

// ---------- Image sources ----------
// Ambient field shown before the camera is on: slow plasma waves plus sparkle.
function sampleAmbient(time) {
  const s = time * 0.0006;
  for (let y = 0; y < rows; y++) {
    const wy = Math.sin(y * 0.13 - s * 1.3);
    const row = y * cols;
    for (let x = 0; x < cols; x++) {
      const i = row + x;
      const p = Math.sin(x * 0.09 + s) + wy + Math.sin((x + y) * 0.05 + s * 0.7) + Math.sin(radial[i] * 0.12 - s * 1.6);
      // Only the wave crests light up; the rest stays dark, with a few sparks.
      const crest = Math.max(0, (p + 4) / 8 - 0.5) * 1.3;
      const r = Math.random();
      values[i] = crest + (r > 0.96 ? r * 0.35 : 0);
    }
  }
}

function sampleVideo() {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh || video.readyState < 2) return false;
  const target = canvas.width / canvas.height;
  let sw = vw, sh = vw / target;
  if (sh > vh) { sh = vh; sw = vh * target; }
  const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
  sctx.save();
  if (settings.mirror) { sctx.translate(cols, 0); sctx.scale(-1, 1); }
  sctx.drawImage(video, sx, sy, sw, sh, 0, 0, cols, rows);
  sctx.restore();
  const d = sctx.getImageData(0, 0, cols, rows).data;

  let mn = 1, mx = 0;
  for (let i = 0, p = 0; i < values.length; i++, p += 4) {
    const l = (0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]) / 255;
    values[i] = l;
    if (l < mn) mn = l;
    if (l > mx) mx = l;
  }
  // Smoothed auto-levels so the whole ramp gets used.
  lo += (mn - lo) * 0.08;
  hi += (mx - hi) * 0.08;
  const range = Math.max(0.2, hi - lo);
  const c = settings.contrast;
  for (let i = 0; i < values.length; i++) {
    let v = (values[i] - lo) / range;
    v = (v - 0.5) * c + 0.5;
    if (settings.invert) v = 1 - v;
    values[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  return true;
}

// ---------- Render ----------
function render(time, touched) {
  ctx.fillStyle = currentPalette().bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const nC = chars.length;
  const random = CHARSETS[settings.charset].random;
  const slow = time / 650;
  const fast = (time / 55) | 0;
  for (let y = 0; y < rows; y++) {
    const row = y * cols;
    for (let x = 0; x < cols; x++) {
      const i = row + x;
      const v = values[i];
      let ci = Math.min(nC - 1, (v * nC) | 0);
      if (ci === 0) { charIdx[i] = 0; continue; }
      const scramble = touched && touch[i] > 0.12;
      if (random || scramble) {
        // Each cell changes symbol at its own pace, like Matrix code;
        // cells under the finger flicker much faster.
        const tick = scramble ? fast : (slow + ((x * 7 + y * 13) % 17) / 17) | 0;
        const h = Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ Math.imul(tick, 83492791);
        ci = 1 + ((h >>> 0) % (nC - 1));
      }
      charIdx[i] = ci;
      const cl = Math.min(COLOR_LEVELS - 1, (v * COLOR_LEVELS) | 0);
      ctx.drawImage(atlas, ci * gw, cl * gh, gw, gh, x * gw, y * gh, gw, gh);
    }
  }
}

function frame(time) {
  const dt = Math.min(64, time - lastT);
  lastT = time;
  const live = state === 'live' && sampleVideo();
  if (live) {
    const k = (fadeUntil - time) / FADE_IN_MS;
    if (k > 0) {
      for (let i = 0; i < values.length; i++) values[i] = values[i] * (1 - k) + Math.random() * k;
    }
  } else {
    sampleAmbient(time);
  }
  if (settings.rain) applyRain(dt, live ? 0.85 : 0.6);
  const touched = computeTouch(time);
  render(time, touched);
  requestAnimationFrame(frame);
}

// ---------- Camera ----------
const GATE = {
  idle: ['idleTitle', 'idleMsg', 'enable'],
  denied: ['deniedTitle', 'deniedMsg', 'retry'],
  error: ['errorTitle', 'errorMsg', 'retry'],
  unsupported: ['unsupportedTitle', 'unsupportedMsg', 'retry'],
};

function setState(s) {
  state = s;
  const g = GATE[s];
  $('#gate').hidden = !g;
  if (g) {
    $('#gate-title').textContent = t(g[0]);
    $('#gate-msg').textContent = t(g[1]);
    $('#enable-label').textContent = t(g[2]);
  }
  $('#enable').disabled = s === 'starting';
}

function stopStream() {
  stream?.getTracks().forEach((tr) => tr.stop());
  stream = null;
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) return setState('unsupported');
  setState('starting');
  stopStream();
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    stream.getVideoTracks()[0].addEventListener('ended', () => setState('error'));
    fadeUntil = performance.now() + FADE_IN_MS;
    lo = 0; hi = 1;
    setState('live');
    updateFlip();
  } catch (err) {
    console.warn('[ascii-cam]', err);
    setState(err.name === 'NotAllowedError' || err.name === 'SecurityError' ? 'denied' : 'error');
  }
}

async function updateFlip() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    $('#flip').disabled = devices.filter((d) => d.kind === 'videoinput').length < 2;
  } catch { /* ignore */ }
}

$('#enable').addEventListener('click', startCamera);
$('#flip').addEventListener('click', () => {
  facing = facing === 'user' ? 'environment' : 'user';
  settings.mirror = facing === 'user';
  $('#mirror').checked = settings.mirror;
  startCamera();
});

// If permission was already granted, start right away.
navigator.permissions?.query({ name: 'camera' }).then((p) => {
  if (p.state === 'granted') startCamera();
}).catch(() => {});

// ---------- Capture & share ----------
let shot = null; // { blob, url, text, name }
const photo = $('#photo');

function asciiText() {
  const lines = [];
  for (let y = 0; y < rows; y++) {
    let line = '';
    for (let x = 0; x < cols; x++) line += chars[charIdx[y * cols + x]] || ' ';
    lines.push(line.replace(/\s+$/, ''));
  }
  return lines.join('\n');
}

async function capture() {
  if (photo.open) return;
  const flash = $('#flash');
  flash.classList.remove('go');
  void flash.offsetWidth;
  flash.classList.add('go');
  const text = asciiText();
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) return toast(t('captureFailed'));
  if (shot) URL.revokeObjectURL(shot.url);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  shot = { blob, text, url: URL.createObjectURL(blob), name: `ascii-cam-${stamp}.png` };
  $('#photo-img').src = shot.url;
  photo.showModal();
}

$('#shutter').addEventListener('click', capture);
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat) return;
  if (e.target.closest?.('input, select, button, textarea, dialog')) return;
  e.preventDefault();
  capture();
});

function download() {
  const a = document.createElement('a');
  a.href = shot.url;
  a.download = shot.name;
  a.click();
}

$('#share').addEventListener('click', async () => {
  const file = new File([shot.blob], shot.name, { type: 'image/png' });
  const data = { files: [file], title: 'ASCII Cam' };
  if (navigator.canShare?.(data)) {
    try {
      await navigator.share(data);
    } catch (err) {
      if (err.name !== 'AbortError') toast(t('shareFailed'));
    }
  } else {
    download();
    toast(t('shareFallback'));
  }
});
$('#download').addEventListener('click', download);
$('#copy-text').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shot.text);
    toast(t('copied'));
  } catch {
    toast(t('copyFailed'));
  }
});

// closedby="any" isn't in Safari yet: close on outside tap as a fallback.
if (!('closedBy' in HTMLDialogElement.prototype)) {
  const outside = (e) => {
    const r = photo.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  let pressedOutside = false;
  photo.addEventListener('pointerdown', (e) => { pressedOutside = outside(e); });
  photo.addEventListener('pointerup', (e) => { if (pressedOutside && outside(e)) photo.close(); });
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------- Language ----------
function applyLanguage() {
  document.documentElement.lang = settings.lang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of document.querySelectorAll('[data-i18n-alt]')) el.alt = t(el.dataset.i18nAlt);
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === settings.lang));
  renderSwatches();
  syncControls();
  setState(state);
}

for (const b of document.querySelectorAll('[data-lang]')) {
  b.addEventListener('click', () => {
    settings.lang = b.dataset.lang;
    saveSettings();
    applyLanguage();
  });
}

// ---------- Settings ----------
function renderSwatches() {
  const names = t('palettes');
  $('#swatches').replaceChildren(...PALETTES.map((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.textContent = '@';
    b.dataset.palette = p.id;
    b.title = names[p.id];
    b.setAttribute('aria-label', t('paletteName')(names[p.id]));
    b.style.background = p.bg;
    b.style.color = p.fg;
    b.style.textShadow = `0 0 8px ${p.fg}`;
    b.addEventListener('click', () => {
      Object.assign(settings, { palette: p.id, bg: p.bg, fg: p.fg });
      syncControls();
      applyVisuals();
    });
    return b;
  }));
}

function syncControls() {
  const p = currentPalette();
  $('#bg-color').value = p.bg;
  $('#fg-color').value = p.fg;
  $('#charset').value = settings.charset;
  $('#density').value = settings.cols;
  $('#density-out').textContent = `${settings.cols} ${t('cols')}`;
  $('#contrast').value = settings.contrast;
  $('#contrast-out').textContent = `${Number(settings.contrast).toFixed(1)}×`;
  for (const id of ['rain', 'crt', 'invert', 'mirror']) $('#' + id).checked = settings[id];
  document.body.classList.toggle('crt-on', settings.crt);
  for (const b of document.querySelectorAll('.swatch')) {
    b.setAttribute('aria-pressed', String(b.dataset.palette === settings.palette));
  }
}

function applyVisuals() {
  buildColors();
  buildAtlas();
  saveSettings();
}

for (const id of ['bg-color', 'fg-color']) {
  $('#' + id).addEventListener('input', () => {
    settings.palette = 'custom';
    settings.bg = $('#bg-color').value;
    settings.fg = $('#fg-color').value;
    syncControls();
    applyVisuals();
  });
}
$('#charset').addEventListener('change', (e) => {
  settings.charset = e.target.value;
  applyVisuals();
});
$('#density').addEventListener('input', (e) => {
  settings.cols = Number(e.target.value);
  syncControls();
  layout();
  saveSettings();
});
$('#contrast').addEventListener('input', (e) => {
  settings.contrast = Number(e.target.value);
  syncControls();
  saveSettings();
});
for (const id of ['rain', 'crt', 'invert', 'mirror']) {
  $('#' + id).addEventListener('change', (e) => {
    settings[id] = e.target.checked;
    syncControls();
    if (id === 'crt') buildAtlas();
    saveSettings();
  });
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(layout, 120);
});

// ---------- Boot ----------
applyLanguage();
layout();
requestAnimationFrame(frame);
// Rebuild the atlas once the web font has loaded.
document.fonts?.load(`600 20px "JetBrains Mono"`).then(buildAtlas).catch(() => {});
