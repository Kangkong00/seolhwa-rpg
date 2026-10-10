// 몬스터 그림 표시: 서 있기 ↔ 걷기 자세 번갈아(다리 반전 없음), 오른쪽은 side 좌우 반전, 발밑 그림자, 머리 위 체력바.
// 물기: 그림 없이 코드로 — 바라보는 쪽으로 빠르게 튀어나갔다 돌아옴 + step 그림.
import { loadImage, downscale } from './characterFrames.js';
import { createMonsterShadow } from './shadow.js';
import { HpBar } from '../ui/hpBar.js';

const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const FILES = ['front', 'front_step', 'back', 'back_step', 'side', 'side_step'];
const loaded = new Map();

// 몬스터 종류별 그림을 한 번만 불러와 화면 크기에 맞게 줄여 텍스처로 등록
export function loadMonsterTextures(scene, def, canvasSpec, pixelScale) {
  const key = `${def.id}@${pixelScale}`;
  if (!loaded.has(key)) {
    const p = Promise.all(FILES.map((f) => loadImage(`${def.folder}/${f}.png`))).then((imgs) => {
      const scale = Math.min(1, (def.height * pixelScale * 1.25) / canvasSpec.standHeight);
      const keys = {};
      FILES.forEach((f, i) => {
        const img = imgs[i] || imgs[FILES.indexOf(f.replace('_step', ''))] || imgs[0];
        const tk = `mon:${def.id}/${f}`;
        if (scene.textures.exists(tk)) scene.textures.remove(tk);
        scene.textures.addCanvas(tk, downscale(img, scale));
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
    const key = this.textures.keys[step ? `${base}_step` : base];
    if (this.sprite.texture.key !== key) this.sprite.setTexture(key);
    this.sprite.setFlipX(m.facing === 'right');
    this.sprite.setPosition(m.x + ox, m.y + oy);
    this.sprite.setDepth(m.y);
    this.shadow.setPosition(m.x + ox, m.y + oy);
    const showBar = this.hpBarCfg.monsterShowAlways || m.hp < m.maxHp || m.aggro;
    this.hpBar.set(m.x, m.y - this.def.height - this.hpBarCfg.gap, m.hp / m.maxHp, showBar);
  }

  // 맞았을 때: 하얗게 번쩍
  flash(ms) {
    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.sprite.scene.time.delayedCall(ms, () => {
      if (this.sprite.active) this.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });
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
