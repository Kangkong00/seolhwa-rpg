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

// ---------- 무예 10개 연출(docs/spec/skills_impact.md 2, 그림 없이 코드로). 직업이 늘어도 kind별로 같이 씀 ----------
const TOP = 1e6 - 2; // 몬스터·주인공 위, 숫자 아래

// 잔상: 지금 주인공 몸·무기 그림을 그 자리에 복사해 color로 칠하고 ms 동안 흐려짐
export function afterimage(scene, pv, color, alpha, ms) {
  const out = [];
  for (const src of [pv.sprite, pv.weaponSprite]) {
    if (!src || !src.visible || !src.texture || src.texture.key === '__DEFAULT') continue;
    const img = scene.add
      .image(src.x, src.y, src.texture.key, src.frame.name)
      .setOrigin(src.originX, src.originY)
      .setScale(src.scaleX, src.scaleY)
      .setRotation(src.rotation)
      .setFlipX(src.flipX)
      .setDepth(src.depth - 0.2)
      .setAlpha(alpha)
      .setTint(hex(color))
      .setTintMode(Phaser.TintModes.FILL);
    scene.tweens.add({ targets: img, alpha: 0, duration: ms, onComplete: () => img.destroy() });
    out.push(img);
  }
  return out;
}

// 지나간 자리 바람 줄: (x0,y0) → (x1,y1) 흰 줄 몇 가닥이 가늘어지며 사라짐. tiger면 검은 호랑이 무늬 토막을 얹음
export function windStreak(scene, x0, y0, x1, y1, color, ms, { width = 10, tiger = false } = {}) {
  const g = scene.add.graphics().setDepth(TOP - 1).setBlendMode(Phaser.BlendModes.ADD);
  const stripes = tiger ? scene.add.graphics().setDepth(TOP - 0.5) : null;
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  const o = { k: 0 };
  const draw = () => {
    const a = 1 - o.k;
    g.clear();
    for (const [off, w, al] of [[0, width, 0.55], [-width * 0.6, width * 0.35, 0.4], [width * 0.6, width * 0.35, 0.4], [0, width * 0.35, 1]]) {
      g.lineStyle(Math.max(1, w * a), off === 0 && al === 1 ? 0xffffff : hex(color), al * a);
      g.lineBetween(x0 + nx * off, y0 + ny * off - 16, x1 + nx * off, y1 + ny * off - 16);
    }
    if (stripes) {
      stripes.clear();
      stripes.fillStyle(0x1a1410, 0.75 * a);
      for (let i = 1; i < 9; i++) {
        const t = i / 9;
        const cx = x0 + (x1 - x0) * t;
        const cy = y0 + (y1 - y0) * t - 16;
        const h = width * (0.7 + 0.3 * Math.sin(i * 2.1)) * a;
        stripes.fillTriangle(cx - nx * h + (x1 - x0) / len * 3, cy - ny * h + (y1 - y0) / len * 3, cx + nx * h * 0.2, cy + ny * h * 0.2, cx - nx * h * 0.2 - (x1 - x0) / len * 3, cy - ny * h * 0.2 - (y1 - y0) / len * 3);
      }
    }
  };
  draw();
  scene.tweens.add({ targets: o, k: 1, duration: ms, ease: 'Quad.easeIn', onUpdate: draw, onComplete: () => { g.destroy(); if (stripes) stripes.destroy(); } });
}

// 호통: 입 앞에서 동심원 rings개가 radius까지 퍼짐
export function shoutRings(scene, x, y, sk) {
  for (let i = 0; i < sk.rings; i++) {
    scene.time.delayedCall(i * sk.ringGapMs, () => {
      const g = scene.add.graphics().setDepth(TOP - 1).setBlendMode(Phaser.BlendModes.ADD);
      const o = { k: 0 };
      scene.tweens.add({
        targets: o,
        k: 1,
        duration: sk.ringMs,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          const r = 8 + (sk.radius - 8) * o.k;
          g.clear();
          g.lineStyle(5 * (1 - o.k) + 1.5, hex(sk.ringColor), 0.9 * (1 - o.k));
          g.strokeEllipse(x, y, r * 2, r * 1.3);
        },
        onComplete: () => g.destroy(),
      });
    });
  }
}

