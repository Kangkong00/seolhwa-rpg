// 무예 효과 그림 붙이기(docs/spec/feedback_1022.md 9). 그림 12장(assets/fx)을 fxSprite로 더하기 섞기.
// 지금 도형 연출은 그대로 두고 그림을 함께 겹쳐 그림. 크기(px)·시간은 data/game.json fxImages.art.
// 그림 방향: 초승달 열린 쪽 = 오른쪽, 땅 갈라짐 = 위로 뻗음, 검풍 앞 = 왼쪽, 번개 = 위 → 아래, 빛줄기 앞 = 오른쪽,
// 호랑이 = 오른쪽으로 달려듦. 그림이 없으면 아무것도 안 그림(도형 연출만).
import { fxSprite, hasFx } from './fxSprite.js';

const ANGLE = { right: 0, down: 90, left: 180, up: -90 };
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const art = (scene) => (scene.d.game.fxImages && scene.d.game.fxImages.art) || {};

// 초승달 베기: 열린 쪽을 칼 방향으로, 0.6→1.3배로 커지며 60° 돌고 흐려짐. flip: 뒤집어(삼연참 번갈아)
export function artCrescent(scene, x, y, facing, size, { flip = false, ms } = {}) {
  const a = art(scene).crescent || {};
  const r = ANGLE[facing] ?? 0;
  const turn = flip ? -60 : 60;
  return fxSprite(scene, 'fx_slash_crescent', x, y, {
    size, scale: 0.6, rot: r - turn / 2, flipY: flip, ms: ms ?? a.ms ?? 220,
    to: { scale: 1.3, rot: r + turn / 2, alpha: 0 },
  });
}

// 세 줄 자국: 0.12초에 늘어나며 나타났다 0.3초 남고 흐려짐
export function artTriple(scene, x, y, facing, size) {
  // 왼쪽은 돌리지 않고 좌우 뒤집기(뒤집혀 보이지 않게)
  const r = facing === 'left' ? 0 : ANGLE[facing] ?? 0;
  return fxSprite(scene, 'fx_slash_triple', x, y, {
    size, stretch: 0.3, rot: r, flipX: facing === 'left', ms: 120, to: { stretch: 1 }, holdMs: 300, fadeMs: 180,
  });
}

// 땅 갈라짐: 바라보는 쪽으로 눕혀(세로 0.6배) 시작점에서 길이 방향으로 0→1 늘어나고 0.5초 남음
export function artEarthCrack(scene, x, y, facing, length) {
  const tex = hasFx(scene, 'fx_earth_crack') ? scene.textures.get('fx:fx_earth_crack').getSourceImage() : null;
  if (!tex) return null;
  // 그림은 위로 뻗음 → 바라보는 쪽으로 돌림. 화면 세로로 0.6배 눌러 땅에 눕힘(옆이면 그림의 가로, 위아래면 그림의 세로)
  const rot = (ANGLE[facing] ?? 0) + 90;
  const side = facing === 'left' || facing === 'right';
  const unit = length / tex.height;
  return fxSprite(scene, 'fx_earth_crack', x, y, {
    scale: unit, originY: 1, rot,
    sx: side ? 0.6 : 1, sy: 0.01,
    ms: 300, ease: 'Quad.easeOut', to: { sy: side ? 1 : 0.6 }, holdMs: 500, fadeMs: 250,
  });
}

// 검풍: 날아가는 방향으로 돌린 반달 검기(앞 = 왼쪽). keep — 부른 쪽이 움직이고 지움
export function artWindCrescent(scene, x, y, facing, size) {
  return fxSprite(scene, 'fx_wind_crescent', x, y, { size, rot: (ANGLE[facing] ?? 0) + 180, alpha: 0.95, keep: true });
}

// 회오리: 주인공 발밑에 붙여 좌우를 번갈아 뒤집고 위아래로 살짝 늘었다 줄었다(부른 쪽이 update로 움직임)
export class ArtWhirl {
  constructor(scene, radius) {
    this.scene = scene;
    this.img = fxSprite(scene, 'fx_whirl_ring', scene.pos.x, scene.pos.y, { size: radius * 2.1, originY: 0.92, alpha: 0.85, keep: true });
    this.t = 0;
  }

  update(pos, dt, turnMs) {
    if (!this.img) return;
    this.t += dt;
    this.img.setPosition(pos.x, pos.y + 4);
    this.img.setFlipX(Math.floor(this.t / Math.max(60, turnMs / 2)) % 2 === 1);
    const base = this.base ?? (this.base = this.img.scaleY);
    this.img.scaleY = base * (1 + 0.08 * Math.sin(this.t / 70));
    this.img.setDepth(pos.y + 0.5);
  }

