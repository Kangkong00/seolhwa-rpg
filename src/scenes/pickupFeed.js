// 줍기 알림(2차 다듬기): 머리 위에 `쥐고기 +1`, `3푼`. 새 알림이 아래에 생기고 예전 것은 위로 쌓임(겹치지 않게).
// 같은 물건을 그대로 보이는 동안 또 주우면 한 줄로 합쳐 `쥐고기 +3`. holdMs 동안 그대로, fadeMs 동안 흐려짐.
const FONT = '-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

export class PickupFeed {
  // cfg: data/economy.json textFx
  constructor(scene, cfg, pixelRatio) {
    this.scene = scene;
    this.cfg = cfg;
    this.pr = pixelRatio;
    this.lines = []; // { key, label(n) → 글자, n, age, text } — 앞쪽이 새것
  }

  // key: 같은 것끼리 합칠 이름, n: 이번에 늘어난 양, label(n): 합친 양으로 만드는 글자, style: 색
  add(key, n, label, style) {
    const hold = this.cfg.pickupHoldMs;
    const same = this.lines.find((l) => l.key === key && l.age < hold);
    if (same) {
      same.n += n;
      same.age = 0;
      same.text.setText(label(same.n)).setAlpha(1);
      // 맨 아래(새것 자리)로
      this.lines.splice(this.lines.indexOf(same), 1);
      this.lines.unshift(same);
      return;
    }
    const text = this.scene.add
      .text(0, 0, label(n), { fontFamily: FONT, fontSize: `${this.cfg.pickupFontPx}px`, fontStyle: 'bold', color: style.color, stroke: style.stroke, strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setResolution(this.pr * 2)
      .setDepth(1e6);
    this.lines.unshift({ key, n, age: 0, text, label });
  }

  // x, y: 첫 줄 자리(머리 위). 매 프레임 주인공을 따라감
  update(dt, x, y) {
    const { pickupHoldMs: hold, pickupFadeMs: fade, pickupLineH: lh } = this.cfg;
    this.lines = this.lines.filter((l) => {
      l.age += dt;
      if (l.age >= hold + fade) {
        l.text.destroy();
        return false;
      }
      return true;
    });
    this.lines.forEach((l, i) => {
      const k = l.age > hold ? 1 - (l.age - hold) / fade : 1;
      // 처음 0.2초 동안 살짝 떠오르며 나타남
      const rise = Math.min(1, l.age / 200);
      l.text.setPosition(x, y - i * lh - 4 * rise).setAlpha(k);
    });
  }

  destroy() {
    for (const l of this.lines) l.text.destroy();
    this.lines = [];
  }
}
