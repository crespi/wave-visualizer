// ── Channel defaults ──────────────────────────────────────
const CHANNEL_COLORS = [
  { l: 1,    c: 0,    h: 0   },  // white
  { l: 0.82, c: 0.14, h: 217 },  // cyan
  { l: 0.78, c: 0.17, h: 78  },  // amber
  { l: 0.65, c: 0.24, h: 350 },  // pink
];

function defaultChannel(i) {
  return {
    enabled:     i === 0,
    color:       { ...CHANNEL_COLORS[i] },
    offsetY:     0,
    waveType:    ['sine', 'sawtooth', 'triangle', 'square'][i],
    frequency:   3,
    amplitude:   0.7,
    strokeWidth: 5,
    phase:       0,
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
    resolution: 320,
    glow:       0,
    scanlines:  true,
  },

  xy: {
    enabled: false,
    chX:     0,
    chY:     1,
  },

  anim: {
    enabled:  false,
    speed:    0.5,
    duration: 4,
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
let canvasW = 1080, canvasH = 1350;
canvas.width = canvasW;
canvas.height = canvasH;

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

// ── Color helpers ─────────────────────────────────────────
function chColorCss(ch) {
  return `oklch(${ch.color.l} ${ch.color.c} ${ch.color.h})`;
}

// ── CRT helpers ───────────────────────────────────────────

function quantizePoints(points) {
  const vw = CONFIG.crt.resolution;
  const vh = Math.round(vw * canvasH / canvasW);
  const sx = canvasW / vw;
  const sy = canvasH / vh;
  return points.map(({ x, y }) => ({
    x: Math.round(x / sx) * sx,
    y: Math.round(y / sy) * sy,
  }));
}

let glowCanvas = null;

function drawCRTWave(target, points, ch) {
  const gi = CONFIG.crt.glow;
  const vw = CONFIG.crt.resolution;
  const vh = Math.round(vw * canvasH / canvasW);
  const cw = canvasW / vw;
  const rh = canvasH / vh;

  const color = chColorCss(ch);
  const seen = new Set();
  const cells = [];

  function addCell(x, y) {
    const key = `${x},${y}`;
    if (!seen.has(key)) { seen.add(key); cells.push({ x, y }); }
  }

  const thick = Math.max(1, Math.round(ch.strokeWidth));
  const half  = Math.floor(thick / 2);

  let prev = null;
  for (const pt of points) {
    if (prev !== null && Math.abs(pt.y - prev.y) > rh * 1.5) {
      const iy1 = Math.round(prev.y / rh);
      const iy2 = Math.round(pt.y / rh);
      const step = iy2 > iy1 ? 1 : -1;
      for (let i = iy1 + step; step > 0 ? i < iy2 : i > iy2; i += step) {
        addCell(pt.x, i * rh);
      }
    }
    const iy = Math.round(pt.y / rh);
    for (let d = -half; d <= half; d++) addCell(pt.x, (iy + d) * rh);
    prev = pt;
  }

  if (gi > 0) {
    if (!glowCanvas) { glowCanvas = document.createElement('canvas'); glowCanvas.width = canvasW; glowCanvas.height = canvasH; }
    const gc = glowCanvas.getContext('2d');
    gc.clearRect(0, 0, canvasW, canvasH);
    gc.fillStyle = color;
    for (const { x, y } of cells) gc.fillRect(x, y, cw, rh);

    target.filter = `blur(${Math.round(cw * 2 * gi)}px)`;
    target.globalAlpha = 0.45 * gi;
    target.drawImage(glowCanvas, 0, 0);

    target.filter = `blur(${Math.round(cw * 0.6 * gi)}px)`;
    target.globalAlpha = 0.75 * gi;
    target.drawImage(glowCanvas, 0, 0);

    target.filter = 'none';
    target.globalAlpha = 1;
  }

  target.fillStyle = color;
  for (const { x, y } of cells) target.fillRect(x, y, cw, rh);
}

function drawLCDGrid(target) {
  const vw = CONFIG.crt.resolution;
  const vh = Math.round(vw * canvasH / canvasW);
  const cw = canvasW / vw;
  const rh = canvasH / vh;
  target.strokeStyle = 'rgba(0,0,0,0.5)';
  target.lineWidth = 1;
  target.beginPath();
  for (let col = 0; col <= vw; col++) {
    const x = col * cw;
    target.moveTo(x, 0);
    target.lineTo(x, canvasH);
  }
  for (let row = 0; row <= vh; row++) {
    const y = row * rh;
    target.moveTo(0, y);
    target.lineTo(canvasW, y);
  }
  target.stroke();
}

// ── Compute raw sample [-1, 1] for a given position ──────
function computeSample(ch, px, totalPx) {
  const waveFn = waveFunctions[ch.waveType];
  const baseX = (px / totalPx) * 2 * Math.PI * ch.frequency;

  let x = baseX;
  if (ch.fm.enabled) {
    x = baseX + ch.fm.depth * Math.sin((px / totalPx) * 2 * Math.PI * ch.frequency * ch.fm.ratio);
  }

  let sample = waveFn(x + ch.phase);

  if (ch.fold.enabled) {
    sample = waveFold(sample * (1 / ch.fold.threshold), 1, ch.fold.iterations);
  }

  if (ch.ws.enabled) {
    const curve = waveshapeCurves[ch.ws.curve] || waveshapeCurves.tanh;
    sample = curve(sample * ch.ws.drive) / Math.tanh(ch.ws.drive);
  }

  if (ch.am.enabled) {
    const amFn = waveFunctions[ch.am.shape] || waveFunctions.sine;
    const lfo = (amFn((px / totalPx) * 2 * Math.PI * ch.am.rate) + 1) / 2;
    sample *= 1 - ch.am.depth * (1 - lfo);
  }

  if (ch.adsr.enabled) {
    sample *= adsrEnvelope(px / totalPx, ch.adsr.attack, ch.adsr.decay, ch.adsr.sustain, ch.adsr.release);
  }

  return sample;
}

// ── Compute wave points (scope / time-domain) ─────────────
function computeWave(ch) {
  const centerY = canvasH / 2 + ch.offsetY * (canvasH / 2);
  const ampPx = (canvasH / 2) * ch.amplitude;
  const points = [];
  for (let px = 0; px <= canvasW; px++) {
    points.push({ x: px, y: centerY - computeSample(ch, px, canvasW) * ampPx });
  }
  return points;
}

// ── Compute Lissajous points (XY mode) ───────────────────
function computeLissajousPoints(chX, chY) {
  const N = canvasW * 2;
  const cx = canvasW / 2, cy = canvasH / 2;
  const points = [];
  for (let i = 0; i <= N; i++) {
    points.push({
      x: cx + computeSample(chX, i, N) * chX.amplitude * (canvasW / 2),
      y: cy - computeSample(chY, i, N) * chY.amplitude * (canvasH / 2),
    });
  }
  return points;
}

// ── Draw Lissajous (CRT mode) ─────────────────────────────
function drawCRTLissajous(target, points, ch) {
  const gi = CONFIG.crt.glow;
  const vw = CONFIG.crt.resolution;
  const vh = Math.round(vw * canvasH / canvasW);
  const cw = canvasW / vw;
  const rh = canvasH / vh;
  const color = chColorCss(ch);

  const seen = new Set();
  const cells = [];
  const thick = Math.max(1, Math.round(ch.strokeWidth));
  const half  = Math.floor(thick / 2);

  function addCell(ix, iy) {
    for (let dx = -half; dx <= half; dx++) {
      for (let dy = -half; dy <= half; dy++) {
        const key = `${ix + dx},${iy + dy}`;
        if (!seen.has(key)) { seen.add(key); cells.push({ x: (ix + dx) * cw, y: (iy + dy) * rh }); }
      }
    }
  }

  let prev = null;
  for (const pt of points) {
    const ix = Math.round(pt.x / cw);
    const iy = Math.round(pt.y / rh);
    if (prev !== null) {
      const dix = ix - prev.ix, diy = iy - prev.iy;
      const steps = Math.max(Math.abs(dix), Math.abs(diy));
      for (let s = 1; s < steps; s++) {
        addCell(Math.round(prev.ix + dix * s / steps), Math.round(prev.iy + diy * s / steps));
      }
    }
    addCell(ix, iy);
    prev = { ix, iy };
  }

  if (gi > 0) {
    if (!glowCanvas) { glowCanvas = document.createElement('canvas'); glowCanvas.width = canvasW; glowCanvas.height = canvasH; }
    const gc = glowCanvas.getContext('2d');
    gc.clearRect(0, 0, canvasW, canvasH);
    gc.fillStyle = color;
    for (const { x, y } of cells) gc.fillRect(x, y, cw, rh);

    target.filter = `blur(${Math.round(cw * 2 * gi)}px)`;
    target.globalAlpha = 0.45 * gi;
    target.drawImage(glowCanvas, 0, 0);

    target.filter = `blur(${Math.round(cw * 0.6 * gi)}px)`;
    target.globalAlpha = 0.75 * gi;
    target.drawImage(glowCanvas, 0, 0);

    target.filter = 'none';
    target.globalAlpha = 1;
  }

  target.fillStyle = color;
  for (const { x, y } of cells) target.fillRect(x, y, cw, rh);
}

// ── Draw wave (vector mode) ───────────────────────────────
function drawWave(target, points, ch) {
  target.strokeStyle = chColorCss(ch);
  target.lineWidth = ch.strokeWidth;
  target.lineCap = 'round';
  target.lineJoin = 'round';
  target.beginPath();
  target.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) target.lineTo(points[i].x, points[i].y);
  target.stroke();
}

// ── Animation loop ────────────────────────────────────────
let animRafId  = null;
let animLastTs = null;

function animTick(ts) {
  if (animLastTs !== null) {
    const dt     = Math.min((ts - animLastTs) / 1000, 0.1);
    const dPhase = CONFIG.anim.speed * 2 * Math.PI * dt;
    CONFIG.channels.forEach(ch => { ch.phase = (ch.phase + dPhase) % (2 * Math.PI); });
    const phSlider = document.getElementById('ctrl-ch-phase');
    const phVal    = document.getElementById('val-ch-phase');
    if (phSlider) phSlider.value = getC().phase;
    if (phVal)    phVal.textContent = getC().phase.toFixed(2);
    render();
  }
  animLastTs = ts;
  animRafId  = requestAnimationFrame(animTick);
}

function startAnim() {
  if (animRafId) return;
  animLastTs = null;
  animRafId  = requestAnimationFrame(animTick);
}

function stopAnim() {
  if (animRafId) cancelAnimationFrame(animRafId);
  animRafId  = null;
  animLastTs = null;
}

// ── WebM recording ────────────────────────────────────────
let mediaRecorder  = null;
let recordedChunks = [];

function startRecording() {
  if (mediaRecorder) return;
  const mimeType = ['video/webm;codecs=vp9', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
  const stream   = canvas.captureStream(60);
  recordedChunks = [];
  mediaRecorder  = new MediaRecorder(stream, mimeType ? { mimeType } : {});
  const btn      = document.getElementById('btn-record');

  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `wave-${Date.now()}.webm`; a.click();
    URL.revokeObjectURL(url);
    mediaRecorder = null;
    btn.textContent = 'Record WebM';
  };

  mediaRecorder.start();
  btn.textContent = 'Recording…';
  setTimeout(() => { if (mediaRecorder) mediaRecorder.stop(); }, CONFIG.anim.duration * 1000);
}

// ── Render ────────────────────────────────────────────────
let renderPending = false;
function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => { renderPending = false; render(); });
}

