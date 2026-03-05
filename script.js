// ── Channel defaults ──────────────────────────────────────
const CHANNEL_COLORS = ['#ffffff', '#00d4ff', '#ffaa00', '#ff44aa'];

function defaultChannel(i) {
  return {
    enabled:     i === 0,
    color:       CHANNEL_COLORS[i],
    offsetY:     0,
    waveType:    ['sine', 'sawtooth', 'triangle', 'square'][i],
    frequency:   3,
    amplitude:   0.7,
    strokeWidth: 1,
    fm:   { enabled: false, ratio: 1.6,  depth: 0.4 },
    fold: { enabled: false, threshold: 0.3, iterations: 6 },
    am:   { enabled: false, rate: 2,     depth: 1,    shape: 'sine' },
    ws:   { enabled: false, curve: 'tanh', drive: 3 },
    adsr: { enabled: false, attack: 0.1, decay: 0.1, sustain: 0.7, release: 0.2 },
  };
}

// ── Config ────────────────────────────────────────────────
const CONFIG = {
  channels: [0, 1, 2, 3].map(defaultChannel),

  crt: {
    enabled:    false,
    color:      'cyan',
    resolution: 320,
    glow:       0.7,
    scanlines:  true,
    graticule:  true,
    bezel:      true,
  },
};

// ── Wave functions ────────────────────────────────────────
const waveFunctions = {
  sine:     (x) => Math.sin(x),
  square:   (x) => Math.sign(Math.sin(x)),
  triangle: (x) => (2 / Math.PI) * Math.asin(Math.sin(x)),
  sawtooth: (x) => ((x % (2 * Math.PI)) / Math.PI) - 1,
};

// ── Canvas setup ──────────────────────────────────────────
const canvas = document.getElementById('scope');
const ctx = canvas.getContext('2d');
const size = 1080;
canvas.width = size;
canvas.height = size;

// ── Modulation helpers ────────────────────────────────────
function waveFold(value, threshold, iterations) {
  let v = value;
  for (let i = 0; i < iterations; i++) {
    if (v > threshold) v = threshold - (v - threshold);
    else if (v < -threshold) v = -threshold - (v + threshold);
  }
  return v;
}

const waveshapeCurves = {
  tanh:     (x) => Math.tanh(x),
  hardclip: (x) => Math.max(-1, Math.min(1, x)),
  tube:     (x) => { const c = Math.max(-1, Math.min(1, x)); return c - (c * c * c) / 3; },
};

function adsrEnvelope(t, attack, decay, sustain, release) {
  if (t < attack) return attack > 0 ? t / attack : 1;
  t -= attack;
  if (t < decay) return decay > 0 ? 1 - (1 - sustain) * (t / decay) : sustain;
  t -= decay;
  const sustainEnd = Math.max(0, 1 - attack - decay - release);
  if (t < sustainEnd) return sustain;
  t -= sustainEnd;
  if (release > 0) return sustain * Math.max(0, 1 - t / release);
  return 0;
}

// ── CRT palette + helpers ─────────────────────────────────
const CRT_PALETTE = {
  cyan:    '#00ffff',
  green:   '#00ff00',
  magenta: '#ff00ff',
  amber:   '#ffaa00',
};

function hexToRgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function quantizePoints(points) {
  const vw = CONFIG.crt.resolution;
  const vh = Math.round(vw * 0.75);
  const sx = size / vw;
  const sy = size / vh;
  return points.map(({ x, y }) => ({
    x: Math.round(x / sx) * sx,
    y: Math.round(y / sy) * sy,
  }));
}

function drawGraticule(target) {
  const color = CRT_PALETTE[CONFIG.crt.color] || CRT_PALETTE.cyan;
  const divs = 8;
  target.lineWidth = 1;
  target.setLineDash([3, 6]);
  for (let i = 1; i < divs; i++) {
    const p = (i / divs) * size;
    target.strokeStyle = hexToRgba(color, i === divs / 2 ? 0.28 : 0.14);
    target.beginPath(); target.moveTo(p, 0); target.lineTo(p, size); target.stroke();
    target.beginPath(); target.moveTo(0, p); target.lineTo(size, p); target.stroke();
  }
  target.setLineDash([]);
}

function strokePath(target, points) {
  target.beginPath();
  target.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) target.lineTo(points[i].x, points[i].y);
  target.stroke();
}