  fadeOut() {
    const img = this.img;
    this.img = null;
    if (img) this.scene.tweens.add({ targets: img, alpha: 0, duration: 220, onComplete: () => img.destroy() });
  }
}

// 번개: 아래 끝을 몬스터 발에 맞추고 0.05초에 위에서 내리꽂힘 → 2번 깜빡이고 0.25초에 사라짐
export function artLightning(scene, x, y, height) {
  const img = fxSprite(scene, 'fx_lightning', x, y + 2, { size: height, originY: 1, sy: 0.05, keep: true });
  if (!img) return null;
  const full = img.scaleX;
  scene.tweens.add({
    targets: img,
    scaleY: full,
    duration: 50,
    onComplete: () => {
      scene.tweens.add({ targets: img, alpha: 0.35, duration: 40, yoyo: true, repeat: 1 });
      scene.tweens.add({ targets: img, alpha: 0, delay: 170, duration: 250, onComplete: () => img.destroy() });
    },
  });
  return img;
}

// 충격파 고리: 0.3→1.6배로 퍼지며 흐려짐(0.4초), 두 장을 0.1초 차이로
export function artShockRing(scene, x, y, size) {
  const one = () => fxSprite(scene, 'fx_shock_ring', x, y, { size, scale: 0.3, ms: 400, to: { scale: 1.6 } });
  one();
  scene.time.delayedCall(100, one);
}

// 지나간 길 빛줄기(앞 = 오른쪽): 시작 → 끝까지 길게 늘여 깔고 0.3초에 흐려짐
export function artDashStreak(scene, from, to, thick, ms = 300) {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  if (len < 4 || !hasFx(scene, 'fx_dash_streak')) return null;
  const tex = scene.textures.get('fx:fx_dash_streak').getSourceImage();
  const rot = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  return fxSprite(scene, 'fx_dash_streak', (from.x + to.x) / 2, (from.y + to.y) / 2 - 14, {
    scale: thick / tex.height, sx: len / tex.width / (thick / tex.height), rot, ms,
  });
}

// 흰 호랑이: 출발점에서 진행 방향으로 날아가며 커졌다 흐려짐(0.35초). 왼쪽이면 좌우 뒤집기, 위아래는 돌림
export function artTiger(scene, x, y, facing, size, distance) {
  const [dx, dy] = DIRV[facing];
  const side = facing === 'left' || facing === 'right';
  return fxSprite(scene, 'fx_tiger_spirit', x, y - 20, {
    size, scale: 0.8, flipX: facing === 'left', rot: side ? 0 : facing === 'up' ? -90 : 90, alpha: 0.95, ms: 350,
    to: { scale: 1.25, x: x + dx * distance, y: y - 20 + dy * distance, alpha: 0 },
  });
}

// 별빛: 가운데에서 터짐(from→to배, ms)
export function artStarBurst(scene, x, y, size, from = 0.5, to = 1.2, ms = 300) {
  return fxSprite(scene, 'fx_star_burst', x, y, { size, scale: from, ms, to: { scale: to } });
}

// 금빛 막: 주인공 앞(몸 가운데)에 반투명. keep — 부른 쪽이 움직이고 지움. flash(): 막는 순간 1.2배로 번쩍
export class ArtShield {
  constructor(scene, size) {
    this.scene = scene;
    this.img = fxSprite(scene, 'fx_gold_shield', scene.pos.x, scene.pos.y - 24, { size, alpha: 0.7, keep: true });
  }

  update(pos, facing) {
    if (!this.img) return;
    const [dx, dy] = DIRV[facing];
    this.img.setPosition(pos.x + dx * 16, pos.y - 24 + dy * 8);
    this.img.setDepth(facing === 'up' ? pos.y - 1 : pos.y + 1);
  }

  flash() {
    const img = this.img;
    this.img = null;
    if (!img) return;
    img.setAlpha(1);
    this.scene.tweens.add({ targets: img, scaleX: img.scaleX * 1.2, scaleY: img.scaleY * 1.2, alpha: 0, duration: 260, onComplete: () => img.destroy() });
  }

  destroy() {
    const img = this.img;
    this.img = null;
    if (img) this.scene.tweens.add({ targets: img, alpha: 0, duration: 150, onComplete: () => img.destroy() });
  }
}

// 치유 기운: 발밑에서 위로 감겨 올라감(세로 늘어남) 1초, 두 장을 좌우 뒤집어 겹침
export function artHeal(scene, getPos, height) {
  for (const flip of [false, true]) {
    const p = getPos();
    const img = fxSprite(scene, 'fx_heal_swirl', p.x, p.y + 4, { size: height, originY: 1, sy: 0.3, flipX: flip, alpha: 0.9, ms: 1000, ease: 'Sine.easeOut', to: { sy: 1, alpha: 0 } });
    if (img && flip) img.setAlpha(0.6);
  }
}
