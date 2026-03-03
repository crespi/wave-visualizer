// ── Config ──────────────────────────────────────────────────
const CONFIG = {
  waveType: 'sine',    // 'sine' | 'square' | 'triangle' | 'sawtooth'
  frequency: 3,        // number of visible cycles
  amplitude: 0.7,      // 0–1, proportion of half the canvas height
  canvasSize: 1080,
  strokeWidth: 1,      // multiplier applied to all glow passes (0.1–4)

  // FM synthesis — a modulator oscillator warps the carrier frequency
  fm: {
    enabled: false,
    ratio: 1.6,           // modulator freq = carrier freq * ratio (try 1–7)
    depth: 0.4,           // how much the modulator bends the frequency (0–1+)
  },

  // Wave folding — amplitude folds back instead of clipping
  fold: {
    enabled: true,
    threshold: 0.3,     // fold point as fraction of amplitude (0.3–1.0)
    iterations: 6,      // how many times to refold (1–8, higher = more complex)
  },

  // Amplitude modulation — an LFO rides the amplitude across the canvas
  am: {
    enabled: true,
    rate: 2,            // LFO cycles across the canvas width (0.25 = slow swell, 2+ = fast tremolo)
    depth: 1,           // 0–1, how much the amplitude dips (1 = silence at troughs)
    shape: 'sine',      // LFO shape: 'sine' | 'triangle' | 'sawtooth' (reuses waveFunctions)
  },

  // Waveshaper — nonlinear transfer function applied after fold, before AM
  ws: {
    enabled: false,
    curve: 'tanh',      // 'tanh' | 'hardclip' | 'tube'
    drive: 3,           // input gain into the curve (1–10)
  },

  // ADSR envelope — one-shot amplitude shape applied left-to-right
  adsr: {
    enabled: false,
    attack:  0.1,       // fraction of canvas width for attack ramp
    decay:   0.1,       // fraction for decay drop to sustain level
    sustain: 0.7,       // sustain amplitude level (0–1)
    release: 0.2,       // fraction for release fade to zero
  },
};

// ── Wave functions ─────────────────────────────────────────
const waveFunctions = {
  sine:     (x) => Math.sin(x),
  square:   (x) => Math.sign(Math.sin(x)),
  triangle: (x) => (2 / Math.PI) * Math.asin(Math.sin(x)),
  sawtooth: (x) => ((x % (2 * Math.PI)) / Math.PI) - 1,
};

// ── Setup ──────────────────────────────────────────────────
const canvas = document.getElementById('scope');
const ctx = canvas.getContext('2d');
const size = CONFIG.canvasSize;
canvas.width = size;
canvas.height = size;

// ── Modulation helpers ──────────────────────────────────
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
  // t: 0–1 position across canvas, all segments are fractions of width
  if (t < attack) return attack > 0 ? t / attack : 1;
  t -= attack;
  const decayEnd = decay;
  if (t < decayEnd) return decay > 0 ? 1 - (1 - sustain) * (t / decay) : sustain;
  t -= decayEnd;
  const sustainEnd = Math.max(0, 1 - attack - decay - release);
  if (t < sustainEnd) return sustain;
  t -= sustainEnd;
  if (release > 0) return sustain * Math.max(0, 1 - t / release);
  return 0;
}