function drawCRTWave(target, points, ch) {
  const gi = CONFIG.crt.glow;
  target.lineCap = 'square';
  target.lineJoin = 'miter';

  if (gi > 0) {
    target.filter = `blur(${Math.round(18 * gi)}px)`;
    target.strokeStyle = hexToRgba(ch.color, 0.45 * gi);
    target.lineWidth = ch.strokeWidth * 4;
    strokePath(target, points);

    target.filter = `blur(${Math.round(6 * gi)}px)`;
    target.strokeStyle = hexToRgba(ch.color, 0.75 * gi);
    target.lineWidth = ch.strokeWidth * 2;
    strokePath(target, points);

    target.filter = 'none';
  }

  target.strokeStyle = ch.color;
  target.lineWidth = ch.strokeWidth;
  strokePath(target, points);
}

function drawScanlines(target) {
  target.fillStyle = 'rgba(0,0,0,0.28)';
  for (let y = 0; y < size; y += 3) target.fillRect(0, y, size, 1);
}

function drawBezel(target) {
  const grad = target.createRadialGradient(size / 2, size / 2, size * 0.32, size / 2, size / 2, size * 0.74);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.65)');
  target.fillStyle = grad;
  target.fillRect(0, 0, size, size);

  const color = CRT_PALETTE[CONFIG.crt.color] || CRT_PALETTE.cyan;
  target.strokeStyle = hexToRgba(color, 0.18);
  target.lineWidth = 6;
  target.beginPath();
  target.roundRect(3, 3, size - 6, size - 6, 20);
  target.stroke();
}

// ── Compute wave points ───────────────────────────────────
function computeWave(ch) {
  const { waveType, frequency, amplitude, offsetY } = ch;
  const waveFn = waveFunctions[waveType];
  const centerY = size / 2 + offsetY * (size / 2);
  const ampPx = (size / 2) * amplitude;

  const points = [];
  for (let px = 0; px <= size; px++) {
    const baseX = (px / size) * 2 * Math.PI * frequency;

    let x = baseX;
    if (ch.fm.enabled) {
      const modX = (px / size) * 2 * Math.PI * frequency * ch.fm.ratio;
      x = baseX + ch.fm.depth * Math.sin(modX);
    }

    let sample = waveFn(x);

    if (ch.fold.enabled) {
      sample = waveFold(sample * (1 / ch.fold.threshold), 1, ch.fold.iterations);
    }

    if (ch.ws.enabled) {
      const curve = waveshapeCurves[ch.ws.curve] || waveshapeCurves.tanh;
      sample = curve(sample * ch.ws.drive) / Math.tanh(ch.ws.drive);
    }

    if (ch.am.enabled) {
      const lfoX = (px / size) * 2 * Math.PI * ch.am.rate;
      const lfo = ((waveFunctions[ch.am.shape] || waveFunctions.sine)(lfoX) + 1) / 2;
      sample *= 1 - ch.am.depth * (1 - lfo);
    }

    if (ch.adsr.enabled) {
      const { attack, decay, sustain, release } = ch.adsr;
      sample *= adsrEnvelope(px / size, attack, decay, sustain, release);
    }

    points.push({ x: px, y: centerY - sample * ampPx });
  }
  return points;
}

// ── Draw wave (vector mode) ───────────────────────────────
function drawWave(target, points, ch) {
  target.strokeStyle = ch.color;
  target.lineWidth = ch.strokeWidth;
  target.lineCap = 'round';
  target.lineJoin = 'round';
  target.beginPath();
  target.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) target.lineTo(points[i].x, points[i].y);
  target.stroke();
}

// ── Render ────────────────────────────────────────────────
function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);

  const active = CONFIG.channels.filter(ch => ch.enabled);

  if (CONFIG.crt.enabled) {
    if (CONFIG.crt.graticule) drawGraticule(ctx);
    for (const ch of active) drawCRTWave(ctx, quantizePoints(computeWave(ch)), ch);
    if (CONFIG.crt.scanlines) drawScanlines(ctx);
    if (CONFIG.crt.bezel) drawBezel(ctx);
  } else {
    for (const ch of active) drawWave(ctx, computeWave(ch), ch);
  }
}

