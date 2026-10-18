// 타격감 연출(docs/spec/skills_impact.md 1, 그림 없이 코드로). 값은 data/game.json impact.
// 맞는 순간: 흰 섬광 별(4갈래) + 베인 자국(칼 방향 사선, 흰 → 무기 궤적 색) — 먹 방울은 weaponFx.inkSplash.
// 쓰러뜨릴 때: 흰 연기 폭발(MonsterView.dieFly가 부름).
const hex = (c) => Phaser.Display.Color.HexStringToColor(c).color;
const TOP = 1e6 - 1; // 몬스터·주인공 위, 숫자(1e6) 아래

// 4갈래 섬광 별: 지름 size → 0으로 줄며 ms에 사라짐(가운데 둥근 빛 포함)
export function hitStar(scene, x, y, size, color, ms) {
  const g = scene.add.graphics().setDepth(TOP).setBlendMode(Phaser.BlendModes.ADD);
  const c = hex(color);
  const o = { k: 0 };
  const draw = () => {
    const r = (size / 2) * (1 - o.k * 0.85);
    const w = Math.max(1, r * 0.22);
    const a = 1 - o.k;
    g.clear();
    g.fillStyle(c, a);
    // 위아래·좌우로 긴 마름모 4갈래(가로가 조금 김)
    for (const [dx, dy, len] of [[1, 0, 1.15], [-1, 0, 1.15], [0, 1, 0.9], [0, -1, 0.9]]) {
      const tx = x + dx * r * len;
      const ty = y + dy * r * len;
      const px = -dy * w;
      const py = dx * w;
      g.fillTriangle(x + px, y + py, x - px, y - py, tx, ty);
    }
    g.fillStyle(0xffffff, a);
    g.fillCircle(x, y, w * 1.3);
  };
  draw();
  scene.tweens.add({ targets: o, k: 1, duration: ms, ease: 'Quad.easeOut', onUpdate: draw, onComplete: () => g.destroy() });
}

// 베인 자국: 몬스터 위에 칼 방향 사선 한 줄. 처음 40% 동안 길어지고(흰색) 나머지 동안 무기 색으로 가늘어지며 사라짐
export function slashMark(scene, x, y, dir, len, width, color, ms) {
  const g = scene.add.graphics().setDepth(TOP).setBlendMode(Phaser.BlendModes.ADD);
  // 바라보는 쪽에 비스듬히(옆면은 위→아래로 내려 벤 사선, 정면·뒷면은 왼쪽 위→오른쪽 아래)
  const ang = dir === 'left' ? -2.2 : dir === 'right' ? -0.95 : dir === 'up' ? 0.6 : -0.6 + Math.PI;
  const cx = Math.cos(ang);
  const cy = Math.sin(ang);
  const c = hex(color);
  const o = { k: 0 };
  const draw = () => {
    const grow = Math.min(1, o.k / 0.4);
    const fade = o.k < 0.4 ? 1 : 1 - (o.k - 0.4) / 0.6;
    const half = (len / 2) * grow;
    const w = width * (0.4 + 0.6 * fade);
    g.clear();
    g.lineStyle(w * 1.8, c, 0.7 * fade);
    g.lineBetween(x - cx * half, y - cy * half, x + cx * half, y + cy * half);
    g.lineStyle(w * 0.7, 0xffffff, fade);
    g.lineBetween(x - cx * half * 0.9, y - cy * half * 0.9, x + cx * half * 0.9, y + cy * half * 0.9);
  };
  draw();
  scene.tweens.add({ targets: o, k: 1, duration: ms, onUpdate: draw, onComplete: () => g.destroy() });
}

// 흰 연기 폭발: count방울이 사방으로 퍼지며 부풀고 흐려짐
export function smokeBurst(scene, x, y, cfg) {
  const c = hex(cfg.smokeColor);
  for (let i = 0; i < cfg.smokeCount; i++) {
    const a = (i / cfg.smokeCount) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 8 + Math.random() * 8;
    const puff = scene.add.circle(x, y, 3 + Math.random() * 2, c, 0.85).setDepth(TOP);
    scene.tweens.add({
      targets: puff,
      x: x + Math.cos(a) * dist,
      y: y + Math.sin(a) * dist * 0.6 - 4,
      scale: 2.2,
      alpha: 0,
      duration: cfg.smokeMs * (0.8 + Math.random() * 0.4),
      ease: 'Cubic.easeOut',
      onComplete: () => puff.destroy(),
    });
  }
}

// 독안개(구렁이 비늘검 hitFx "poison"): 맞힌 자리에서 작은 초록 원 5개가 퍼지며 부풀고 0.5초에 사라짐
export function poisonPuff(scene, x, y, color) {
  const c = hex(color);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.random() * 0.6;
    const dist = 6 + Math.random() * 8;
    const puff = scene.add.circle(x, y, 3 + Math.random() * 2, c, 0.6).setDepth(TOP);
    scene.tweens.add({
      targets: puff,
      x: x + Math.cos(a) * dist,
      y: y + Math.sin(a) * dist * 0.6 - 3,
      scale: 2.4,
      alpha: 0,
      duration: 500,
      ease: 'Sine.easeOut',
      onComplete: () => puff.destroy(),
    });
  }
}