function render() {
  ctx.fillStyle = '#1c1c1c';
  ctx.fillRect(0, 0, canvasW, canvasH);

  if (CONFIG.xy.enabled) {
    const chX = CONFIG.channels[CONFIG.xy.chX];
    const chY = CONFIG.channels[CONFIG.xy.chY];
    const pts = computeLissajousPoints(chX, chY);
    if (CONFIG.crt.enabled) {
      drawCRTLissajous(ctx, pts, chX);
      if (CONFIG.crt.scanlines) drawLCDGrid(ctx);
    } else {
      drawWave(ctx, pts, chX);
    }
  } else {
    const active = CONFIG.channels.filter(ch => ch.enabled);
    if (CONFIG.crt.enabled) {
      for (const ch of active) drawCRTWave(ctx, quantizePoints(computeWave(ch)), ch);
      if (CONFIG.crt.scanlines) drawLCDGrid(ctx);
    } else {
      for (const ch of active) drawWave(ctx, computeWave(ch), ch);
    }
  }
}

// ── Export as PNG ─────────────────────────────────────────
function getExportBlob() {
  const offscreen = document.createElement('canvas');
  offscreen.width = canvasW;
  offscreen.height = canvasH;
  const offCtx = offscreen.getContext('2d');

  const active = CONFIG.channels.filter(ch => ch.enabled);

  if (CONFIG.xy.enabled) {
    const chX = CONFIG.channels[CONFIG.xy.chX];
    const chY = CONFIG.channels[CONFIG.xy.chY];
    const pts = computeLissajousPoints(chX, chY);
    if (CONFIG.crt.enabled) {
      offCtx.fillStyle = '#1c1c1c';
      offCtx.fillRect(0, 0, canvasW, canvasH);
      drawCRTLissajous(offCtx, pts, chX);
      if (CONFIG.crt.scanlines) drawLCDGrid(offCtx);
    } else {
      drawWave(offCtx, pts, chX);
    }
  } else if (CONFIG.crt.enabled) {
    offCtx.fillStyle = '#1c1c1c';
    offCtx.fillRect(0, 0, canvasW, canvasH);
    for (const ch of active) drawCRTWave(offCtx, quantizePoints(computeWave(ch)), ch);
    if (CONFIG.crt.scanlines) drawLCDGrid(offCtx);
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
  const mouseY = (e.clientY - rect.top) * (canvasH / rect.height);

  let bestIdx = -1, bestDist = Infinity;
  CONFIG.channels.forEach((ch, i) => {
    if (!ch.enabled) return;
    const d = Math.abs(mouseY - (canvasH / 2 + ch.offsetY * (canvasH / 2)));
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
    document.getElementById('val-ch-offsetY').value = newOffset.toFixed(2);
  }
  scheduleRender();
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

function getNestedProp(obj, path) {
  return path.split('.').reduce((cur, p) => cur[p], obj);
}

function initControls() {
  const f1 = v => v.toFixed(1);
  const f2 = v => v.toFixed(2);
  const fi = v => Math.round(v).toString();

  // ── Channel rows ──────────────────────────────────────
  CONFIG.channels.forEach((ch, i) => {
    document.querySelector(`#ch-row-${i} .ch-dot`).style.background = chColorCss(ch);
    document.getElementById(`ctrl-ch${i}-enabled`).checked = ch.enabled;
    document.getElementById(`ctrl-ch${i}-enabled`).addEventListener('change', function () {
      CONFIG.channels[i].enabled = this.checked;
      if (activeChannel === i) updateEditorUI();
      scheduleRender();
    });
    document.getElementById(`ch-row-${i}`).addEventListener('click', () => selectChannel(i));
  });

  // ── Editor controls (always write to getC()) ──────────
  function bindEditorSlider(id, valId, path, fmt, asInt = false) {
    const slider = document.getElementById(id);
    const valEl  = document.getElementById(valId);
    const isInput = valEl.tagName === 'INPUT';

    slider.addEventListener('input', function () {
      const v = asInt ? Math.round(parseFloat(this.value)) : parseFloat(this.value);
      setNestedProp(getC(), path, v);
      if (isInput) valEl.value = v; else valEl.textContent = fmt(v);
      scheduleRender();
    });

    if (isInput) {
      valEl.addEventListener('change', function () {
        const raw = parseFloat(this.value);
        if (isNaN(raw)) { this.value = slider.value; return; }
        const v = asInt ? Math.round(raw) : raw;
        this.value = v;
        setNestedProp(getC(), path, v);
        slider.value = v;
        scheduleRender();
      });
    }
  }

  function bindEditorSelect(id, path) {
    document.getElementById(id).addEventListener('change', function () {
      setNestedProp(getC(), path, this.value);
      scheduleRender();
    });
  }

  function bindEditorToggle(id, path, subId) {
    const sub = subId ? document.getElementById(subId) : null;
    document.getElementById(id).addEventListener('change', function () {
      setNestedProp(getC(), path, this.checked);
      if (sub) sub.classList.toggle('collapsed', !this.checked);
      scheduleRender();
    });
  }

  // offsetY + main
  bindEditorSlider('ctrl-ch-offsetY',     'val-ch-offsetY',     'offsetY',          f2);
  bindEditorSelect('ctrl-ch-waveType',                           'waveType');
  bindEditorSlider('ctrl-ch-frequency',   'val-ch-frequency',   'frequency',        f1);
  bindEditorSlider('ctrl-ch-amplitude',   'val-ch-amplitude',   'amplitude',        f2);
  bindEditorSlider('ctrl-ch-phase',       'val-ch-phase',       'phase',            f2);
  const swNum   = document.getElementById('ctrl-ch-strokeWidth');
  const swRange = document.getElementById('ctrl-ch-strokeWidth-range');
  swRange.addEventListener('input', function () {
    const v = parseFloat(this.value);
    getC().strokeWidth = v; swNum.value = v; scheduleRender();
  });
  swNum.addEventListener('change', function () {
    const v = parseFloat(this.value);
    if (!isNaN(v) && v > 0) { getC().strokeWidth = v; swRange.value = v; scheduleRender(); }
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
    el.addEventListener('change', () => { set(el.checked); sync(); scheduleRender(); });
  }
  function bindCRTSlider(id, valId, get, set, fmt) {
    const el = document.getElementById(id);
    const valEl = document.getElementById(valId);
    const v0 = get(); el.value = v0; valEl.textContent = fmt(v0);
    el.addEventListener('input', () => { const v = parseFloat(el.value); set(v); valEl.textContent = fmt(v); scheduleRender(); });
  }
  bindCRTToggle('ctrl-crt-enabled',    () => CONFIG.crt.enabled,    v => { CONFIG.crt.enabled = v; },    'crt-controls');
  bindCRTSlider('ctrl-crt-resolution', 'val-crt-resolution', () => CONFIG.crt.resolution, v => { CONFIG.crt.resolution = v; }, fi);
bindCRTToggle('ctrl-crt-scanlines',  () => CONFIG.crt.scanlines,  v => { CONFIG.crt.scanlines = v; });

  // Color sliders
  function bindColorSlider(id, valId, key, fmt) {
    const slider = document.getElementById(id);
    const valEl  = document.getElementById(valId);
    const isInput = valEl.tagName === 'INPUT';

    function applyColor(v) {
      getC().color[key] = v;
      const css = chColorCss(getC());
      document.getElementById('ch-editor-dot').style.background = css;
      document.querySelector(`#ch-row-${activeChannel} .ch-dot`).style.background = css;
      scheduleRender();
    }

    slider.addEventListener('input', function () {
      const v = parseFloat(this.value);
      if (isInput) valEl.value = v; else valEl.textContent = fmt(v);
      applyColor(v);
    });

    if (isInput) {
      valEl.addEventListener('change', function () {
        const v = parseFloat(this.value);
        if (isNaN(v)) { this.value = slider.value; return; }
        this.value = v;
        slider.value = v;
        applyColor(v);
      });
    }
  }
  bindColorSlider('ctrl-ch-color-l', 'val-ch-color-l', 'l', f2);
  bindColorSlider('ctrl-ch-color-c', 'val-ch-color-c', 'c', v => v.toFixed(3));
  bindColorSlider('ctrl-ch-color-h', 'val-ch-color-h', 'h', fi);

  document.getElementById('btn-ch-enable').addEventListener('click', () => {
    CONFIG.channels[activeChannel].enabled = true;
    document.getElementById(`ctrl-ch${activeChannel}-enabled`).checked = true;
    updateEditorUI();
    scheduleRender();
  });

  // Canvas size
  function bindCanvasSize(id, getVal, setVal) {
    const el = document.getElementById(id);
    el.value = getVal();
    el.addEventListener('change', function () {
      const v = Math.max(100, Math.min(4000, Math.round(parseFloat(this.value))));
      this.value = v;
      setVal(v);
      canvas.width = canvasW;
      canvas.height = canvasH;
      glowCanvas = null;
      scheduleRender();
    });
  }
  bindCanvasSize('ctrl-canvas-width',  () => canvasW, v => { canvasW = v; });
  bindCanvasSize('ctrl-canvas-height', () => canvasH, v => { canvasH = v; });

  // Animate
  const animToggle = document.getElementById('ctrl-anim-enabled');
  const animSub    = document.getElementById('anim-controls');
  animToggle.checked = CONFIG.anim.enabled;
  animSub.classList.toggle('collapsed', !CONFIG.anim.enabled);
  animToggle.addEventListener('change', () => {
    CONFIG.anim.enabled = animToggle.checked;
    animSub.classList.toggle('collapsed', !animToggle.checked);
    if (CONFIG.anim.enabled) startAnim(); else stopAnim();
  });
  bindCRTSlider('ctrl-anim-speed',    'val-anim-speed',    () => CONFIG.anim.speed,    v => { CONFIG.anim.speed    = v; }, f2);
  bindCRTSlider('ctrl-anim-duration', 'val-anim-duration', () => CONFIG.anim.duration, v => { CONFIG.anim.duration = v; }, v => Math.round(v) + 's');
  document.getElementById('btn-record').addEventListener('click', startRecording);

  // XY Mode
  const xyToggle = document.getElementById('ctrl-xy-enabled');
  const xySub    = document.getElementById('xy-controls');
  xyToggle.checked = CONFIG.xy.enabled;
  xySub.classList.toggle('collapsed', !CONFIG.xy.enabled);
  xyToggle.addEventListener('change', () => {
    CONFIG.xy.enabled = xyToggle.checked;
    xySub.classList.toggle('collapsed', !xyToggle.checked);
    scheduleRender();
  });
  ['chX', 'chY'].forEach(key => {
    const el = document.getElementById(`ctrl-xy-${key}`);
    el.value = CONFIG.xy[key];
    el.addEventListener('change', () => { CONFIG.xy[key] = parseInt(el.value); scheduleRender(); });
  });

  initCopyMenu();
  selectChannel(0);
}

// ── Copy-to-all-channels menu ─────────────────────────────
function initCopyMenu() {
  // Shared dropdown with two items
  const menu = document.createElement('div');
  menu.id = 'copy-menu';
  menu.className = 'copy-menu';
  menu.innerHTML = `
    <div class="copy-menu-item" id="copy-attr-to-all">Copy to all channels</div>
    <div class="copy-menu-item" id="copy-all-attrs">Copy all attributes to other channels</div>
  `;
  document.body.appendChild(menu);

  const itemAttr = document.getElementById('copy-attr-to-all');
  const itemAll  = document.getElementById('copy-all-attrs');

  let pendingPath       = null;
  let pendingChannelIdx = null;

  function openMenu(rect, showAttr, showAll) {
    itemAttr.style.display = showAttr ? '' : 'none';
    itemAll.style.display  = showAll  ? '' : 'none';
    menu.style.left = rect.left + 'px';
    menu.style.top  = (rect.bottom + 4) + 'px';
    menu.classList.add('visible');
  }

  // Inject ⋯ into each copyable attribute control-row
  document.querySelectorAll('#ch-editor .control-row[data-copy-path]').forEach(row => {
    const span = row.querySelector('.control-label span');
    if (!span) return;
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = '⋯';
    span.after(btn);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      pendingPath = row.dataset.copyPath;
      pendingChannelIdx = null;
      openMenu(btn.getBoundingClientRect(), true, false);
    });
  });

  // Inject ⋯ into each channel row (before the enable checkbox)
  CONFIG.channels.forEach((_, i) => {
    const row = document.getElementById(`ch-row-${i}`);
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = '⋯';
    row.insertBefore(btn, row.querySelector('input[type="checkbox"]'));
    btn.addEventListener('click', e => {
      e.stopPropagation();
      pendingPath = null;
      pendingChannelIdx = i;
      openMenu(btn.getBoundingClientRect(), false, true);
    });
  });

  // Close on outside click
  document.addEventListener('click', () => menu.classList.remove('visible'));

  // Copy single attribute to all channels
  itemAttr.addEventListener('click', () => {
    if (pendingPath === null) return;
    const val = getNestedProp(getC(), pendingPath);
    CONFIG.channels.forEach((ch, i) => {
      if (i !== activeChannel) setNestedProp(ch, pendingPath, val);
    });
    if (pendingPath.startsWith('color')) {
      CONFIG.channels.forEach((ch, i) => {
        document.querySelector(`#ch-row-${i} .ch-dot`).style.background = chColorCss(ch);
      });
    }
    menu.classList.remove('visible');
    scheduleRender();
  });

  // Copy all attributes from one channel to all others
  itemAll.addEventListener('click', () => {
    if (pendingChannelIdx === null) return;
    const src = CONFIG.channels[pendingChannelIdx];
    CONFIG.channels.forEach((ch, i) => {
      if (i === pendingChannelIdx) return;
      ch.color      = { ...src.color };
      ch.offsetY    = src.offsetY;
      ch.waveType   = src.waveType;
      ch.frequency  = src.frequency;
      ch.amplitude  = src.amplitude;
      ch.strokeWidth = src.strokeWidth;
      ch.fm   = { ...src.fm };
      ch.fold = { ...src.fold };
      ch.am   = { ...src.am };
      ch.ws   = { ...src.ws };
      ch.adsr = { ...src.adsr };
    });
    CONFIG.channels.forEach((ch, i) => {
      document.querySelector(`#ch-row-${i} .ch-dot`).style.background = chColorCss(ch);
    });
    // Refresh editor if it's showing a channel that was just overwritten
    if (activeChannel !== pendingChannelIdx) updateEditorUI();
    menu.classList.remove('visible');
    scheduleRender();
  });
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

  const css = chColorCss(ch);
  document.getElementById('ch-editor-title').textContent = `CH ${activeChannel + 1}`;
  document.getElementById('ch-editor-dot').style.background = css;
  document.querySelector(`#ch-row-${activeChannel} .ch-dot`).style.background = css;
  document.getElementById('ch-editor').classList.toggle('ch-editor--disabled', !ch.enabled);

  function sl(id, valId, val, fmt) {
    document.getElementById(id).value = val;
    const valEl = document.getElementById(valId);
    if (valEl.tagName === 'INPUT') valEl.value = val;
    else valEl.textContent = fmt(val);
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
  sl('ctrl-ch-phase',       'val-ch-phase',       ch.phase,              f2);
  document.getElementById('ctrl-ch-strokeWidth').value = ch.strokeWidth;
  document.getElementById('ctrl-ch-strokeWidth-range').value = ch.strokeWidth;

  sl('ctrl-ch-color-l', 'val-ch-color-l', ch.color.l, f2);
  sl('ctrl-ch-color-c', 'val-ch-color-c', ch.color.c, v => v.toFixed(3));
  sl('ctrl-ch-color-h', 'val-ch-color-h', ch.color.h, fi);

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


