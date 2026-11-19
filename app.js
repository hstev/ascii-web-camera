// ASCII//CAM — cámara en tiempo real convertida a ASCII.
// Todo se procesa localmente en el navegador; ningún fotograma sale del dispositivo.

const $ = (s) => document.querySelector(s);

const FONT = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
const CHAR_ASPECT = 0.6; // ancho / alto de una celda monoespaciada
const COLOR_LEVELS = 16;
const SOLID_CHAR = '█'; // siempre al final del atlas, para el letrero de "sin señal"
const TUNE_MS = 900; // transición "sintonizando" al encender la cámara

const DENSE_FIRST = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ";

const CHARSETS = {
  matrix: { chars: ' .:ｰｨｼﾂﾘｱｳｴｵｶｷｸｹｺｻｽｾｿﾀﾁﾃﾅﾆﾇﾈﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾙﾚﾛﾜ012345789Z', random: true },
  clasico: { chars: ' .:-=+*#%@' },
  detallado: { chars: [...DENSE_FIRST].reverse().join('') },
  bloques: { chars: ' ░▒▓█' },
  binario: { chars: ' 01', random: true },
};

const PALETTES = [
  { id: 'matrix', name: 'Matrix', bg: '#020a04', fg: '#00ff41', hi: '#d4ffd9' },
  { id: 'ambar', name: 'Ámbar', bg: '#0d0700', fg: '#ffb000', hi: '#fff1c9' },
  { id: 'cian', name: 'Cian', bg: '#00080d', fg: '#00e5ff', hi: '#e0fdff' },
  { id: 'neon', name: 'Neón', bg: '#0c0010', fg: '#ff2bd6', hi: '#ffe3fa' },
  { id: 'papel', name: 'Papel', bg: '#f1ede3', fg: '#1b1b1b', hi: '#000000' },
];

const DEFAULTS = {
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

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function saveSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* sin almacenamiento */ }
}

// ---------- Elementos ----------
const canvas = $('#screen');
const ctx = canvas.getContext('2d', { alpha: false });
const video = $('#video');
const sampler = document.createElement('canvas');
const sctx = sampler.getContext('2d', { willReadFrequently: true });
const atlas = document.createElement('canvas');
const actx = atlas.getContext('2d');

// ---------- Estado ----------
let cols = 0, rows = 0, gw = 0, gh = 0;
let values = new Float32Array(0);
let charIdx = new Uint16Array(0);
let mask = new Uint8Array(0); // 0 nada, 1 caja oscura, 2 texto "SIN SEÑAL"
let solid = new Uint8Array(0); // celdas que se dibujan con bloque sólido en este fotograma
let drops = [];
let chars = [];
let colors = [];
let state = 'idle'; // idle | starting | live | denied | error | unsupported
let stream = null;
let facing = 'user';
let tuneUntil = 0;
let lo = 0, hi = 1;
let lastT = performance.now();

// ---------- Colores ----------
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c) => `rgb(${c[0]} ${c[1]} ${c[2]})`;

function currentPalette() {
  const p = PALETTES.find((p) => p.id === settings.palette);
  if (p) return p;
  const fg = hexToRgb(settings.fg);
  return { id: 'custom', bg: settings.bg, fg: settings.fg, hi: rgbToHex(mix(fg, [255, 255, 255], 0.75)) };
}
const rgbToHex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

function buildColors() {
  const p = currentPalette();
  const bg = hexToRgb(p.bg), fg = hexToRgb(p.fg), hiC = hexToRgb(p.hi);
  colors = [];
  for (let i = 0; i < COLOR_LEVELS; i++) {
    const t = i / (COLOR_LEVELS - 1);
    // Los niveles bajos nunca desaparecen del todo; los altos se acercan al blanco tintado.
    const c = t < 0.82 ? mix(bg, fg, 0.18 + (t / 0.82) * 0.82) : mix(fg, hiC, (t - 0.82) / 0.18);
    colors.push(rgb(c));
  }
  const root = document.documentElement.style;
  root.setProperty('--bg', p.bg);
  root.setProperty('--fg', p.fg);
  root.setProperty('--hi', p.hi);
  document.querySelector('meta[name="theme-color"]').content = p.bg;
  document.documentElement.style.colorScheme = luminance(bg) > 0.5 ? 'light' : 'dark';
}
const luminance = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

// Atlas: una fila por nivel de color, una columna por carácter. Se dibuja una sola vez
// y luego cada celda es un drawImage barato.
function buildAtlas() {
  chars = [...CHARSETS[settings.charset].chars, SOLID_CHAR];
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
  charIdx = new Uint16Array(cols * rows);
  solid = new Uint8Array(cols * rows);
  buildColors();
  buildAtlas();
  buildMask();
  initRain();
}

