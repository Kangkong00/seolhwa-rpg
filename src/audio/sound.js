// 효과음. 파일 없이 Web Audio로 코드에서 소리를 만들고, data/sounds.json에 파일 경로를 넣으면 그 파일을 씀.
// 아이폰 사파리는 첫 터치 전에는 소리가 나지 않으므로, 첫 터치(조이스틱·버튼 포함)·키 입력 때 소리를 켬.
// 같은 소리가 질리지 않게 매번 높낮이를 ±pitchJitter 만큼 무작위로 바꿈.

const MUTE_KEY = 'seolhwa-rpg:sound-muted';

// ---------- 코드로 만드는 소리 ----------
// 모두 (ctx, out, t, p) → 소리를 out에 연결해 t초에 시작. p = 높낮이 배율(1 ± jitter)

function noiseBuffer(ctx, seconds) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function envGain(ctx, out, t, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(out);
  return g;
}

function noise(ctx, out, t, dur, { type = 'bandpass', f0, f1, q = 1, peak = 1, attack = 0.005 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, dur + 0.02);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  src.connect(f);
  f.connect(envGain(ctx, out, t, peak, attack, dur));
  src.start(t);
  src.stop(t + dur + 0.03);
}

function tone(ctx, out, t, dur, { type = 'sine', f0, f1, peak = 1, attack = 0.003 }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  o.connect(envGain(ctx, out, t, peak, attack, dur));
  o.start(t);
  o.stop(t + attack + dur + 0.02);
}

const SYNTH = {
  // 휘두르기: 잡음을 높은 소리 → 낮은 소리로 훑음(약 0.15초)
  swing(ctx, out, t, p) {
    noise(ctx, out, t, 0.15, { type: 'bandpass', f0: 3200 * p, f1: 500 * p, q: 1.2, peak: 0.9, attack: 0.02 });
  },
  // 목검 맞음: 짧은 딸깍 + 낮게 울리는 통 소리(약 0.1초)
  woodHit(ctx, out, t, p) {
    noise(ctx, out, t, 0.02, { type: 'highpass', f0: 2500 * p, q: 0.7, peak: 0.9, attack: 0.001 });
    tone(ctx, out, t, 0.1, { type: 'triangle', f0: 420 * p, f1: 300 * p, peak: 0.7, attack: 0.002 });
    tone(ctx, out, t, 0.08, { type: 'sine', f0: 900 * p, f1: 700 * p, peak: 0.25, attack: 0.001 });
  },
  // 주먹 맞음: 둔탁한 퍽(낮고 짧게)
  punchHit(ctx, out, t, p) {
    tone(ctx, out, t, 0.09, { type: 'sine', f0: 140 * p, f1: 60 * p, peak: 1, attack: 0.002 });
    noise(ctx, out, t, 0.05, { type: 'lowpass', f0: 900 * p, q: 0.7, peak: 0.6, attack: 0.002 });
  },
  // 쥐 맞음: 짧은 찍(높게 올라가는 소리, 약 0.1초)
  ratHit(ctx, out, t, p) {
    tone(ctx, out, t, 0.09, { type: 'square', f0: 1500 * p, f1: 2600 * p, peak: 0.35, attack: 0.004 });
  },
  // 쥐 쓰러짐: 길게 내려가는 찌익 + 작은 털썩
  ratDie(ctx, out, t, p) {
    tone(ctx, out, t, 0.38, { type: 'square', f0: 2200 * p, f1: 600 * p, peak: 0.3, attack: 0.01 });
    tone(ctx, out, t + 0.36, 0.08, { type: 'sine', f0: 110 * p, f1: 60 * p, peak: 0.8, attack: 0.002 });
    noise(ctx, out, t + 0.36, 0.05, { type: 'lowpass', f0: 600, q: 0.7, peak: 0.4, attack: 0.002 });
  },
  // 주인공 물림: 둔탁한 소리 + 짧은 잡음
  playerHurt(ctx, out, t, p) {
    tone(ctx, out, t, 0.12, { type: 'sine', f0: 170 * p, f1: 80 * p, peak: 0.9, attack: 0.003 });
    noise(ctx, out, t, 0.06, { type: 'bandpass', f0: 1800 * p, q: 0.8, peak: 0.5, attack: 0.002 });
  },
};

export class SoundPlayer {
  constructor(cfg) {
    this.cfg = cfg;
    this.ctx = null;
    this.master = null;
    this.buffers = {}; // 파일 소리
    this.muted = false;
    try {
      this.muted = window.localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
    this.unlock = this.unlock.bind(this);
    // 첫 터치·클릭·키 입력 때 소리 켜기 (캡처 단계라 조이스틱·버튼이 막아도 받음)
    for (const ev of ['touchstart', 'touchend', 'pointerdown', 'keydown']) {
      window.addEventListener(ev, this.unlock, { capture: true, passive: true });
    }
  }

  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
      this.loadFiles();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    // 아이폰: 사용자 입력 안에서 빈 소리를 한 번 내야 이후 소리가 남
    const b = this.ctx.createBuffer(1, 1, 22050);
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    s.connect(this.ctx.destination);
    s.start(0);
    if (this.ctx.state === 'running') {
      for (const ev of ['touchstart', 'touchend', 'pointerdown', 'keydown']) {
        window.removeEventListener(ev, this.unlock, { capture: true });
      }
    }
  }

  // data/sounds.json에 파일 경로가 있는 소리는 미리 받아 둠
  loadFiles() {
    for (const [name, s] of Object.entries(this.cfg.sounds)) {
      if (!s.file) continue;
      fetch(s.file)
        .then((r) => r.arrayBuffer())
        .then((a) => this.ctx.decodeAudioData(a))
        .then((buf) => {
          this.buffers[name] = buf;
        })
        .catch(() => {
          // 파일을 못 읽으면 코드로 만든 소리를 씀
        });
    }
  }

  applyVolume() {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.cfg.master;
  }

  setMuted(m) {
    this.muted = m;
    try {
      window.localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      // 저장 못 해도 이번 실행에서는 적용
    }
    this.applyVolume();
  }

  play(name) {
    const s = this.cfg.sounds[name];
    if (!s || this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const j = this.cfg.pitchJitter || 0;
    const p = 1 + (Math.random() * 2 - 1) * j;
    const out = ctx.createGain();
    out.gain.value = s.volume;
    out.connect(this.master);
    const t = ctx.currentTime + 0.005;
    const buf = this.buffers[name];
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = p;
      src.connect(out);
      src.start(t);
      return;
    }
    if (SYNTH[name]) SYNTH[name](ctx, out, t, p);
  }
}
