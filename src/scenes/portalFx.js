// 던전 입구(맵 이동 지점) 표시: 테두리가 푸르스름하게 은은히 빛나고(밝아졌다 어두워짐),
// 가까이 가면 이름표가 뜸. 모양·이름은 맵 JSON의 portals(fx, label), 색·주기·거리는 data/game.json의 portalFx.

export class PortalFx {
  constructor(scene, portal, cfg, pixelRatio) {
    this.cfg = cfg;
    const shape = portal.fx || { shape: 'rect', x: portal.x, y: portal.y, w: portal.w, h: portal.h };
    this.center = { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 };
    const color = Phaser.Display.Color.HexStringToColor(cfg.color).color;

    // 바깥 번짐(굵고 옅게 여러 겹) + 안쪽 또렷한 선. 땅 위·캐릭터 아래에 그림
    this.glow = scene.add.graphics().setDepth(-0.8).setBlendMode(Phaser.BlendModes.ADD);
    const layers = 4;
    for (let i = layers; i >= 1; i--) {
      this.glow.lineStyle(cfg.lineWidth + (cfg.glowWidth * i) / layers, color, 0.12);
      if (shape.shape === 'ellipse') {
        this.glow.strokeEllipse(this.center.x, this.center.y, shape.w, shape.h);
      } else {
        this.glow.strokeRect(shape.x, shape.y, shape.w, shape.h);
      }
    }
    this.glow.lineStyle(cfg.lineWidth, color, 0.9);
    if (shape.shape === 'ellipse') this.glow.strokeEllipse(this.center.x, this.center.y, shape.w, shape.h);
    else this.glow.strokeRect(shape.x, shape.y, shape.w, shape.h);

    this.glow.setAlpha(cfg.alphaMin);
    scene.tweens.add({
      targets: this.glow,
      alpha: cfg.alphaMax,
      duration: cfg.periodMs / 2,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 이름표
    this.label = null;
    if (portal.label) {
      this.label = scene.add
        .text(this.center.x, shape.y - cfg.labelOffsetY, portal.label, {
          fontFamily: '-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
          fontSize: `${cfg.labelFontPx}px`,
          color: cfg.labelColor,
          backgroundColor: cfg.labelBackground,
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0.5, 1)
        .setResolution(pixelRatio * 2)
        .setDepth(1e6)
        .setAlpha(0);
      // 레벨 안내(뒷산 오솔길 굴 입구: portal.hint "레벨 30~") — 이름표 아래 작은 글씨, 막지는 않음
      if (portal.hint) {
        this.hint = scene.add
          .text(this.center.x, shape.y - cfg.labelOffsetY + 1, portal.hint, {
            fontFamily: '-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
            fontSize: `${Math.max(8, cfg.labelFontPx - 3)}px`,
            color: '#ffd98a',
            backgroundColor: cfg.labelBackground,
            padding: { x: 4, y: 1 },
          })
          .setOrigin(0.5, 0)
          .setResolution(pixelRatio * 2)
          .setDepth(1e6)
          .setAlpha(0);
      }
    }
    this.labelShown = false;
    this.scene = scene;
  }

  // 잠긴 출구(쥐왕을 쓰러뜨려야 열림)는 열리기 전엔 보이지 않음
  setVisible(v) {
    this.visible = v;
    this.glow.setVisible(v);
    if (!v && this.label) this.label.setAlpha(0);
    if (!v && this.hint) this.hint.setAlpha(0);
    if (!v) this.labelShown = false;
  }

  // 주인공 발 위치로 이름표를 보였다 숨김
  update(px, py) {
    if (!this.label || this.visible === false) return;
    const near = Math.hypot(px - this.center.x, py - this.center.y) <= this.cfg.labelDistance;
    if (near === this.labelShown) return;
    this.labelShown = near;
    const targets = this.hint ? [this.label, this.hint] : this.label;
    this.scene.tweens.killTweensOf(targets);
    this.scene.tweens.add({ targets, alpha: near ? 1 : 0, duration: 200 });
  }
}