// Máscara del letrero "SIN SEÑAL" dibujado con caracteres.
function buildMask() {
  const m = document.createElement('canvas');
  m.width = cols;
  m.height = rows;
  const mc = m.getContext('2d', { willReadFrequently: true });
  const portrait = cols * gw < rows * gh;
  const lines = portrait ? ['SIN', 'SEÑAL'] : ['SIN SEÑAL'];
  mc.font = `800 100px ${FONT}`;
  const widest = Math.max(...lines.map((l) => mc.measureText(l).width)) / 100;
  // Unidades: x en columnas, y en "columnas" escaladas por CHAR_ASPECT (celdas no cuadradas).
  let size = (cols * (portrait ? 0.82 : 0.7)) / widest;
  const maxH = (rows * 0.42) / CHAR_ASPECT;
  size = Math.min(size, maxH / (lines.length * 1.05));
  mc.setTransform(1, 0, 0, CHAR_ASPECT, 0, 0);
  mc.font = `800 ${size}px ${FONT}`;
  mc.textAlign = 'center';
  mc.textBaseline = 'middle';
  mc.fillStyle = '#fff';
  const cy = (rows * 0.4) / CHAR_ASPECT;
  lines.forEach((l, i) => mc.fillText(l, cols / 2, cy + (i - (lines.length - 1) / 2) * size * 1.05));

  const data = mc.getImageData(0, 0, cols, rows).data;
  mask = new Uint8Array(cols * rows);
  let x0 = cols, y0 = rows, x1 = -1, y1 = -1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (data[(y * cols + x) * 4 + 3] > 110) {
        mask[y * cols + x] = 2;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return;
  const px = 3, py = 2;
  for (let y = Math.max(0, y0 - py); y <= Math.min(rows - 1, y1 + py); y++) {
    for (let x = Math.max(0, x0 - px); x <= Math.min(cols - 1, x1 + px); x++) {
      if (!mask[y * cols + x]) mask[y * cols + x] = 1;
    }
  }
}

// ---------- Lluvia digital ----------
function newDrop(initial) {
  return {
    y: initial ? Math.random() * rows * 1.5 - rows * 0.5 : -Math.random() * rows * 0.8,
    speed: 0.008 + Math.random() * 0.022, // filas por ms
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

// ---------- Fuentes de imagen ----------
function sampleStatic(t) {
  const band = (((t * 0.00022) % 1.4) - 0.2) * rows;
  const bandW = rows * 0.09;
  const jitter = Math.random() < 0.08 ? (Math.random() < 0.5 ? -1 : 1) : 0;
  for (let y = 0; y < rows; y++) {
    const bandV = Math.max(0, 1 - Math.abs(y - band) / bandW) * 0.35;
    const tear = Math.random() < 0.015 ? 0.45 : 0;
    const row = y * cols;
    for (let x = 0; x < cols; x++) {
      const r = Math.random();
      values[row + x] = r * r * r * 0.8 + bandV + tear * Math.random();
      solid[row + x] = 0;
    }
  }
  // Letrero
  for (let y = 0; y < rows; y++) {
    const row = y * cols;
    for (let x = 0; x < cols; x++) {
      const src = x - jitter;
      const m = src >= 0 && src < cols ? mask[row + src] : 0;
      if (m === 2) { values[row + x] = 0.8 + Math.random() * 0.2; solid[row + x] = 1; }
      else if (m === 1 || mask[row + x] === 1) values[row + x] *= 0.08;
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
  // Niveles automáticos suavizados para aprovechar toda la rampa.
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
function render(t) {
  const p = currentPalette();
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const nC = chars.length - 1; // sin contar SOLID_CHAR
  const random = CHARSETS[settings.charset].random;
  const slow = t / 650;
  for (let y = 0; y < rows; y++) {
    const row = y * cols;
    for (let x = 0; x < cols; x++) {
      const i = row + x;
      const v = values[i];
      let ci = Math.min(nC - 1, (v * nC) | 0);
      if (ci === 0) { charIdx[i] = 0; continue; }
      if (solid[i]) ci = nC;
      else if (random) {
        // Cada celda cambia de símbolo a su propio ritmo, como el código de Matrix.
        const tick = (slow + ((x * 7 + y * 13) % 17) / 17) | 0;
        const h = Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ Math.imul(tick, 83492791);
        ci = 1 + ((h >>> 0) % (nC - 1));
      }
      charIdx[i] = ci;
      const cl = Math.min(COLOR_LEVELS - 1, (v * COLOR_LEVELS) | 0);
      ctx.drawImage(atlas, ci * gw, cl * gh, gw, gh, x * gw, y * gh, gw, gh);
    }
  }
}

function frame(t) {
  const dt = Math.min(64, t - lastT);
  lastT = t;
  const live = state === 'live' && sampleVideo();
  if (live) {
    solid.fill(0);
    const k = (tuneUntil - t) / TUNE_MS;
    if (k > 0) {
      for (let i = 0; i < values.length; i++) values[i] = values[i] * (1 - k) + Math.random() * k;
    }
  } else {
    sampleStatic(t);
  }
  if (settings.rain) applyRain(dt, live ? 0.85 : 0.6);
  render(t);
  requestAnimationFrame(frame);
}

// ---------- Cámara ----------
const STATUS = {
  idle: 'SIN SEÑAL',
  starting: 'SINTONIZANDO',
  live: 'EN VIVO',
  denied: 'SIN PERMISO',
  error: 'SIN SEÑAL',
  unsupported: 'NO DISPONIBLE',
};
const GATE = {
  idle: ['CH 00 · SIN SEÑAL', 'Mírate en código.', 'Activa la cámara para convertir lo que ves en ASCII en tiempo real. Nada sale de tu dispositivo.', 'Activar cámara'],
  denied: ['CH 00 · ACCESO BLOQUEADO', 'La cámara está bloqueada.', 'Permite el acceso a la cámara desde el icono de la barra de direcciones y vuelve a intentarlo.', 'Reintentar'],
  error: ['CH 00 · ERROR', 'No encontramos señal.', 'No se pudo abrir la cámara. Revisa que esté conectada y que ninguna otra app la esté usando.', 'Reintentar'],
  unsupported: ['CH 00 · NO DISPONIBLE', 'Sin acceso a cámara.', 'Este navegador no permite usar la cámara aquí. Abre la app con HTTPS o desde localhost.', 'Reintentar'],
};

function setState(s) {
  state = s;
  $('#status').dataset.state = s;
  $('#status-text').textContent = STATUS[s];
  const gate = $('#gate');
  const g = GATE[s];
  gate.hidden = !g;
  if (g) {
    [$('#gate-kicker').textContent, $('#gate-title').textContent, $('#gate-msg').textContent] = g;
    $('#enable').lastChild.textContent = ' ' + g[3];
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
    tuneUntil = performance.now() + TUNE_MS;
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

// Si el permiso ya estaba concedido, encender directamente.
navigator.permissions?.query({ name: 'camera' }).then((p) => {
  if (p.state === 'granted') startCamera();
}).catch(() => {});

// ---------- Captura y compartir ----------
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
  if (!blob) return toast('No se pudo capturar la imagen');
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
      if (err.name !== 'AbortError') toast('No se pudo compartir');
    }
  } else {
    download();
    toast('Tu navegador no comparte imágenes: la descargamos');
  }
});
$('#download').addEventListener('click', download);
$('#copy-text').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shot.text);
    toast('ASCII copiado al portapapeles');
  } catch {
    toast('No se pudo copiar el texto');
  }
});

