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

// ---------- 무기 고유 연출(docs/spec/tier4_9.md 4, weapon_list.md) ----------
const rnd = (a, b) => a + Math.random() * (b - a);

// 작은 별(4갈래) 한 개를 그리는 그림
function starDot(scene, x, y, size, color, ms, depth = TOP) {
  const g = scene.add.graphics().setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
  const c = hex(color);
  const draw = (k) => {
    g.clear();
    const r = size * (1 - k * 0.6);
    g.fillStyle(c, 1 - k);
    g.fillTriangle(x - r * 0.25, y, x + r * 0.25, y, x, y - r);
    g.fillTriangle(x - r * 0.25, y, x + r * 0.25, y, x, y + r);
    g.fillTriangle(x, y - r * 0.25, x, y + r * 0.25, x - r, y);
    g.fillTriangle(x, y - r * 0.25, x, y + r * 0.25, x + r, y);
    g.fillStyle(0xffffff, 1 - k);
    g.fillCircle(x, y, r * 0.22);
  };
  const o = { k: 0 };
  draw(0);
  scene.tweens.add({ targets: o, k: 1, duration: ms, onUpdate: () => draw(o.k), onComplete: () => g.destroy() });
}

// 휘두를 때 칼끝을 따라 뿌리는 알갱이 하나(kind: cloud·petal·flame·dust·star)
export function trailParticle(scene, x, y, kind, color) {
  if (kind === 'star') {
    starDot(scene, x + rnd(-3, 3), y + rnd(-3, 3), rnd(3, 5), Math.random() < 0.5 ? '#ffffff' : '#9fc4ff', 420);
    return;
  }
  const spec = {
    cloud: { c: '#ffffff', r: [3, 5], a: 0.55, ms: 600, dy: -8, grow: 2.2, add: false },
    petal: { c: '#ffc4dc', r: [2, 3], a: 0.9, ms: 800, dy: 12, grow: 1, add: false },
    flame: { c: color || '#58a8ff', r: [2, 3.5], a: 0.85, ms: 360, dy: -14, grow: 0.4, add: true },
    dust: { c: '#b49a72', r: [2.5, 4], a: 0.6, ms: 520, dy: -4, grow: 2, add: false },
  }[kind];
  if (!spec) return;
  const dot = kind === 'petal'
    ? scene.add.ellipse(x, y, rnd(...spec.r) * 2, rnd(...spec.r), hex(spec.c), spec.a).setAngle(rnd(0, 180))
    : scene.add.circle(x, y, rnd(...spec.r), hex(spec.c), spec.a);
  dot.setDepth(TOP - 1);
  if (spec.add) dot.setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: dot,
    x: x + rnd(-10, 10),
    y: y + spec.dy + rnd(-4, 4),
    scale: spec.grow,
    angle: kind === 'petal' ? dot.angle + rnd(90, 270) : 0,
    alpha: 0,
    duration: spec.ms * rnd(0.8, 1.2),
    ease: 'Sine.easeOut',
    onComplete: () => dot.destroy(),
  });
}

// 칠성검: 궤적을 따라 별 일곱 개가 차례로 빛남(i번째 별)
export function sevenStar(scene, x, y) {
  starDot(scene, x, y, 7, '#ffe680', 650);
}

// 줄 3개(할퀸 자국·발톱): 비스듬히 나란한 줄
function clawLines(scene, x, y, color, width, len, ms) {
  const g = scene.add.graphics().setDepth(TOP).setBlendMode(Phaser.BlendModes.ADD);
  const c = hex(color);
  const o = { k: 0 };
  const draw = () => {
    g.clear();
    const grow = Math.min(1, o.k / 0.35);
    const fade = o.k < 0.35 ? 1 : 1 - (o.k - 0.35) / 0.65;
    for (let i = -1; i <= 1; i++) {
      const ox = i * width * 2.4;
      g.lineStyle(width * fade, c, fade);
      g.lineBetween(x + ox - len * 0.35, y - len * 0.5, x + ox - len * 0.35 + len * 0.7 * grow, y - len * 0.5 + len * grow);
    }
  };
  draw();
  scene.tweens.add({ targets: o, k: 1, duration: ms, onUpdate: draw, onComplete: () => g.destroy() });
}