// ── Compute wave points + velocity ───────────────────────
function computeWave() {
  const { waveType, frequency, amplitude } = CONFIG;
  const waveFn = waveFunctions[waveType];
  const centerY = size / 2;
  const ampPx = (size / 2) * amplitude;

  const points = [];
  for (let px = 0; px <= size; px++) {
    const baseX = (px / size) * 2 * Math.PI * frequency;

    let x = baseX;
    if (CONFIG.fm.enabled) {
      const modFreq = frequency * CONFIG.fm.ratio;
      const modX = (px / size) * 2 * Math.PI * modFreq;
      x = baseX + CONFIG.fm.depth * Math.sin(modX);
    }

    let sample = waveFn(x);

    if (CONFIG.fold.enabled) {
      const drive = 1 / CONFIG.fold.threshold;
      sample = waveFold(sample * drive, 1, CONFIG.fold.iterations);
    }

    if (CONFIG.ws.enabled) {
      const curve = waveshapeCurves[CONFIG.ws.curve] || waveshapeCurves.tanh;
      sample = curve(sample * CONFIG.ws.drive) / Math.tanh(CONFIG.ws.drive);
    }

    // AM: modulate amplitude with an LFO across the canvas
    if (CONFIG.am.enabled) {
      const lfoX = (px / size) * 2 * Math.PI * CONFIG.am.rate;
      const lfoShape = waveFunctions[CONFIG.am.shape] || waveFunctions.sine;
      const lfo = (lfoShape(lfoX) + 1) / 2; // normalize to 0–1
      sample *= 1 - CONFIG.am.depth * (1 - lfo);
    }

    if (CONFIG.adsr.enabled) {
      const { attack, decay, sustain, release } = CONFIG.adsr;
      sample *= adsrEnvelope(px / size, attack, decay, sustain, release);
    }

    const y = centerY - sample * ampPx;
    points.push({ x: px, y });
  }

  // Velocity normalization
  const velocities = [];
  let maxVel = 0;
  for (let i = 0; i < points.length; i++) {
    const dy = i === 0
      ? points[1].y - points[0].y
      : i === points.length - 1
        ? points[i].y - points[i - 1].y
        : (points[i + 1].y - points[i - 1].y) / 2;
    const vel = Math.abs(dy);
    velocities.push(vel);
    if (vel > maxVel) maxVel = vel;
  }
  const normVel = velocities.map(v => 1 - (maxVel > 0 ? v / maxVel : 0));

  return { points, normVel };
}

// ── Draw the wave as a single stroke ─────────────────────
function drawWave(target, points) {
  target.strokeStyle = '#fff';
  target.lineWidth = CONFIG.strokeWidth;
  target.lineCap = 'round';
  target.lineJoin = 'round';
  target.beginPath();
  target.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    target.lineTo(points[i].x, points[i].y);
  }
  target.stroke();
}

// ── Render ────────────────────────────────────────────────
function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);

  const { points } = computeWave();
  drawWave(ctx, points);
}

// ── Export as transparent PNG ─────────────────────────────
function getTransparentBlob() {
  const offscreen = document.createElement('canvas');
  offscreen.width = size;
  offscreen.height = size;
  const offCtx = offscreen.getContext('2d');

  const { points } = computeWave();
  drawWave(offCtx, points);

  return new Promise(resolve => offscreen.toBlob(resolve, 'image/png'));
}

document.getElementById('btn-copy').addEventListener('click', async () => {
  const blob = await getTransparentBlob();
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  document.getElementById('btn-copy').textContent = 'Copied!';
  setTimeout(() => {
    document.getElementById('btn-copy').textContent = 'Copy transparent PNG';
  }, 1500);
});