// 머리 위 "!" (멈칫한 몬스터)
export function exclaim(scene, x, y, text, color, ms, pixelRatio) {
  const t = scene.add
    .text(x, y, text, { fontFamily: 'sans-serif', fontSize: '20px', fontStyle: 'bold', color, stroke: '#3a1a10', strokeThickness: 3 })
    .setOrigin(0.5, 1)
    .setResolution(pixelRatio * 2)
    .setDepth(1e6)
    .setScale(0.4);
  scene.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: t, alpha: 0, y: y - 8, delay: ms - 250, duration: 250, onComplete: () => t.destroy() });
}

// 땅 갈라짐: (x,y)에서 (dx,dy) 쪽으로 length까지 지그재그 금이 crackMs 동안 달려가고 돌 조각이 튐.
// onReach(거리)는 금 끝이 지나갈 때마다 불림(맞힘 판정을 금에 맞추려고)
export function groundCrack(scene, x, y, dx, dy, sk, onReach) {
  const g = scene.add.graphics().setDepth(-0.8);
  const glow = scene.add.graphics().setDepth(-0.79).setBlendMode(Phaser.BlendModes.ADD);
  const pts = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const side = i === 0 || i === n ? 0 : (i % 2 ? 1 : -1) * (3 + Math.random() * 4);
    pts.push({ x: x + dx * sk.length * t - dy * side, y: y + dy * sk.length * t * 0.9 + dx * side * 0.6, d: sk.length * t });
  }
  const o = { k: 0 };
  let thrown = 0;
  scene.tweens.add({
    targets: o,
    k: 1,
    duration: sk.crackMs,
    onUpdate: () => {
      const upto = o.k * n;
      g.clear();
      glow.clear();
      g.lineStyle(6, hex(sk.crackColor), 0.95);
      glow.lineStyle(3, hex(sk.glowColor), 1 - o.k * 0.4);
      for (const gg of [g, glow]) {
        gg.beginPath();
        gg.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i <= Math.ceil(upto) && i <= n; i++) {
          const f = Math.min(1, upto - (i - 1));
          gg.lineTo(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f);
        }
        gg.strokePath();
      }
      onReach(sk.length * o.k);
      // 돌 조각
      const want = Math.floor(o.k * sk.rockCount);
      for (; thrown < want; thrown++) {
        const p = pts[Math.min(n, Math.floor((thrown / sk.rockCount) * n) + 1)];
        const r = scene.add.rectangle(p.x, p.y, 3 + Math.random() * 3, 3 + Math.random() * 2, hex(sk.rockColor)).setDepth(p.y + 0.1).setAngle(Math.random() * 90);
        scene.tweens.add({ targets: r, y: p.y - 10 - Math.random() * 14, x: p.x + (Math.random() - 0.5) * 16, angle: r.angle + 180, duration: 220, yoyo: true, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
      }
    },
    onComplete: () => {
      scene.tweens.add({ targets: [g, glow], alpha: 0, delay: 500, duration: 700, onComplete: () => { g.destroy(); glow.destroy(); } });
    },
  });
}

// 검풍 반달: 위치·방향을 받아 그리는 그림(매 프레임 draw). 무기 궤적 색 + 흰 속
export class CrescentShot {
  constructor(scene, dx, dy, size, color) {
    this.scene = scene;
    this.g = scene.add.graphics().setDepth(TOP - 1).setBlendMode(Phaser.BlendModes.ADD);
    this.trail = [];
    this.base = Math.atan2(dy, dx);
    this.size = size;
    this.color = hex(color);
  }

