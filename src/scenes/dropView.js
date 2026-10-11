// 바닥에 떨어진 전리품·엽전 그림. 아이콘 그림이 있으면 그것을, 없으면 iconText 글자 칸, 엽전은 구멍 뚫린 동전.
// 쓰러진 자리에서 튀어나와 떨어지고, 사라지기 전 깜빡이며 흐려짐. 주우면 주인공 쪽으로 빨려 들며 사라짐.

const FONT = '-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

export class DropView {
  // d: GroundDrops의 한 물건, def: 아이템 정의(엽전이면 null), cfg: data/economy.json groundDrops
  constructor(scene, d, def, cfg, pixelRatio) {
    this.scene = scene;
    this.d = d;
    this.cfg = cfg;
    const s = cfg.size;
    const iconKey = def && `icon:${def.id}`;
    if (d.coins) {
      const g = scene.add.graphics();
      g.fillStyle(0x8a5a1a, 1).fillCircle(0, 0, s * 0.42);
      g.fillStyle(0xe6b84a, 1).fillCircle(0, 0, s * 0.36);
      g.fillStyle(0x6b4512, 1).fillRect(-s * 0.1, -s * 0.1, s * 0.2, s * 0.2);
      this.obj = g;
    } else if (iconKey && scene.textures.exists(iconKey)) {
      this.obj = scene.add.image(0, 0, iconKey).setDisplaySize(s, s);
    } else {
      const c = scene.add.container(0, 0);
      const label = def ? def.iconText || def.name.charAt(0) : '?';
      const g = scene.add.graphics();
      g.fillStyle(0x3a2814, 0.9).fillRoundedRect(-s / 2, -s / 2, s, s, 2);
      g.lineStyle(1, 0xf3ead6, 0.6).strokeRoundedRect(-s / 2, -s / 2, s, s, 2);
      const t = scene.add
        .text(0, 0, label, { fontFamily: FONT, fontSize: `${Math.round(s * (label.length > 1 ? 0.42 : 0.62))}px`, fontStyle: 'bold', color: '#f3ead6' })
        .setOrigin(0.5)
        .setResolution(pixelRatio * 2);
      c.add([g, t]);
      this.obj = c;
    }
    this.obj.setPosition(d.fromX, d.fromY - 6).setDepth(d.y - 0.5);
    // 튀어나와 떨어지기
    scene.tweens.add({ targets: this.obj, x: d.x, duration: 320, ease: 'Linear' });
    scene.tweens.add({
      targets: this.obj,
      y: { from: d.fromY - 6, to: d.y - s * 0.4 },
      duration: 320,
      ease: 'Bounce.easeOut',
    });
  }

  update() {
    const left = this.cfg.lifetimeMs - this.d.age;
    if (left < this.cfg.fadeMs) {
      const k = left / this.cfg.fadeMs;
      this.obj.setAlpha((0.35 + 0.65 * Math.abs(Math.sin(this.d.age / 120))) * Math.max(0.2, k));
    }
  }

  // 주웠을 때: 주인공 쪽으로 빨려 들며 사라짐
  pickup(tx, ty) {
    this.scene.tweens.killTweensOf(this.obj);
    this.scene.tweens.add({
      targets: this.obj,
      x: tx,
      y: ty,
      alpha: 0,
      scale: 0.5,
      duration: 180,
      ease: 'Quad.easeIn',
      onComplete: () => this.obj.destroy(),
    });
  }

  destroy() {
    this.scene.tweens.killTweensOf(this.obj);
    this.obj.destroy();
  }
}