// closedby="any" aún no existe en Safari: cierre al tocar fuera como respaldo.
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

// ---------- Ajustes ----------
function renderSwatches() {
  const wrap = $('#swatches');
  wrap.replaceChildren(...PALETTES.map((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.textContent = '@';
    b.title = p.name;
    b.setAttribute('aria-label', `Paleta ${p.name}`);
    b.style.background = p.bg;
    b.style.color = p.fg;
    b.style.textShadow = `0 0 8px ${p.fg}`;
    b.setAttribute('aria-pressed', String(settings.palette === p.id));
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
  $('#density-out').textContent = `${settings.cols} col`;
  $('#contrast').value = settings.contrast;
  $('#contrast-out').textContent = `${Number(settings.contrast).toFixed(1)}×`;
  for (const id of ['rain', 'crt', 'invert', 'mirror']) $('#' + id).checked = settings[id];
  document.body.classList.toggle('crt-on', settings.crt);
  for (const b of document.querySelectorAll('.swatch')) {
    b.setAttribute('aria-pressed', String(b.title === PALETTES.find((x) => x.id === settings.palette)?.name));
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

// ---------- Arranque ----------
renderSwatches();
syncControls();
setState('idle');
layout();
requestAnimationFrame(frame);
// Reconstruir el atlas cuando cargue la fuente web.
Promise.all([document.fonts.load(`600 20px "JetBrains Mono"`), document.fonts.load(`800 20px "JetBrains Mono"`)]).then(() => { buildAtlas(); buildMask(); }).catch(() => {});
