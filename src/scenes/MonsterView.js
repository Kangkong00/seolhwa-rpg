// 몬스터 그림 표시: 서 있기 ↔ 걷기 자세 번갈아(다리 반전 없음), 오른쪽은 side 좌우 반전, 발밑 그림자, 머리 위 체력바.
// 물기: 그림 없이 코드로 — 바라보는 쪽으로 빠르게 튀어나갔다 돌아옴 + step 그림.
import { loadImage, downscale } from './characterFrames.js';
import { createMonsterShadow } from './shadow.js';
import { HpBar } from '../ui/hpBar.js';
import { smokeBurst } from './impactFx.js';

const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const FILES = ['front', 'front_step', 'back', 'back_step', 'side', 'side_step'];
const loaded = new Map();

// 몬스터 종류별 그림을 한 번만 불러와 화면 크기에 맞게 줄여 텍스처로 등록
// outlineFor(texScale) → 외곽선 설정(없으면 null)
export function loadMonsterTextures(scene, def, canvasSpec, pixelScale, outlineFor = () => null) {
  const key = `${def.id}@${pixelScale}`;
  if (!loaded.has(key)) {
    const p = Promise.all(FILES.map((f) => loadImage(`${def.folder}/${f}.png`))).then((imgs) => {
      const scale = Math.min(1, (def.height * pixelScale * 1.25) / canvasSpec.standHeight);
      const keys = {};
      FILES.forEach((f, i) => {
        const img = imgs[i] || imgs[FILES.indexOf(f.replace('_step', ''))] || imgs[0];
        const tk = `mon:${def.id}/${f}`;
        if (scene.textures.exists(tk)) scene.textures.remove(tk);
        scene.textures.addCanvas(tk, downscale(img, scale, outlineFor(scale)));
        keys[f] = tk;
      });
      return { keys, scale };
    });
    loaded.set(key, p);
  }
  return loaded.get(key);
}

export class MonsterView {
  constructor(scene, def, canvasSpec, textures, shadowCfg, hpBarCfg) {
    this.def = def;
    this.textures = textures;
    this.walkTime = 0;
    this.sprite = scene.add.image(0, 0, textures.keys.front);
    this.sprite.setOrigin(0.5, canvasSpec.footY / canvasSpec.height);
    this.sprite.setScale(def.height / canvasSpec.standHeight / textures.scale);
    this.baseScale = this.sprite.scaleX;
    // 물들임(굴 들쥐: 들쥐 그림을 어둡게)
    this.tint = def.tint ? Phaser.Display.Color.HexStringToColor(def.tint).color : null;
    this.clearFlash();
    this.shadow = createMonsterShadow(scene, shadowCfg, def.height);
    this.hpBarCfg = hpBarCfg;
    this.hpBar = new HpBar(scene, hpBarCfg, hpBarCfg.monsterColor);
  }

  update(dtMs, m) {
    const base = m.facing === 'up' ? 'back' : m.facing === 'down' ? 'front' : 'side';
    let step = false;
    // 무는 중: 앞으로 튀어나갔다(사인 곡선) 돌아옴
    let ox = 0;
    let oy = 0;
    if (m.biteMs > 0) {
      const t = 1 - m.biteMs / this.def.biteMs;
      const k = Math.sin(Math.PI * Math.max(0, Math.min(1, t))) * this.def.lungePx;
      ox = DIR[m.facing][0] * k;
      oy = DIR[m.facing][1] * k;
      step = true;
    } else if (m.moving) {
      this.walkTime += dtMs;
      step = Math.floor(this.walkTime / this.def.walkFrameMs) % 2 === 0;
    } else {
      this.walkTime = 0;
    }
    // 레벨업 충격파 등으로 밀려나 보이기(그림만, 실제 위치는 그대로)
    if (this.push) {
      this.push.t += dtMs;
      const k = Math.min(1, this.push.t / this.push.ms);
      const e = Math.sin(Math.PI * k) * (1 - k * 0.3);
      ox += this.push.dx * e;
      oy += this.push.dy * e;
      if (k >= 1) this.push = null;
    }
    // 돌진 예고(쥐왕): 웅크림 — 납작해지고 옆으로 퍼지며 부르르 떪. 돌진 중엔 걷기 그림
    let sx = 1;
    let sy = 1;
    if (m.chargeState === 'windup') {
      const k = 1 - Math.max(0, m.chargeMs) / this.def.charge.windupMs;
      sy = 1 - 0.18 * k;
      sx = 1 + 0.1 * k;
      ox += Math.sin(m.chargeMs / 18) * 1.2 * k;
    } else if (m.chargeState === 'dash') {
      step = true;
    }
    // 맞아서 찌그러짐(가로로 퍼지고 세로로 눌렸다 돌아옴)
    if (this.squashing) {
      const q = this.squashing;
      q.t += dtMs;
      const k = Math.max(0, 1 - q.t / q.ms);
      sx *= 1 + (q.sx - 1) * k;
      sy *= 1 + (q.sy - 1) * k;
      if (k <= 0) this.squashing = null;
    }
    if (!this.dead) this.sprite.setScale(this.baseScale * sx, this.baseScale * sy);
    const key = this.textures.keys[step ? `${base}_step` : base];
    if (this.sprite.texture.key !== key) this.sprite.setTexture(key);
    this.sprite.setFlipX(m.facing === 'right');
    this.sprite.setPosition(m.x + ox, m.y + oy);
    this.sprite.setDepth(m.y);
    this.shadow.setPosition(m.x + ox, m.y + oy);
    const showBar = this.hpBarCfg.monsterShowAlways || m.hp < m.maxHp || m.aggro;
    this.hpBar.set(m.x, m.y - this.def.height - this.hpBarCfg.gap, m.hp / m.maxHp, showBar);
  }