  draw(x, y, alpha = 1) {
    this.trail.push({ x, y });
    if (this.trail.length > 6) this.trail.shift();
    const g = this.g;
    g.clear();
    this.trail.forEach((p, i) => {
      const k = (i + 1) / this.trail.length;
      for (const [w, col, al, rr] of [[6 * k, this.color, 0.35 * k * alpha, this.size], [2.5, 0xffffff, 0.9 * k * alpha, this.size * 0.85]]) {
        g.lineStyle(w, col, al);
        g.beginPath();
        for (let j = 0; j <= 14; j++) {
          const a = this.base - 1.2 + (2.4 * j) / 14;
          const px = p.x + Math.cos(a) * rr * 0.5;
          const py = p.y - 16 + Math.sin(a) * rr * 0.75;
          if (j === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
      }
    });
  }

  destroy() {
    this.scene.tweens.add({ targets: this.g, alpha: 0, duration: 180, onComplete: () => this.g.destroy() });
  }
}

// 받아치기 칼막: 몸 앞에 반투명 금빛 호(막는 동안 따라감)
export class GuardShield {
  constructor(scene, color) {
    this.scene = scene;
    this.g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.color = hex(color);
  }

  draw(x, y, facing, t) {
    const [dx, dy] = DIR[facing];
    const g = this.g;
    const cx = x + dx * 14;
    const cy = y - 22 + dy * 6;
    const base = Math.atan2(dy, dx);
    const pulse = 0.75 + 0.25 * Math.sin(t / 60);
    g.clear().setDepth(y + (dy < 0 ? -0.05 : 0.05));
    g.fillStyle(this.color, 0.18 * pulse);
    g.lineStyle(3, this.color, 0.85 * pulse);
    g.beginPath();
    for (let j = 0; j <= 16; j++) {
      const a = base - 1.1 + (2.2 * j) / 16;
      const px = cx + Math.cos(a) * 18;
      const py = cy + Math.sin(a) * 26;
      if (j === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();
    g.fillEllipse(cx, cy, 22 + Math.abs(dy) * 14, 46 - Math.abs(dy) * 20);
  }

  destroy() {
    this.scene.tweens.add({ targets: this.g, alpha: 0, duration: 150, onComplete: () => this.g.destroy() });
  }
}

// 회오리 나뭇잎: 몸 둘레를 돌며 올라가는 잎사귀(ms 동안)
export function leafSwirl(scene, getPos, sk, ms) {
  for (let i = 0; i < sk.leafCount; i++) {
    const leaf = scene.add.ellipse(0, 0, 5, 2.5, hex(sk.leafColor), 0.9);
    const a0 = (i / sk.leafCount) * Math.PI * 2;
    const r0 = sk.radius * (0.5 + Math.random() * 0.6);
    const o = { k: 0 };
    scene.tweens.add({
      targets: o,
      k: 1,
      delay: Math.random() * 300,
      duration: ms,
      onUpdate: () => {
        const p = getPos();
        const a = a0 + o.k * Math.PI * 8;
        const s = Math.sin(a);
        leaf.setPosition(p.x + Math.cos(a) * r0, p.y - 8 + s * r0 * 0.4 - o.k * 18).setRotation(a * 2).setDepth(p.y + (s > 0 ? 0.06 : -0.06)).setAlpha(o.k > 0.85 ? (1 - o.k) / 0.15 : 0.9);
      },
      onComplete: () => leaf.destroy(),
    });
  }
}

// 번개: 하늘(위 160)에서 (x,y)로 지그재그 번개 + 내리친 자리 그을음
export function lightning(scene, x, y, sk) {
  const g = scene.add.graphics().setDepth(TOP).setBlendMode(Phaser.BlendModes.ADD);
  const pts = [{ x: x + (Math.random() - 0.5) * 30, y: y - 170 }];
  for (let i = 1; i < 8; i++) pts.push({ x: x + (Math.random() - 0.5) * 22 * (1 - i / 8), y: y - 170 + (170 * i) / 8 });
  pts.push({ x, y: y - 6 });
  const draw = (a) => {
    g.clear();
    for (const [w, col, al] of [[8, hex(sk.boltColor), 0.35], [3, 0xffffff, 1]]) {
      g.lineStyle(w, col, al * a);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
      g.strokePath();
    }
    g.fillStyle(0xffffff, 0.8 * a);
    g.fillCircle(x, y - 6, 10 * a);
  };
  draw(1);
  const o = { a: 1 };
  scene.tweens.add({ targets: o, a: 0, duration: 220, ease: 'Quad.easeIn', onUpdate: () => draw(o.a), onComplete: () => g.destroy() });
  const scorch = scene.add.ellipse(x, y, 26, 11, 0x1a1208, 0.55).setDepth(-0.82);
  scene.tweens.add({ targets: scorch, alpha: 0, delay: sk.scorchMs * 0.5, duration: sk.scorchMs * 0.5, onComplete: () => scorch.destroy() });
}

// 칠성검무 별자리: 땅에 북두칠성을 그리고 light(i)로 별을 하나씩 켬
export class StarMap {
  constructor(scene, pts, color) {
    this.scene = scene;
    this.pts = pts;
    this.color = hex(color);
    this.lit = 0;
    this.lines = scene.add.graphics().setDepth(-0.78).setBlendMode(Phaser.BlendModes.ADD);
    this.stars = scene.add.graphics().setDepth(-0.77).setBlendMode(Phaser.BlendModes.ADD);
    this.t = 0;
    this.draw();
  }

  light(i) {
    this.lit = Math.max(this.lit, i + 1);
  }

  update(dt) {
    this.t += dt;
    this.draw();
  }

  draw() {
    const { pts, lines, stars } = this;
    lines.clear();
    stars.clear();
    lines.lineStyle(1.5, this.color, 0.35);
    lines.beginPath();
    lines.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) lines.lineTo(p.x, p.y);
    lines.lineTo(pts[3].x, pts[3].y); // 국자 머리를 닫음
    lines.strokePath();
    pts.forEach((p, i) => {
      const on = i < this.lit;
      const tw = 0.8 + 0.2 * Math.sin(this.t / 90 + i);
      stars.fillStyle(on ? 0xffffff : this.color, on ? 0.95 * tw : 0.35);
      stars.fillCircle(p.x, p.y, on ? 4 : 2.5);
      if (on) {
        stars.fillStyle(this.color, 0.3 * tw);
        stars.fillEllipse(p.x, p.y, 26, 12);
      }
    });
  }

  destroy() {
    this.scene.tweens.add({ targets: [this.lines, this.stars], alpha: 0, duration: 500, onComplete: () => { this.lines.destroy(); this.stars.destroy(); } });
  }
}

// 큰 폭발(궁극 마지막): 금빛 원판 + 흰 고리가 radius까지 퍼짐
export function bigBurst(scene, x, y, radius, color, ms = 450) {
  const g = scene.add.graphics().setDepth(TOP).setBlendMode(Phaser.BlendModes.ADD);
  const o = { k: 0 };
  scene.tweens.add({
    targets: o,
    k: 1,
    duration: ms,
    ease: 'Cubic.easeOut',
    onUpdate: () => {
      const r = radius * o.k;
      const a = 1 - o.k;
      g.clear();
      g.fillStyle(hex(color), 0.45 * a);
      g.fillEllipse(x, y - 10, r * 2, r * 1.2);
      g.lineStyle(6 * a + 1, 0xffffff, a);
      g.strokeEllipse(x, y - 10, r * 2.1, r * 1.25);
      g.lineStyle(3, hex(color), a);
      g.strokeEllipse(x, y - 10, r * 1.5, r * 0.9);
    },
    onComplete: () => g.destroy(),
  });
}
