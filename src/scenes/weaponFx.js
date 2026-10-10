// 무기 휘두르기 연출: 붓으로 그은 먹선 궤적, 맞은 자리의 먹 튐.
// 모양·시간은 data/game.json의 swingFx, 색은 data/weapons.json의 무기별 trailColor.

// 먹선: 칼끝이 지나간 자리에 반달 획. 획 시작은 굵고 끝은 가늘게(칼 길이에 대한 비율).
// geometryAt(sweep) → { grip, tip } 을 받아, 지금까지 돈 만큼 그리고, 다 돌면 번지며 사라짐.
export class InkTrail {
  constructor(scene, color, fx, depth) {
    this.scene = scene;
    this.fx = fx;
    this.color = Phaser.Display.Color.HexStringToColor(color).color;
    this.g = scene.add.graphics().setDepth(depth);
    this.fading = false;
  }

  draw(geometryAt, upTo) {
    const g = this.g;
    const fx = this.fx;
    g.clear();
    const n = 18;
    const outer = [];
    const inner = [];
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * upTo;
      const { grip, tip } = geometryAt(s);
      // 획 굵기: 처음(s=0)은 굵게, 끝(s=1)은 가늘게
      const w = fx.trailWidthStart + (fx.trailWidthEnd - fx.trailWidthStart) * s;
      outer.push({ x: tip.x, y: tip.y });
      inner.push({ x: tip.x + (grip.x - tip.x) * w, y: tip.y + (grip.y - tip.y) * w });
    }
    if (outer.length < 2) return;
    const poly = outer.concat(inner.reverse());
    // 번진 바깥 먹(옅고 조금 넓게) + 진한 가운데 먹
    g.lineStyle(3, this.color, fx.trailAlpha * 0.25);
    g.strokePoints(poly, true);
    g.fillStyle(this.color, fx.trailAlpha * 0.3);
    g.fillPoints(poly, true);
    const core = outer.map((p, i) => {
      const q = inner[inner.length - 1 - i];
      return { x: p.x + (q.x - p.x) * 0.15, y: p.y + (q.y - p.y) * 0.15 };
    });
    const coreInner = outer.map((p, i) => {
      const q = inner[inner.length - 1 - i];
      return { x: p.x + (q.x - p.x) * 0.7, y: p.y + (q.y - p.y) * 0.7 };
    });
    g.fillStyle(this.color, fx.trailAlpha);
    g.fillPoints(core.concat(coreInner.reverse()), true);
  }

  // 다 그은 뒤: 먹이 번지듯 살짝 퍼지며 흐려짐
  fadeOut() {
    if (this.fading) return;
    this.fading = true;
    this.scene.tweens.add({
      targets: this.g,
      alpha: 0,
      duration: this.fx.trailMs,
      ease: 'Quad.easeIn',
      onComplete: () => this.g.destroy(),
    });
  }
}

// 맞은 자리의 작은 먹 튐: 먹 방울 몇 개가 바깥으로 튀며 사라짐
export function inkSplash(scene, x, y, color, fx, dirX, dirY) {
  const c = Phaser.Display.Color.HexStringToColor(color).color;
  for (let i = 0; i < fx.splashCount; i++) {
    // 맞은 방향 쪽으로 더 많이 튐
    const a = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * 2.2;
    const dist = 6 + Math.random() * 10;
    const r = fx.splashSize * (0.5 + Math.random() * 0.8);
    const dot = scene.add.circle(x, y, r, c, 0.9).setDepth(1e6 - 1);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(a) * dist,
      y: y + Math.sin(a) * dist,
      alpha: 0,
      scale: 0.4,
      duration: fx.splashMs * (0.7 + Math.random() * 0.5),
      ease: 'Cubic.easeOut',
      onComplete: () => dot.destroy(),
    });
  }
  // 가운데 번진 먹 한 점
  const blot = scene.add.circle(x, y, fx.splashSize * 2.2, c, 0.55).setDepth(1e6 - 1);
  scene.tweens.add({ targets: blot, scale: 1.6, alpha: 0, duration: fx.splashMs, onComplete: () => blot.destroy() });
}
