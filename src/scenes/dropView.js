// 바닥에 떨어진 전리품·엽전(2차 다듬기, docs/spec/economy.md).
// 아이콘(24px) 둘레에 밝은 크림색 테두리 + 바깥 진한 갈색 테두리(드문 것은 금색 테두리 + 반짝임),
// 위아래로 천천히 둥실, 아래에 이름 작은 글자(`쥐고기`, `3푼`), 발밑 작은 그림자.
// 쓰러진 자리에서 튀어나와 떨어지고, 사라지기 전 깜빡이며 흐려짐. 주우면 주인공 쪽으로 빨려 들며 사라짐.
import { createShadow } from './shadow.js';
import { ensureSparkleTexture } from './progressFx.js';

const FONT = '-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

// 실루엣을 둘레로 밀어 그려 테두리를 만듦(r: 캔버스 픽셀)
function stamp(ctx, src, color, r, ox, oy) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  for (const rr of [r, r * 0.66, r * 0.33]) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ctx.drawImage(c, ox + Math.cos(a) * rr, oy + Math.sin(a) * rr);
    }
  }
}

// 바닥용 아이콘 텍스처(테두리 포함)를 한 번 만들어 둠. img: 아이콘 그림, res: 맵 1픽셀당 텍스처 픽셀
// 반환: 텍스처 이름. 텍스처는 (size + 2·(borderPx + edgePx)) × res 크기
export function makeDropTexture(scene, key, img, cfg, res, rare) {
  if (scene.textures.exists(key)) return key;
  const s = Math.round(cfg.size * res);
  const b = cfg.borderPx * res;
  const e = cfg.edgePx * res;
  const pad = Math.ceil(b + e + 1);
  const icon = document.createElement('canvas');
  icon.width = s;
  icon.height = s;
  const ictx = icon.getContext('2d');
  ictx.imageSmoothingQuality = 'high';
  ictx.drawImage(img, 0, 0, s, s);
  const c = document.createElement('canvas');
  c.width = s + pad * 2;
  c.height = s + pad * 2;
  const ctx = c.getContext('2d');
  stamp(ctx, icon, cfg.edgeColor, b + e, pad, pad);
  stamp(ctx, icon, rare ? cfg.rareColor : cfg.borderColor, b, pad, pad);
  ctx.drawImage(icon, pad, pad);
  scene.textures.addCanvas(key, c);
  return key;
}

