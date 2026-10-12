// 레벨업·숨 고르기·휘돌려 베기 연출(그림 없이 코드로).
import { ensureShadowTexture, SHADOW_TEXTURE } from './shadow.js';

const FONT = '-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

// 떠오르며 흐려지는 글자
export function floatText(scene, x, y, text, { color = '#ffffff', stroke = '#000000', fontPx = 11, floatPx = 18, floatMs = 900 }, pixelRatio) {
  const t = scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: `${fontPx}px`, fontStyle: 'bold', color, stroke, strokeThickness: 3 })
    .setOrigin(0.5, 1)
    .setResolution(pixelRatio * 2)
    .setDepth(1e6);
  scene.tweens.add({
    targets: t,
    y: y - floatPx,
    alpha: { from: 1, to: 0 },
    duration: floatMs,
    ease: 'Cubic.easeOut',
    onComplete: () => t.destroy(),
  });
  return t;
}

// 발밑에서 퍼지는 빛 고리(그림자 타원 그림을 색칠해 더하기로 그림)
export function glowRing(scene, x, y, color, { w = 30, h = 12, grow = 2.4, ms = 700, alpha = 0.9, depth = null } = {}) {
  ensureShadowTexture(scene);
  const c = Phaser.Display.Color.HexStringToColor(color).color;
  const img = scene.add
    .image(x, y, SHADOW_TEXTURE)
    .setTint(c)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDisplaySize(w, h)
    .setAlpha(alpha)
    .setDepth(depth ?? y - 0.1);
  scene.tweens.add({
    targets: img,
    displayWidth: w * grow,
    displayHeight: h * grow,
    alpha: 0,
    duration: ms,
    ease: 'Cubic.easeOut',
    onComplete: () => img.destroy(),
  });
  return img;
}

// 빛기둥 그림: 아래가 밝고 위로 갈수록 흐려지는 세로 띠(가로 가장자리도 흐림), 흰색 → 색칠해 씀
function ensurePillarTexture(scene) {
  const key = 'fx:pillar';
  if (scene.textures.exists(key)) return key;
  const w = 64;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const v = ctx.createLinearGradient(0, h, 0, 0);
  v.addColorStop(0, 'rgba(255,255,255,1)');
  v.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  v.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  // 가로 가장자리를 흐리게
  ctx.globalCompositeOperation = 'destination-in';
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.3, 'rgba(0,0,0,1)');
  g.addColorStop(0.7, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  scene.textures.addCanvas(key, c);
  return key;
}

// 반짝이 그림: 네 갈래 별
function ensureSparkleTexture(scene) {
  const key = 'fx:sparkle';
  if (scene.textures.exists(key)) return key;
  const n = 32;
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const ctx = c.getContext('2d');
  const r = n / 2;
  const glow = ctx.createRadialGradient(r, r, 0, r, r, r * 0.5);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, n, n);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.quadraticCurveTo(r, r, n, r);
  ctx.quadraticCurveTo(r, r, r, n);
  ctx.quadraticCurveTo(r, r, 0, r);
  ctx.quadraticCurveTo(r, r, r, 0);
  ctx.fill();
  scene.textures.addCanvas(key, c);
  return key;
}

