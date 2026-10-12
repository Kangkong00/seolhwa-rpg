// 효과음. 파일 없이 Web Audio로 코드에서 소리를 만들고, data/sounds.json에 파일 경로를 넣으면 그 파일을 씀.
// 아이폰 사파리는 첫 터치 전에는 소리가 나지 않으므로, 첫 터치(조이스틱·버튼 포함)·키 입력 때 소리를 켬.
// 이때 무음 모드(옆 스위치)에서도 소리가 나게 재생 모드로 바꿈(enablePlaybackMode).
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
  // 레벨업 화음: 편종처럼 맑은 종이 위로 올라가며 쌓임(도·미·솔·도·미). 종은 배음이 1 : 2.76 : 5.4 정도
  levelUp(ctx, out, t, p) {
    const bell = (t0, f, peak, dur) => {
      [[1, 1], [2.76, 0.4], [5.4, 0.18], [8.93, 0.08]].forEach(([r, a]) => {
        tone(ctx, out, t0, dur / Math.sqrt(r), { type: 'sine', f0: f * r * p, peak: peak * a, attack: 0.003 });
      });
    };
    [523, 659, 784, 1047, 1319].forEach((f, i) => bell(t + i * 0.11, f, 0.42, 1.6));
  },
  // 레벨업 첫 소리: 낮은 징 한 번(둥 — 살짝 맥놀이하는 낮은 소리 + 치는 잡음)
  levelGong(ctx, out, t, p) {
    tone(ctx, out, t, 1.8, { type: 'sine', f0: 98 * p, f1: 92 * p, peak: 0.8, attack: 0.01 });
    tone(ctx, out, t, 1.6, { type: 'sine', f0: 101 * p, f1: 95 * p, peak: 0.5, attack: 0.01 });
    tone(ctx, out, t, 1.1, { type: 'sine', f0: 196 * p * 1.48, peak: 0.18, attack: 0.02 });
    noise(ctx, out, t, 0.08, { type: 'lowpass', f0: 500, q: 0.7, peak: 0.5, attack: 0.002 });
  },
  // 전리품 주움: 짧고 가벼운 톡
  pickup(ctx, out, t, p) {
    tone(ctx, out, t, 0.06, { type: 'sine', f0: 880 * p, f1: 1320 * p, peak: 0.5, attack: 0.003 });
  },
  // 엽전 주움·사고팔기: 쇠붙이 짤랑
  coin(ctx, out, t, p) {
    tone(ctx, out, t, 0.12, { type: 'sine', f0: 2400 * p, peak: 0.4, attack: 0.001 });
    tone(ctx, out, t + 0.05, 0.16, { type: 'sine', f0: 3150 * p, peak: 0.3, attack: 0.001 });
    tone(ctx, out, t, 0.05, { type: 'square', f0: 1800 * p, peak: 0.08, attack: 0.001 });
  },
  // 숨 고르기·먹기: 부드럽게 부푸는 소리
  heal(ctx, out, t, p) {
    tone(ctx, out, t, 0.5, { type: 'sine', f0: 392 * p, f1: 587 * p, peak: 0.45, attack: 0.12 });
    tone(ctx, out, t + 0.05, 0.45, { type: 'sine', f0: 784 * p, f1: 1175 * p, peak: 0.15, attack: 0.12 });
  },
  // 무예 배움·의뢰 마침: 두 음 울림
  learn(ctx, out, t, p) {
    tone(ctx, out, t, 0.3, { type: 'triangle', f0: 659 * p, peak: 0.5, attack: 0.005 });
    tone(ctx, out, t + 0.14, 0.45, { type: 'triangle', f0: 988 * p, peak: 0.5, attack: 0.005 });
  },
  // 주인공 물림: 둔탁한 소리 + 짧은 잡음
  playerHurt(ctx, out, t, p) {
    tone(ctx, out, t, 0.12, { type: 'sine', f0: 170 * p, f1: 80 * p, peak: 0.9, attack: 0.003 });
    noise(ctx, out, t, 0.06, { type: 'bandpass', f0: 1800 * p, q: 0.8, peak: 0.5, attack: 0.002 });
  },
};

// 소리 없는 짧은 WAV(0.5초, 8000Hz, 8비트 — 값 128이 무음)를 만들어 주소로 돌려줌
function silentWavUrl() {
  const rate = 8000;
  const n = rate / 2;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, n, true);
  new Uint8Array(buf, 44).fill(128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export class SoundPlayer {
  constructor(cfg) {
    this.cfg = cfg;
    this.ctx = null;
    this.master = null;
    this.buffers = {}; // 파일 소리
    this.muted = false;
    this.playbackReady = false; // 무음 모드에서도 소리 나는 '재생' 모드로 바꿨는지
    this.silentAudio = null;
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
    this.enablePlaybackMode();
    // 아이폰: 사용자 입력 안에서 빈 소리를 한 번 내야 이후 소리가 남
    const b = this.ctx.createBuffer(1, 1, 22050);
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    s.connect(this.ctx.destination);
    s.start(0);
    if (this.ctx.state === 'running' && this.playbackReady) {
      for (const ev of ['touchstart', 'touchend', 'pointerdown', 'keydown']) {
        window.removeEventListener(ev, this.unlock, { capture: true });
      }
    }
  }

  // 아이폰 무음 모드(옆 스위치)에서도 효과음이 나게 '재생' 모드로 바꿈.
  // - navigator.audioSession이 있으면(사파리 16.4+) type = 'playback'
  // - 없으면 소리 없는 아주 짧은 <audio>를 반복 재생 (미디어가 재생 중이면 Web Audio도 무음 스위치를 무시함)
  // 반드시 사용자 입력(터치·키) 안에서 불러야 함. 성공할 때까지 다음 입력에서 다시 시도.
  enablePlaybackMode() {
    if (this.playbackReady) return;
    try {
      if (navigator.audioSession) {
        navigator.audioSession.type = 'playback';
        this.playbackReady = true;
        return;
      }
    } catch {
      // 못 바꾸면 아래 방법으로
    }
    if (!this.silentAudio) {
      const a = document.createElement('audio');
      a.src = silentWavUrl();
      a.loop = true;
      a.preload = 'auto';
      a.setAttribute('playsinline', '');
      a.setAttribute('x-webkit-airplay', 'deny');
      this.silentAudio = a;
      // 다른 앱으로 나가면 멈추고, 돌아오면 다시 (화면 잠금 화면에 재생 중으로 남지 않게)
      document.addEventListener('visibilitychange', () => {
        if (!this.playbackReady) return;
        if (document.hidden) a.pause();
        else a.play().catch(() => {});
      });
    }
    const r = this.silentAudio.play();
    if (r && r.then) {
      r.then(() => { this.playbackReady = true; }).catch(() => {});
    } else {
      this.playbackReady = true;
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
