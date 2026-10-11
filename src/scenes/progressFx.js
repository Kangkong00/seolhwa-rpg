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

// 레벨업: 글자 + 발밑 빛 고리 두 번 + 몸 뒤 빛
export function levelUpFx(scene, x, y, height, level, cfg, pixelRatio) {
  floatText(scene, x, y - height - 10, `레벨 업! Lv ${level}`, { color: cfg.color, stroke: cfg.stroke, fontPx: cfg.fontPx, floatPx: cfg.floatPx, floatMs: cfg.floatMs }, pixelRatio);
  glowRing(scene, x, y, cfg.ringColor, { w: 34, h: 14, grow: 3, ms: 900 });
  scene.time.delayedCall(220, () => glowRing(scene, x, y, cfg.ringColor, { w: 30, h: 12, grow: 2.4, ms: 800 }));
  // 몸 뒤에서 비치는 빛 (몸 앞에 그리면 캐릭터가 하얗게 바래 보임)
  glowRing(scene, x, y - height * 0.5, cfg.ringColor, { w: 34, h: height * 1.2, grow: 1.4, ms: 900, alpha: 0.5, depth: y - 0.05 });
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
