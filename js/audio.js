/* Original WebAudio sound effects for Llama Trauma. No samples, no network. */

let ctx = null;
let muted = false;
let unlocked = false;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = !!value;
  if (muted && ctx && ctx.state === "running") {
    // Don't close the context; just skip future sounds.
  }
  return muted;
}

export function toggleMute() {
  return setMuted(!muted);
}

export async function unlock() {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") await c.resume();
    unlocked = true;
  } catch {
    /* ignore */
  }
}

function now() {
  const c = getCtx();
  return c ? c.currentTime : 0;
}

function dest() {
  return getCtx()?.destination;
}

function envGain(start, peak, attack, dur, peakLevel = 0.4) {
  const c = getCtx();
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peakLevel, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  return g;
}

function makeNoise(duration) {
  const c = getCtx();
  const len = Math.max(1, Math.floor(c.sampleRate * duration));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

function playIfOk(fn) {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume();
  try { fn(c); } catch { /* ignore audio glitches */ }
}

export function playHop() {
  playIfOk((c) => {
    const t = now();
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(340, t + 0.12);
    const g = envGain(t, 1, 0.012, 0.14, 0.18);
    osc.connect(g);
    g.connect(dest());
    osc.start(t);
    osc.stop(t + 0.16);
  });
}

export function playCoin() {
  playIfOk((c) => {
    const t = now();
    [880, 1320].forEach((freq, i) => {
      const osc = c.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = envGain(t + i * 0.06, 1, 0.01, 0.12, 0.16);
      osc.connect(g);
      g.connect(dest());
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.14);
    });
  });
}

export function playUi() {
  playIfOk((c) => {
    const t = now();
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.06);
    const g = envGain(t, 1, 0.008, 0.08, 0.1);
    osc.connect(g);
    g.connect(dest());
    osc.start(t);
    osc.stop(t + 0.1);
  });
}

export function playUnlock() {
  playIfOk((c) => {
    const t = now();
    [523, 659, 784, 1046].forEach((freq, i) => {
      const osc = c.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const g = envGain(t + i * 0.07, 1, 0.01, 0.18, 0.12);
      osc.connect(g);
      g.connect(dest());
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.2);
    });
  });
}

export function playWarning() {
  playIfOk((c) => {
    const t = now();
    for (let i = 0; i < 2; i++) {
      const osc = c.createOscillator();
      osc.type = "square";
      osc.frequency.value = i === 0 ? 440 : 330;
      const g = envGain(t + i * 0.22, 1, 0.02, 0.18, 0.08);
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 900;
      osc.connect(f);
      f.connect(g);
      g.connect(dest());
      osc.start(t + i * 0.22);
      osc.stop(t + i * 0.22 + 0.2);
    }
  });
}

export function playTrain() {
  playIfOk((c) => {
    const t = now();
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(140, t + 0.5);
    const g = envGain(t, 1, 0.04, 0.55, 0.07);
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 600;
    osc.connect(f);
    f.connect(g);
    g.connect(dest());
    osc.start(t);
    osc.stop(t + 0.6);
  });
}

export function playWhoosh() {
  playIfOk((c) => {
    const t = now();
    const src = makeNoise(0.25);
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(600, t);
    f.frequency.exponentialRampToValueAtTime(1400, t + 0.2);
    f.Q.value = 2;
    const g = envGain(t, 1, 0.02, 0.22, 0.08);
    src.connect(f);
    f.connect(g);
    g.connect(dest());
    src.start(t);
    src.stop(t + 0.25);
  });
}

export function playSplash() {
  playIfOk((c) => {
    const t = now();
    const src = makeNoise(0.4);
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(400, t + 0.3);
    f.Q.value = 0.8;
    const g = envGain(t, 1, 0.01, 0.38, 0.22);
    src.connect(f);
    f.connect(g);
    g.connect(dest());
    src.start(t);
    src.stop(t + 0.4);
    // droplet pings
    [0.02, 0.1, 0.18].forEach((off, i) => {
      const osc = c.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(900 - i * 160, t + off);
      osc.frequency.exponentialRampToValueAtTime(300, t + off + 0.16);
      const og = envGain(t + off, 1, 0.005, 0.16, 0.1);
      osc.connect(og);
      og.connect(dest());
      osc.start(t + off);
      osc.stop(t + off + 0.18);
    });
  });
}