  // 그림만 (dx, dy)만큼 밀렸다가 돌아옴
  nudge(dx, dy, ms) {
    this.push = { dx, dy, ms, t: 0 };
  }

  // 번쩍 끝: 원래 색(물들임이 있으면 그 색)으로
  clearFlash() {
    this.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    if (this.tint !== null) this.sprite.setTint(this.tint);
  }

  // 맞았을 때: 하얗게 번쩍
  flash(ms) {
    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.sprite.scene.time.delayedCall(ms, () => {
      if (this.sprite.active) this.clearFlash();
    });
  }

  // 맞았을 때 몸이 살짝 찌그러졌다 돌아옴(ms 동안). 바로 한 번 그려 둠(맞는 순간 멈춤 동안에도 보이게)
  squash(ms, sx, sy) {
    if (this.dead) return;
    this.squashing = { t: 0, ms, sx, sy };
    this.sprite.setScale(this.baseScale * sx, this.baseScale * sy);
  }

  // 쓰러뜨림(docs/spec/skills_impact.md 1): 하얗게 번쩍 → 맞은 방향으로 flyPx 튕겨 날아가며 조금 돌고 → 흰 연기 폭발 후 사라짐
  dieFly(dir, k, flashMs) {
    this.dead = true;
    this.hpBar.set(0, 0, 0, false);
    this.flash(flashMs);
    const scene = this.sprite.scene;
    const s = this.sprite;
    const lift = s.displayHeight * (s.originY - 0.5);
    s.setOrigin(0.5, 0.5).setY(s.y - lift);
    const [dx, dy] = DIR[dir] || [0, 0];
    const turn = (dx < 0 || (dx === 0 && Math.random() < 0.5) ? -1 : 1) * k.spinDeg;
    scene.tweens.add({
      targets: s,
      x: s.x + dx * k.flyPx,
      y: s.y + dy * k.flyPx * 0.6 - 6,
      angle: turn,
      duration: k.flyMs,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        smokeBurst(scene, s.x, s.y, k);
        scene.tweens.add({ targets: s, alpha: 0, scale: s.scaleX * 0.6, duration: 120, onComplete: () => this.destroy() });
      },
    });
    scene.tweens.add({ targets: this.shadow, alpha: 0, duration: k.flyMs });
  }

  // 쓰러짐: 하얗게 번쩍인 뒤 뒤집히며 흐려져 사라짐
  die(ms, flashMs) {
    this.dead = true;
    this.hpBar.set(0, 0, 0, false);
    this.flash(flashMs);
    const scene = this.sprite.scene;
    // 발 기준점을 몸 가운데로 옮겨 그 자리에서 뒤집힘(세로로 -1배)
    const s = this.sprite;
    const lift = s.displayHeight * (s.originY - 0.5);
    s.setOrigin(0.5, 0.5).setY(s.y - lift);
    scene.tweens.add({
      targets: s,
      scaleY: -s.scaleY,
      y: s.y - 4,
      delay: flashMs,
      duration: ms * 0.5,
      ease: 'Quad.easeOut',
    });
    scene.tweens.add({ targets: s, alpha: 0, delay: flashMs + ms * 0.3, duration: ms * 0.7 });
    scene.tweens.add({ targets: this.shadow, alpha: 0, delay: flashMs, duration: ms, onComplete: () => this.destroy() });
  }

  destroy() {
    this.hpBar.destroy();
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