document.getElementById('btn-download').addEventListener('click', async () => {
  const blob = await getTransparentBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wave-${CONFIG.waveType}-${Date.now()}.png`;
  a.click();
  URL.revokeObjectURL(url);
});

// ── Controls wiring ───────────────────────────────────────
function initControls() {
  function bindSlider(id, valId, get, set, fmt) {
    const el = document.getElementById(id);
    const valEl = document.getElementById(valId);
    el.value = get();
    valEl.textContent = fmt(get());
    el.addEventListener('input', () => {
      const v = parseFloat(el.value);
      set(v);
      valEl.textContent = fmt(v);
      render();
    });
  }

  function bindSelect(id, get, set) {
    const el = document.getElementById(id);
    el.value = get();
    el.addEventListener('change', () => { set(el.value); render(); });
  }

  function bindToggle(id, get, set, subId) {
    const el = document.getElementById(id);
    const sub = subId ? document.getElementById(subId) : null;
    const sync = () => { if (sub) sub.classList.toggle('collapsed', !el.checked); };
    el.checked = get();
    sync();
    el.addEventListener('change', () => { set(el.checked); sync(); render(); });
  }

  const f1  = v => v.toFixed(1);
  const f2  = v => v.toFixed(2);
  const fi  = v => Math.round(v).toString();

  // Main
  bindSelect('ctrl-waveType',       () => CONFIG.waveType,       v => { CONFIG.waveType = v; });
  bindSlider('ctrl-frequency',      'val-frequency',      () => CONFIG.frequency,      v => { CONFIG.frequency = v; },           f1);
  bindSlider('ctrl-amplitude',      'val-amplitude',      () => CONFIG.amplitude,      v => { CONFIG.amplitude = v; },           f2);
  bindSlider('ctrl-strokeWidth',    'val-strokeWidth',    () => CONFIG.strokeWidth,    v => { CONFIG.strokeWidth = v; },         f2);

  // FM
  bindToggle('ctrl-fm-enabled',     () => CONFIG.fm.enabled,     v => { CONFIG.fm.enabled = v; },     'fm-controls');
  bindSlider('ctrl-fm-ratio',       'val-fm-ratio',       () => CONFIG.fm.ratio,       v => { CONFIG.fm.ratio = v; },            f1);
  bindSlider('ctrl-fm-depth',       'val-fm-depth',       () => CONFIG.fm.depth,       v => { CONFIG.fm.depth = v; },            f2);

  // Fold
  bindToggle('ctrl-fold-enabled',   () => CONFIG.fold.enabled,   v => { CONFIG.fold.enabled = v; },   'fold-controls');
  bindSlider('ctrl-fold-threshold', 'val-fold-threshold', () => CONFIG.fold.threshold, v => { CONFIG.fold.threshold = v; },      f2);
  bindSlider('ctrl-fold-iterations','val-fold-iterations',() => CONFIG.fold.iterations,v => { CONFIG.fold.iterations = Math.round(v); }, fi);

  // AM
  bindToggle('ctrl-am-enabled',     () => CONFIG.am.enabled,     v => { CONFIG.am.enabled = v; },     'am-controls');
  bindSlider('ctrl-am-rate',        'val-am-rate',        () => CONFIG.am.rate,        v => { CONFIG.am.rate = v; },             f2);
  bindSlider('ctrl-am-depth',       'val-am-depth',       () => CONFIG.am.depth,       v => { CONFIG.am.depth = v; },            f2);
  bindSelect('ctrl-am-shape',       () => CONFIG.am.shape,       v => { CONFIG.am.shape = v; });

  // Waveshaper
  bindToggle('ctrl-ws-enabled',     () => CONFIG.ws.enabled,     v => { CONFIG.ws.enabled = v; },     'ws-controls');
  bindSelect('ctrl-ws-curve',       () => CONFIG.ws.curve,       v => { CONFIG.ws.curve = v; });
  bindSlider('ctrl-ws-drive',       'val-ws-drive',       () => CONFIG.ws.drive,       v => { CONFIG.ws.drive = v; },            f1);

  // ADSR
  bindToggle('ctrl-adsr-enabled',   () => CONFIG.adsr.enabled,   v => { CONFIG.adsr.enabled = v; },   'adsr-controls');
  bindSlider('ctrl-adsr-attack',    'val-adsr-attack',    () => CONFIG.adsr.attack,    v => { CONFIG.adsr.attack = v; },         f2);
  bindSlider('ctrl-adsr-decay',     'val-adsr-decay',     () => CONFIG.adsr.decay,     v => { CONFIG.adsr.decay = v; },          f2);
  bindSlider('ctrl-adsr-sustain',   'val-adsr-sustain',   () => CONFIG.adsr.sustain,   v => { CONFIG.adsr.sustain = v; },        f2);
  bindSlider('ctrl-adsr-release',   'val-adsr-release',   () => CONFIG.adsr.release,   v => { CONFIG.adsr.release = v; },        f2);
}

initControls();
render();