export function playCloud() {
  playIfOk((c) => {
    const t = now();
    const src = makeNoise(0.7);
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(200, t + 0.6);
    const g = envGain(t, 1, 0.08, 0.65, 0.12);
    src.connect(f);
    f.connect(g);
    g.connect(dest());
    src.start(t);
    src.stop(t + 0.7);
  });
}

/**
 * Funny cartoon fart: low buzzy sputter with pitch wobble.
 * Fully synthesized. Honors the mute toggle.
 */
export function playFart() {
  playIfOk((c) => {
    const t = now();
    const dur = 0.58;
    const pulses = [
      { at: 0.00, w: 0.13, a: 1.0 },
      { at: 0.12, w: 0.08, a: 0.72 },
      { at: 0.21, w: 0.16, a: 0.9 },
      { at: 0.36, w: 0.07, a: 0.5 },
      { at: 0.44, w: 0.12, a: 0.42 }
    ];
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const tt = i / c.sampleRate;
      let env = 0;
      for (const p of pulses) {
        if (tt >= p.at && tt < p.at + p.w) {
          const u = (tt - p.at) / p.w;
          env = Math.max(env, p.a * Math.sin(Math.PI * Math.min(1, u)));
        }
      }
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = c.createBufferSource();
    src.buffer = buf;

    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 5;
    filter.frequency.setValueAtTime(420, t);
    filter.frequency.exponentialRampToValueAtTime(130, t + 0.18);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.3);
    filter.frequency.exponentialRampToValueAtTime(90, t + dur);

    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(95, t + 0.22);
    osc.frequency.exponentialRampToValueAtTime(68, t + dur);

    const lfo = c.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 17;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 28;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const oscGain = c.createGain();
    oscGain.gain.setValueAtTime(0.0001, t);
    for (const p of pulses) {
      const a = t + p.at;
      oscGain.gain.linearRampToValueAtTime(0.0001, a);
      oscGain.gain.linearRampToValueAtTime(0.22 * p.a, a + p.w * 0.35);
      oscGain.gain.linearRampToValueAtTime(0.0001, a + p.w);
    }

    const master = c.createGain();
    master.gain.value = 0.42;

    src.connect(filter);
    osc.connect(oscGain);
    oscGain.connect(filter);
    filter.connect(master);
    master.connect(dest());

    src.start(t);
    osc.start(t);
    lfo.start(t);
    src.stop(t + dur);
    osc.stop(t + dur);
    lfo.stop(t + dur);
  });
}

/** Muffled, bubbly underwater fart for river falls. Also honors mute. */
export function playBubblyFart() {
  playIfOk((c) => {
    const t = now();
    const dur = 0.7;
    const src = makeNoise(dur);
    const f1 = c.createBiquadFilter();
    f1.type = "bandpass";
    f1.frequency.setValueAtTime(280, t);
    f1.frequency.exponentialRampToValueAtTime(160, t + 0.4);
    f1.Q.value = 2.2;
    const f2 = c.createBiquadFilter();
    f2.type = "lowpass";
    f2.frequency.value = 700;
    const g = envGain(t, 1, 0.03, dur, 0.2);
    // sputter envelope
    g.gain.setValueAtTime(0.0001, t);
    [0, 0.1, 0.2, 0.34, 0.48].forEach((off, i) => {
      const a = t + off;
      g.gain.linearRampToValueAtTime(0.18 - i * 0.02, a + 0.04);
      g.gain.linearRampToValueAtTime(0.03, a + 0.1);
    });
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f1);
    f1.connect(f2);
    f2.connect(g);
    g.connect(dest());
    src.start(t);
    src.stop(t + dur);

    // bubble pops
    for (let i = 0; i < 7; i++) {
      const off = 0.04 + i * 0.08 + Math.random() * 0.03;
      const osc = c.createOscillator();
      osc.type = "sine";
      const freq = 700 + Math.random() * 900;
      osc.frequency.setValueAtTime(freq, t + off);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + off + 0.12);
      const og = envGain(t + off, 1, 0.005, 0.12, 0.07);
      osc.connect(og);
      og.connect(dest());
      osc.start(t + off);
      osc.stop(t + off + 0.14);
    }
  });
}

export default {
  unlock,
  isMuted,
  setMuted,
  toggleMute,
  playHop,
  playCoin,
  playUi,
  playUnlock,
  playWarning,
  playTrain,
  playWhoosh,
  playSplash,
  playCloud,
  playFart,
  playBubblyFart
};