// 레벨업 연출(그림 없이 코드로, 값은 data/economy.json levelUpFx):
// ① 발밑 금빛 고리 ② 몸을 감싸며 아래에서 위로 솟았다 사라지는 빛기둥 ③ 떠오르는 반짝이
// ④ 머리 위 붓글씨 `레벨 업!` + `레벨 N` ⑤(체력바 차오름은 MapScene) ⑥(종소리·멈춤·화면 가장자리는 MapScene)
export function levelUpFx(scene, x, y, height, level, cfg, pixelRatio) {
  const color = (c) => Phaser.Display.Color.HexStringToColor(c).color;
  // ① 발밑 고리 두 번
  glowRing(scene, x, y, cfg.ringColor, { w: 34, h: 14, grow: 3.2, ms: 900 });
  scene.time.delayedCall(200, () => glowRing(scene, x, y, cfg.ringColor, { w: 30, h: 12, grow: 2.5, ms: 800 }));
  // ② 빛기둥: 몸 뒤에 진하게, 몸 앞에 옅게(앞에 진하면 캐릭터가 하얗게 바램)
  const pillarKey = ensurePillarTexture(scene);
  const H = height * cfg.pillarHeight;
  for (const [depth, alpha] of [[y - 0.05, 0.85], [y + 0.05, 0.22]]) {
    const p = scene.add
      .image(x, y + 2, pillarKey)
      .setOrigin(0.5, 1)
      .setTint(color(cfg.pillarColor))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(cfg.pillarWidth, 1)
      .setAlpha(alpha)
      .setDepth(depth);
    scene.tweens.add({ targets: p, displayHeight: H, duration: cfg.pillarMs * 0.4, ease: 'Cubic.easeOut' });
    scene.tweens.add({
      targets: p,
      alpha: 0,
      displayWidth: cfg.pillarWidth * 0.5,
      delay: cfg.pillarMs * 0.4,
      duration: cfg.pillarMs * 0.6,
      ease: 'Quad.easeIn',
      onComplete: () => p.destroy(),
    });
  }
  // ③ 반짝이
  const sparkKey = ensureSparkleTexture(scene);
  for (let i = 0; i < cfg.sparkleCount; i++) {
    const sx = x + (Math.random() - 0.5) * cfg.pillarWidth * 1.3;
    const sy = y - Math.random() * height * 0.8;
    const size = 5 + Math.random() * 5;
    const sp = scene.add
      .image(sx, sy, sparkKey)
      .setTint(color(cfg.sparkleColor))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(size, size)
      .setAlpha(0)
      .setDepth(y + 0.06);
    const delay = Math.random() * cfg.sparkleMs * 0.35;
    scene.tweens.add({
      targets: sp,
      y: sy - cfg.sparkleRise * (0.6 + Math.random() * 0.6),
      angle: 90,
      delay,
      duration: cfg.sparkleMs,
      ease: 'Sine.easeOut',
      onComplete: () => sp.destroy(),
    });
    scene.tweens.add({ targets: sp, alpha: { from: 1, to: 0 }, delay, duration: cfg.sparkleMs, ease: 'Quad.easeIn' });
  }
  // ④ 붓글씨 글자: 톡 커지며 나타났다가 잠시 머문 뒤 떠오르며 흐려짐
  const font = `${cfg.font}, "Apple SD Gothic Neo", serif`;
  const top = y - height - 6;
  const big = scene.add
    .text(x, top - cfg.subFontPx, '레벨 업!', { fontFamily: font, fontSize: `${cfg.fontPx}px`, color: cfg.color, stroke: cfg.stroke, strokeThickness: 4 })
    .setOrigin(0.5, 1)
    .setResolution(pixelRatio * 2)
    .setDepth(1e6);
  const sub = scene.add
    .text(x, top, `레벨 ${level}`, { fontFamily: font, fontSize: `${cfg.subFontPx}px`, color: '#fff6dc', stroke: cfg.stroke, strokeThickness: 3 })
    .setOrigin(0.5, 1)
    .setResolution(pixelRatio * 2)
    .setDepth(1e6);
  for (const t of [big, sub]) {
    t.setScale(0.5).setAlpha(0);
    scene.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    scene.tweens.add({
      targets: t,
      y: t.y - cfg.floatPx,
      alpha: 0,
      delay: cfg.floatMs * 0.45,
      duration: cfg.floatMs * 0.55,
      ease: 'Cubic.easeIn',
      onComplete: () => t.destroy(),
    });
  }
}

// 화면 가장자리 금빛(DOM)
export function edgeGlow(color, ms) {
  const el = document.getElementById('edge-glow');
  if (!el) return;
  el.style.setProperty('--edge-color', color);
  el.style.setProperty('--edge-ms', `${ms}ms`);
  el.classList.remove('show');
  void el.offsetWidth; // 애니메이션 다시 시작
  el.classList.add('show');
}

// 숨 고르기: 몸 뒤에서 은은하게 비치는 빛 + 발밑 고리
export function breathFx(scene, x, y, height, color, ms) {
  glowRing(scene, x, y - height * 0.5, color, { w: 34, h: height * 1.2, grow: 1.35, ms, alpha: 0.6, depth: y - 0.05 });
  glowRing(scene, x, y, color, { w: 28, h: 10, grow: 2.2, ms });
}

// 휘돌려 베기 궤적: 몸 둘레 타원을 진행만큼 그어 가고, 끝나면 흐려짐
export class SpinTrail {
  constructor(scene, x, y, radius, color, width) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.r = radius;
    this.color = Phaser.Display.Color.HexStringToColor(color).color;
    this.width = width;
    this.g = scene.add.graphics().setDepth(y + 0.03).setBlendMode(Phaser.BlendModes.ADD);
  }

  // p: 0~1 진행(아래 → 왼쪽 → 위 → 오른쪽, 화면에서 시계 방향)
  draw(p) {
    const g = this.g;
    g.clear();
    const start = Math.PI / 2;
    const n = Math.max(2, Math.round(40 * p));
    for (let i = 1; i <= n; i++) {
      const a0 = start + ((i - 1) / 40) * Math.PI * 2;
      const a1 = start + (i / 40) * Math.PI * 2;
      const k = i / n; // 앞쪽(최근)일수록 진하고 굵게
      g.lineStyle(this.width * (0.35 + 0.65 * k), this.color, 0.15 + 0.75 * k);
      g.beginPath();
      g.moveTo(this.x + Math.cos(a0) * this.r, this.y + Math.sin(a0) * this.r * 0.5);
      g.lineTo(this.x + Math.cos(a1) * this.r, this.y + Math.sin(a1) * this.r * 0.5);
      g.strokePath();
    }
  }

  fadeOut(ms = 250) {
    this.scene.tweens.add({ targets: this.g, alpha: 0, duration: ms, onComplete: () => this.g.destroy() });
  }
}
