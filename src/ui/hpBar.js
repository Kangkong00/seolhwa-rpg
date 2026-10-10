// 머리 위 작은 체력바. 모양은 data/game.json의 hpBar.
export class HpBar {
  constructor(scene, cfg, color) {
    this.cfg = cfg;
    this.color = Phaser.Display.Color.HexStringToColor(color).color;
    this.back = Phaser.Display.Color.HexStringToColor(cfg.backColor).color;
    this.g = scene.add.graphics().setDepth(9e5);
  }

  // x, y: 막대 가운데 아래쪽(머리 위)
  set(x, y, ratio, visible = true) {
    const g = this.g;
    g.clear();
    if (!visible) return;
    const { width: w, height: h } = this.cfg;
    const left = x - w / 2;
    const top = y - h;
    g.fillStyle(this.back, 0.75);
    g.fillRect(left - 1, top - 1, w + 2, h + 2);
    g.fillStyle(this.color, 1);
    g.fillRect(left, top, w * Math.max(0, Math.min(1, ratio)), h);
  }

  destroy() {
    this.g.destroy();
  }
}