export class DropView {
  // d: GroundDrops의 한 물건, def: 아이템 정의(엽전이면 null), cfg: data/economy.json groundDrops
  // texKey: makeDropTexture로 만든 텍스처(없으면 글자 칸), res: 그 텍스처의 맵 1픽셀당 픽셀
  constructor(scene, d, def, cfg, pixelRatio, shadowCfg, texKey, res) {
    this.scene = scene;
    this.d = d;
    this.cfg = cfg;
    const s = cfg.size;
    this.rare = !!def && (cfg.rareItems || []).includes(def.id);
    this.shadow = shadowCfg ? createShadow(scene, shadowCfg, cfg.shadowWidth, cfg.shadowHeight, cfg.shadowAlpha).setPosition(d.x, d.y) : null;
    this.box = scene.add.container(d.fromX, d.fromY - 6).setDepth(d.y - 0.5);
    let icon;
    if (texKey && scene.textures.exists(texKey)) {
      const tex = scene.textures.get(texKey).getSourceImage();
      icon = scene.add.image(0, 0, texKey).setDisplaySize(tex.width / res, tex.height / res);
    } else {
      // 그림을 못 받았을 때: 글자 칸(엽전은 구멍 뚫린 동전)
      const g = scene.add.graphics();
      if (d.coins) {
        g.fillStyle(0x8a5a1a, 1).fillCircle(0, 0, s * 0.42);
        g.fillStyle(0xe6b84a, 1).fillCircle(0, 0, s * 0.36);
        g.fillStyle(0x6b4512, 1).fillRect(-s * 0.1, -s * 0.1, s * 0.2, s * 0.2);
        icon = g;
      } else {
        const label = def ? def.iconText || def.name.charAt(0) : '?';
        g.fillStyle(0x3a2814, 0.9).fillRoundedRect(-s / 2, -s / 2, s, s, 3);
        g.lineStyle(2, 0xfff3d6, 0.9).strokeRoundedRect(-s / 2, -s / 2, s, s, 3);
        const t = scene.add
          .text(0, 0, label, { fontFamily: FONT, fontSize: `${Math.round(s * (label.length > 1 ? 0.42 : 0.62))}px`, fontStyle: 'bold', color: '#f3ead6' })
          .setOrigin(0.5)
          .setResolution(pixelRatio * 2);
        icon = scene.add.container(0, 0, [g, t]);
      }
    }
    this.icon = icon;
    // 아이콘 아래 이름(엽전은 `3푼`): 보일 때 처음 만듦(setLabelVisible) — 여러 마리를 한꺼번에 쓰러뜨려
    // 겹친 물건은 이름을 하나만 보이므로, 안 보일 이름 글자까지 한꺼번에 만들지 않게(docs/spec/feedback_1022.md 10 감시)
    this.labelText = d.coins ? `${d.coins}푼` : def ? def.name : '';
    this.labelY = s / 2 + 1;
    this.pixelRatio = pixelRatio;
    this.label = null;
    this.box.add(icon);
    // 드문 것: 금색 테두리 + 은은한 반짝임
    if (this.rare) {
      this.spark = scene.add.image(s * 0.32, -s * 0.32, ensureSparkleTexture(scene)).setDisplaySize(9, 9).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.box.add(this.spark);
      scene.tweens.add({
        targets: this.spark,
        alpha: { from: 0, to: 1 },
        angle: 90,
        duration: cfg.sparkleMs * 0.3,
        yoyo: true,
        repeat: -1,
        repeatDelay: cfg.sparkleMs * 0.4,
        ease: 'Sine.easeInOut',
      });
    }
    // 튀어나와 떨어지기(살짝 튀어 오름) → 그 뒤 위아래로 둥실
    const restY = d.y - s * 0.5 - 2;
    scene.tweens.add({ targets: this.box, x: d.x, duration: 360, ease: 'Linear' });
    scene.tweens.add({
      targets: this.box,
      y: { from: d.fromY - 6, to: restY },
      duration: 360,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        if (!this.box.active) return;
        this.bob = scene.tweens.add({ targets: this.box, y: restY - cfg.bobPx, duration: cfg.bobMs / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      },
    });
  }

  setLabelVisible(v) {
    if (v && !this.label && this.box.active && !this.picked) {
      this.label = this.scene.add
        .text(0, this.labelY, this.labelText, {
          fontFamily: FONT,
          fontSize: `${this.cfg.labelFontPx}px`,
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#2a1c10',
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0)
        .setResolution(this.pixelRatio * 2);
      this.box.add(this.label);
    }
    if (this.label) this.label.setVisible(v);
  }

  update() {
    const left = (this.d.lifeMs || this.cfg.lifetimeMs) - this.d.age;
    if (left < this.cfg.fadeMs) {
      const k = left / this.cfg.fadeMs;
      this.box.setAlpha((0.35 + 0.65 * Math.abs(Math.sin(this.d.age / 120))) * Math.max(0.2, k));
      if (this.shadow) this.shadow.setAlpha(this.cfg.shadowAlpha * Math.max(0.2, k));
    }
  }

  // 주웠을 때: 주인공 쪽으로 빨려 들며 사라짐
  pickup(tx, ty) {
    this.scene.tweens.killTweensOf(this.box);
    if (this.shadow) this.shadow.destroy();
    this.picked = true;
    if (this.label) this.label.setVisible(false);
    this.scene.tweens.add({
      targets: this.box,
      x: tx,
      y: ty,
      alpha: 0,
      scale: 0.5,
      duration: 180,
      ease: 'Quad.easeIn',
      onComplete: () => this.destroy(),
    });
  }

  destroy() {
    this.scene.tweens.killTweensOf(this.box);
    if (this.spark) this.scene.tweens.killTweensOf(this.spark);
    if (this.shadow) this.shadow.destroy();
    this.box.destroy();
  }
}