// 맞힌 자리의 무기 고유 연출(hitFx). k = 무기 구간 크기 배율. 반환 없음(소리·흔들림은 여기서)
export function weaponHitFx(scene, kind, x, y, dir, color, k = 1) {
  switch (kind) {
    case 'poison':
      poisonPuff(scene, x, y, color);
      break;
    case 'sparks':
      // 쇠 불꽃: 주황·흰 짧은 선이 사방으로
      for (let i = 0; i < 9; i++) {
        const a = rnd(0, Math.PI * 2);
        const d = rnd(10, 22) * k;
        const ln = scene.add.line(0, 0, x, y, x + Math.cos(a) * 4, y + Math.sin(a) * 4, i % 3 ? 0xffb347 : 0xffffff, 1).setOrigin(0, 0).setLineWidth(1.5).setDepth(TOP).setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({ targets: ln, x: Math.cos(a) * d, y: Math.sin(a) * d + 4, alpha: 0, duration: rnd(200, 320), ease: 'Quad.easeOut', onComplete: () => ln.destroy() });
      }
      break;
    case 'claw3':
      clawLines(scene, x, y, color, 2.2 * k, 22 * k, 320);
      break;
    case 'goldClaw':
      clawLines(scene, x, y, '#ffd34d', 3 * k, 28 * k, 380);
      break;
    case 'tigerClaw':
      clawLines(scene, x, y, '#ffb347', 3.4 * k, 32 * k, 420);
      if (scene.sfx) scene.sfx.play('roar');
      break;
    case 'foxfire':
      for (let i = 0; i < 6; i++) {
        const a = rnd(0, Math.PI * 2);
        const f = scene.add.circle(x, y, rnd(2.5, 4) * k, hex(color || '#58a8ff'), 0.9).setDepth(TOP).setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({ targets: f, x: x + Math.cos(a) * rnd(12, 22) * k, y: y + Math.sin(a) * rnd(8, 16) * k - 8, scale: 0.3, alpha: 0, duration: rnd(350, 520), ease: 'Sine.easeOut', onComplete: () => f.destroy() });
      }
      break;
    case 'crack': {
      // 맞은 자리 아래 땅에 작은 금
      const g = scene.add.graphics().setDepth(-0.8);
      const gy = y + 18;
      g.lineStyle(2.5, 0x3a2a18, 0.9);
      g.beginPath();
      g.moveTo(x - 16 * k, gy);
      for (let i = 1; i <= 6; i++) g.lineTo(x - 16 * k + (32 * k * i) / 6, gy + (i % 2 ? -3 : 3));
      g.strokePath();
      scene.tweens.add({ targets: g, alpha: 0, delay: 500, duration: 600, onComplete: () => g.destroy() });
      smokeBurst(scene, x, gy, { smokeColor: '#b49a72', smokeCount: 5, smokeMs: 420 });
      break;
    }
    case 'bigShake':
      scene.cameras.main.shake(200, 0.009);
      smokeBurst(scene, x, y + 14, { smokeColor: '#b49a72', smokeCount: 6, smokeMs: 420 });
      break;
    case 'starBurst': {
      const g = scene.add.graphics().setDepth(TOP).setBlendMode(Phaser.BlendModes.ADD);
      const o = { k: 0 };
      scene.tweens.add({
        targets: o,
        k: 1,
        duration: 420,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          g.clear();
          g.lineStyle(4 * (1 - o.k) + 1, 0xffe680, 1 - o.k);
          g.strokeCircle(x, y, 6 + 26 * k * o.k);
        },
        onComplete: () => g.destroy(),
      });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        starDot(scene, x + Math.cos(a) * 18 * k, y + Math.sin(a) * 14 * k, 5, i % 2 ? '#ffffff' : '#ffe680', 520);
      }
      break;
    }
    default:
      break;
  }
}

