// 무예 연출(docs/spec/feedback_1015.md 1, 그림 없이 코드로). 값은 data/skills.json.
import { ensureSparkleTexture } from './progressFx.js';
import { SHADOW_TEXTURE, ensureShadowTexture } from './shadow.js';

const hex = (c) => Phaser.Display.Color.HexStringToColor(c).color;
const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// 힘껏 베기: 앞쪽으로 금·흰 반달 충격파가 waveRadius까지 퍼지며 waveMs에 사라짐
export function crescentWave(scene, x, y, facing, sk) {
  const [dx, dy] = DIR[facing];
  const cx = x + dx * 8;
  const cy = y - 20 + dy * 6;
  const base = Math.atan2(dy, dx);
  const g = scene.add.graphics().setDepth(y + 0.04).setBlendMode(Phaser.BlendModes.ADD);
  const o = { k: 0 };
  scene.tweens.add({
    targets: o,
    k: 1,
    duration: sk.waveMs,
    ease: 'Cubic.easeOut',
    onUpdate: () => {
      const r = 12 + (sk.waveRadius - 12) * o.k;
      const a = 1 - o.k;
      g.clear();
      // 바깥 금빛 굵은 호 + 안쪽 흰 얇은 호 (세로는 0.6배로 눌러 땅에 누운 느낌)
      for (const [w, col, al, rr] of [[7 * a + 2, sk.waveColor, 0.8 * a, r], [3, '#ffffff', a, r * 0.86]]) {
        g.lineStyle(w, hex(col), al);
        g.beginPath();
        const n = 18;
        for (let i = 0; i <= n; i++) {
          const ang = base - 1.1 + (2.2 * i) / n;
          const px = cx + Math.cos(ang) * rr;
          const py = cy + Math.sin(ang) * rr * 0.6;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
      }
    },
    onComplete: () => g.destroy(),
  });
}

// 숨 고르기: 발밑 푸른 고리 2개(0.15초 간격, 지름 ringFrom → ringTo) + 몸에서 빛 알갱이가 떠오름
export function breathRings(scene, getPos, sk) {
  for (let i = 0; i < sk.rings; i++) {
    scene.time.delayedCall(i * sk.ringGapMs, () => {
      const p = getPos();
      const g = scene.add.graphics().setDepth(p.y - 0.08).setBlendMode(Phaser.BlendModes.ADD);
      const o = { k: 0 };
      scene.tweens.add({
        targets: o,
        k: 1,
        duration: sk.ringMs,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          const q = getPos();
          const d = sk.ringFrom + (sk.ringTo - sk.ringFrom) * o.k;
          g.clear();
          g.lineStyle(3 * (1 - o.k) + 1, hex(sk.ringColor), 0.9 * (1 - o.k));
          g.strokeEllipse(q.x, q.y, d, d * 0.45);
        },
        onComplete: () => g.destroy(),
      });
    });
  }
  const tex = ensureSparkleTexture(scene);
  for (let i = 0; i < sk.particleCount; i++) {
    const delay = Math.random() * sk.particleMs * 0.3;
    const ox = (Math.random() - 0.5) * 22;
    const oy = -Math.random() * 40;
    const size = 3 + Math.random() * 3;
    const img = scene.add.image(0, 0, tex).setTint(hex(sk.particleColor)).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(size, size).setAlpha(0);
    const o = { k: 0 };
    scene.tweens.add({
      targets: o,
      k: 1,
      delay,
      duration: sk.particleMs * (0.7 + Math.random() * 0.3),
      ease: 'Sine.easeOut',
      onUpdate: () => {
        const p = getPos();
        img.setPosition(p.x + ox + Math.sin(o.k * 6 + i) * 3, p.y - 6 + oy - o.k * 34).setAlpha(o.k < 0.2 ? o.k * 5 : 1 - (o.k - 0.2) / 0.8).setDepth(p.y + 0.06);
      },
      onComplete: () => img.destroy(),
    });
  }
}

// 휘돌려 베기: 몸 둘레 반투명 바람 고리(끊긴 호 3개가 빙빙) + 바닥 먼지. 주인공을 따라감
export class WindRing {
  constructor(scene, sk) {
    this.scene = scene;
    this.sk = sk;
    this.back = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.front = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.alpha = 0;
    this.dustT = 0;
    ensureShadowTexture(scene);
  }

  // p: 주인공 발 위치, t: 시작부터 지난 시간, dt: 이번 프레임
  update(p, t, dt) {
    const sk = this.sk;
    const r = sk.radius;
    this.alpha = Math.min(1, t / 150);
    const cy = p.y - 14;
    const rot = (t / sk.turnMs) * Math.PI * 2;
    this.back.clear().setDepth(p.y - 0.05);
    this.front.clear().setDepth(p.y + 0.05);
    // 은은한 바탕 고리
    this.back.lineStyle(2, hex(sk.ringColor), sk.ringAlpha * 0.5 * this.alpha);
    this.back.strokeEllipse(p.x, cy, r * 2, r * 2 * 0.5);
    // 끊긴 호 3개: 위쪽(뒤)은 몸 뒤, 아래쪽(앞)은 몸 앞
    for (let i = 0; i < 3; i++) {
      const a0 = rot + (i * Math.PI * 2) / 3;
      const n = 10;
      for (let j = 0; j < n; j++) {
        const a = a0 + (j / n) * 1.3;
        const b = a0 + ((j + 1) / n) * 1.3;
        const g = Math.sin((a + b) / 2) > 0 ? this.front : this.back;
        g.lineStyle(1 + 3 * (j / n), hex(sk.ringColor), sk.ringAlpha * this.alpha * (0.3 + 0.7 * (j / n)));
        g.beginPath();
        g.moveTo(p.x + Math.cos(a) * r, cy + Math.sin(a) * r * 0.5);
        g.lineTo(p.x + Math.cos(b) * r, cy + Math.sin(b) * r * 0.5);
        g.strokePath();
      }
    }
    // 바닥 먼지
    this.dustT -= dt;
    if (this.dustT <= 0) {
      this.dustT = sk.dustEveryMs;
      const a = Math.random() * Math.PI * 2;
      const dust = this.scene.add
        .image(p.x + Math.cos(a) * r * 0.9, p.y + Math.sin(a) * r * 0.35, SHADOW_TEXTURE)
        .setTint(hex(sk.dustColor))
        .setDisplaySize(8, 4)
        .setAlpha(0.5)
        .setDepth(-0.85);
      this.scene.tweens.add({ targets: dust, displayWidth: 22, displayHeight: 9, alpha: 0, y: dust.y - 3, duration: 500, onComplete: () => dust.destroy() });
    }
  }

  fadeOut() {
    this.scene.tweens.add({ targets: [this.back, this.front], alpha: 0, duration: 250, onComplete: () => { this.back.destroy(); this.front.destroy(); } });
  }
}
