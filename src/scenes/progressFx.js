// 레벨업·숨 고르기·휘돌려 베기 연출(그림 없이 코드로).
import { ensureShadowTexture, SHADOW_TEXTURE } from './shadow.js';

const FONT = '-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

// 떠오르는 글자: holdMs 동안 그대로 보이며 떠오르고, fadeMs 동안 흐려짐
export function floatText(scene, x, y, text, { color = '#ffffff', stroke = '#000000', fontPx = 11, floatPx = 18, holdMs = 1500, fadeMs = 600 }, pixelRatio) {
  const t = scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: `${fontPx}px`, fontStyle: 'bold', color, stroke, strokeThickness: 3 })
    .setOrigin(0.5, 1)
    .setResolution(pixelRatio * 2)
    .setDepth(1e6);
  scene.tweens.add({ targets: t, y: y - floatPx, duration: holdMs + fadeMs, ease: 'Cubic.easeOut' });
  scene.tweens.add({ targets: t, alpha: 0, delay: holdMs, duration: fadeMs, onComplete: () => t.destroy() });
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
export function ensurePillarTexture(scene) {
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
export function ensureSparkleTexture(scene) {
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