// ── Export as PNG ─────────────────────────────────────────
function getExportBlob() {
  const offscreen = document.createElement('canvas');
  offscreen.width = size;
  offscreen.height = size;
  const offCtx = offscreen.getContext('2d');

  const active = CONFIG.channels.filter(ch => ch.enabled);

  if (CONFIG.crt.enabled) {
    offCtx.fillStyle = '#000';
    offCtx.fillRect(0, 0, size, size);
    if (CONFIG.crt.graticule) drawGraticule(offCtx);
    for (const ch of active) drawCRTWave(offCtx, quantizePoints(computeWave(ch)), ch);
    if (CONFIG.crt.scanlines) drawScanlines(offCtx);
    if (CONFIG.crt.bezel) drawBezel(offCtx);
  } else {
    for (const ch of active) drawWave(offCtx, computeWave(ch), ch);
  }

  return new Promise(resolve => offscreen.toBlob(resolve, 'image/png'));
}

document.getElementById('btn-copy').addEventListener('click', async () => {
  const blob = await getExportBlob();
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  document.getElementById('btn-copy').textContent = 'Copied!';
  setTimeout(() => { document.getElementById('btn-copy').textContent = 'Copy transparent PNG'; }, 1500);
});

document.getElementById('btn-download').addEventListener('click', async () => {
  const blob = await getExportBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wave-${Date.now()}.png`;
  a.click();
  URL.revokeObjectURL(url);
});

// ── Canvas drag to reposition channels ───────────────────
let dragState = null;

canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const mouseY = (e.clientY - rect.top) * (size / rect.height);

  let bestIdx = -1, bestDist = Infinity;
  CONFIG.channels.forEach((ch, i) => {
    if (!ch.enabled) return;
    const d = Math.abs(mouseY - (size / 2 + ch.offsetY * (size / 2)));
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  });

  if (bestIdx >= 0 && bestDist < 80) {
    dragState = { idx: bestIdx, startClientY: e.clientY, startOffsetY: CONFIG.channels[bestIdx].offsetY };
    canvas.style.cursor = 'ns-resize';
  }
});

canvas.addEventListener('mousemove', e => {
  if (!dragState) return;
  const rect = canvas.getBoundingClientRect();
  const dy = (e.clientY - dragState.startClientY) / rect.height * 2;
  const newOffset = Math.max(-1, Math.min(1, dragState.startOffsetY + dy));
  CONFIG.channels[dragState.idx].offsetY = newOffset;

  if (activeChannel === dragState.idx) {
    document.getElementById('ctrl-ch-offsetY').value = newOffset;
    document.getElementById('val-ch-offsetY').textContent = newOffset.toFixed(2);
  }
  render();
});

canvas.addEventListener('mouseup',    () => { dragState = null; canvas.style.cursor = ''; });
canvas.addEventListener('mouseleave', () => { dragState = null; canvas.style.cursor = ''; });

// ── Controls ──────────────────────────────────────────────
let activeChannel = 0;
function getC() { return CONFIG.channels[activeChannel]; }

function setNestedProp(obj, path, val) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
  cur[parts[parts.length - 1]] = val;
}

function initControls() {
  const f1 = v => v.toFixed(1);
  const f2 = v => v.toFixed(2);
  const fi = v => Math.round(v).toString();

  // ── Channel rows ──────────────────────────────────────
  CONFIG.channels.forEach((ch, i) => {
    document.getElementById(`ctrl-ch${i}-enabled`).checked = ch.enabled;
    document.getElementById(`ctrl-ch${i}-enabled`).addEventListener('change', function () {
      CONFIG.channels[i].enabled = this.checked;
      render();
    });
    document.getElementById(`ch-row-${i}`).addEventListener('click', () => selectChannel(i));
  });

  // ── Editor controls (always write to getC()) ──────────
  function bindEditorSlider(id, valId, path, fmt, asInt = false) {
    document.getElementById(id).addEventListener('input', function () {
      const v = asInt ? Math.round(parseFloat(this.value)) : parseFloat(this.value);
      setNestedProp(getC(), path, v);
      document.getElementById(valId).textContent = fmt(v);
      render();
    });
  }

  function bindEditorSelect(id, path) {
    document.getElementById(id).addEventListener('change', function () {
      setNestedProp(getC(), path, this.value);
      render();
    });
  }

  function bindEditorToggle(id, path, subId) {
    const sub = subId ? document.getElementById(subId) : null;
    document.getElementById(id).addEventListener('change', function () {
      setNestedProp(getC(), path, this.checked);
      if (sub) sub.classList.toggle('collapsed', !this.checked);
      render();
    });
  }

  // offsetY + main
  bindEditorSlider('ctrl-ch-offsetY',     'val-ch-offsetY',     'offsetY',          f2);
  bindEditorSelect('ctrl-ch-waveType',                           'waveType');
  bindEditorSlider('ctrl-ch-frequency',   'val-ch-frequency',   'frequency',        f1);
  bindEditorSlider('ctrl-ch-amplitude',   'val-ch-amplitude',   'amplitude',        f2);
  document.getElementById('ctrl-ch-strokeWidth').addEventListener('change', function () {
    const v = parseFloat(this.value);
    if (!isNaN(v) && v > 0) { getC().strokeWidth = v; render(); }
  });

  // FM
  bindEditorToggle('ctrl-ch-fm-enabled',         'fm.enabled',          'ch-fm-controls');
  bindEditorSlider('ctrl-ch-fm-ratio',   'val-ch-fm-ratio',   'fm.ratio',          f1);
  bindEditorSlider('ctrl-ch-fm-depth',   'val-ch-fm-depth',   'fm.depth',          f2);

  // Fold
  bindEditorToggle('ctrl-ch-fold-enabled',       'fold.enabled',        'ch-fold-controls');
  bindEditorSlider('ctrl-ch-fold-threshold', 'val-ch-fold-threshold', 'fold.threshold', f2);
  bindEditorSlider('ctrl-ch-fold-iterations','val-ch-fold-iterations','fold.iterations', fi, true);

  // AM
  bindEditorToggle('ctrl-ch-am-enabled',         'am.enabled',          'ch-am-controls');
  bindEditorSlider('ctrl-ch-am-rate',    'val-ch-am-rate',    'am.rate',           f2);
  bindEditorSlider('ctrl-ch-am-depth',   'val-ch-am-depth',   'am.depth',          f2);
  bindEditorSelect('ctrl-ch-am-shape',                          'am.shape');

  // Waveshaper
  bindEditorToggle('ctrl-ch-ws-enabled',         'ws.enabled',          'ch-ws-controls');
  bindEditorSelect('ctrl-ch-ws-curve',                           'ws.curve');
  bindEditorSlider('ctrl-ch-ws-drive',   'val-ch-ws-drive',   'ws.drive',          f1);

  // ADSR
  bindEditorToggle('ctrl-ch-adsr-enabled',       'adsr.enabled',        'ch-adsr-controls');
  bindEditorSlider('ctrl-ch-adsr-attack',  'val-ch-adsr-attack',  'adsr.attack',   f2);
  bindEditorSlider('ctrl-ch-adsr-decay',   'val-ch-adsr-decay',   'adsr.decay',    f2);
  bindEditorSlider('ctrl-ch-adsr-sustain', 'val-ch-adsr-sustain', 'adsr.sustain',  f2);
  bindEditorSlider('ctrl-ch-adsr-release', 'val-ch-adsr-release', 'adsr.release',  f2);

  // ── CRT controls (global, bind normally with explicit get/set) ──
  function bindCRTToggle(id, get, set, subId) {
    const el = document.getElementById(id);
    const sub = subId ? document.getElementById(subId) : null;
    const sync = () => { if (sub) sub.classList.toggle('collapsed', !el.checked); };
    el.checked = get(); sync();
    el.addEventListener('change', () => { set(el.checked); sync(); render(); });
  }
  function bindCRTSlider(id, valId, get, set, fmt) {
    const el = document.getElementById(id);
    const valEl = document.getElementById(valId);
    el.value = get(); valEl.textContent = fmt(get());
    el.addEventListener('input', () => { const v = parseFloat(el.value); set(v); valEl.textContent = fmt(v); render(); });
  }
  function bindCRTSelect(id, get, set) {
    const el = document.getElementById(id);
    el.value = get();
    el.addEventListener('change', () => { set(el.value); render(); });
  }

  bindCRTToggle('ctrl-crt-enabled',    () => CONFIG.crt.enabled,    v => { CONFIG.crt.enabled = v; },    'crt-controls');
  bindCRTSelect('ctrl-crt-color',      () => CONFIG.crt.color,      v => { CONFIG.crt.color = v; });
  bindCRTSlider('ctrl-crt-resolution', 'val-crt-resolution', () => CONFIG.crt.resolution, v => { CONFIG.crt.resolution = v; }, fi);
  bindCRTSlider('ctrl-crt-glow',       'val-crt-glow',       () => CONFIG.crt.glow,       v => { CONFIG.crt.glow = v; },       f2);
  bindCRTToggle('ctrl-crt-scanlines',  () => CONFIG.crt.scanlines,  v => { CONFIG.crt.scanlines = v; });
  bindCRTToggle('ctrl-crt-graticule',  () => CONFIG.crt.graticule,  v => { CONFIG.crt.graticule = v; });
  bindCRTToggle('ctrl-crt-bezel',      () => CONFIG.crt.bezel,      v => { CONFIG.crt.bezel = v; });

  selectChannel(0);
}

// ── Channel selection + editor repopulation ───────────────
function selectChannel(i) {
  activeChannel = i;
  document.querySelectorAll('.channel-row').forEach((row, idx) => {
    row.classList.toggle('active', idx === i);
  });
  updateEditorUI();
}

function updateEditorUI() {
  const ch = getC();
  const f1 = v => v.toFixed(1);
  const f2 = v => v.toFixed(2);
  const fi = v => Math.round(v).toString();

  document.getElementById('ch-editor-title').textContent = `CH ${activeChannel + 1}`;
  document.getElementById('ch-editor-dot').style.background = ch.color;

  function sl(id, valId, val, fmt) {
    document.getElementById(id).value = val;
    document.getElementById(valId).textContent = fmt(val);
  }
  function se(id, val) { document.getElementById(id).value = val; }
  function tog(id, subId, val) {
    document.getElementById(id).checked = val;
    if (subId) document.getElementById(subId).classList.toggle('collapsed', !val);
  }

  sl('ctrl-ch-offsetY',     'val-ch-offsetY',     ch.offsetY,           f2);
  se('ctrl-ch-waveType',                           ch.waveType);
  sl('ctrl-ch-frequency',   'val-ch-frequency',   ch.frequency,          f1);
  sl('ctrl-ch-amplitude',   'val-ch-amplitude',   ch.amplitude,          f2);
  document.getElementById('ctrl-ch-strokeWidth').value = ch.strokeWidth;

  tog('ctrl-ch-fm-enabled',   'ch-fm-controls',   ch.fm.enabled);
  sl('ctrl-ch-fm-ratio',     'val-ch-fm-ratio',   ch.fm.ratio,           f1);
  sl('ctrl-ch-fm-depth',     'val-ch-fm-depth',   ch.fm.depth,           f2);

  tog('ctrl-ch-fold-enabled', 'ch-fold-controls', ch.fold.enabled);
  sl('ctrl-ch-fold-threshold',   'val-ch-fold-threshold',   ch.fold.threshold,  f2);
  sl('ctrl-ch-fold-iterations',  'val-ch-fold-iterations',  ch.fold.iterations, fi);

  tog('ctrl-ch-am-enabled',   'ch-am-controls',   ch.am.enabled);
  sl('ctrl-ch-am-rate',      'val-ch-am-rate',    ch.am.rate,            f2);
  sl('ctrl-ch-am-depth',     'val-ch-am-depth',   ch.am.depth,           f2);
  se('ctrl-ch-am-shape',                           ch.am.shape);

  tog('ctrl-ch-ws-enabled',   'ch-ws-controls',   ch.ws.enabled);
  se('ctrl-ch-ws-curve',                           ch.ws.curve);
  sl('ctrl-ch-ws-drive',     'val-ch-ws-drive',   ch.ws.drive,           f1);

  tog('ctrl-ch-adsr-enabled', 'ch-adsr-controls', ch.adsr.enabled);
  sl('ctrl-ch-adsr-attack',  'val-ch-adsr-attack',  ch.adsr.attack,      f2);
  sl('ctrl-ch-adsr-decay',   'val-ch-adsr-decay',   ch.adsr.decay,       f2);
  sl('ctrl-ch-adsr-sustain', 'val-ch-adsr-sustain', ch.adsr.sustain,     f2);
  sl('ctrl-ch-adsr-release', 'val-ch-adsr-release', ch.adsr.release,     f2);
}

initControls();
render();
