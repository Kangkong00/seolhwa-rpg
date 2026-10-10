// 몬스터 그림 표시: 서 있기 ↔ 걷기 자세 번갈아(다리 반전 없음), 오른쪽은 side 좌우 반전, 발밑 그림자.
import { loadImage, downscale } from './characterFrames.js';
import { createMonsterShadow } from './shadow.js';

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
  constructor(scene, def, canvasSpec, textures, shadowCfg) {
    this.def = def;
    this.textures = textures;
    this.walkTime = 0;
    this.sprite = scene.add.image(0, 0, textures.keys.front);
    this.sprite.setOrigin(0.5, canvasSpec.footY / canvasSpec.height);
    this.sprite.setScale(def.height / canvasSpec.standHeight / textures.scale);
    this.shadow = createMonsterShadow(scene, shadowCfg, def.height);
  }

  update(dtMs, m) {
    const base = m.facing === 'up' ? 'back' : m.facing === 'down' ? 'front' : 'side';
    let step = false;
    if (m.moving) {
      this.walkTime += dtMs;
      step = Math.floor(this.walkTime / this.def.walkFrameMs) % 2 === 0;
    } else {
      this.walkTime = 0;
    }
    const key = this.textures.keys[step ? `${base}_step` : base];
    if (this.sprite.texture.key !== key) this.sprite.setTexture(key);
    this.sprite.setFlipX(m.facing === 'right');
    this.sprite.setPosition(m.x, m.y);
    this.sprite.setDepth(m.y);
    this.shadow.setPosition(m.x, m.y);
  }

  // 맞았을 때: 하얗게 번쩍
  flash(ms) {
    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.sprite.scene.time.delayedCall(ms, () => {
      if (this.sprite.active) this.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });
  }

  // 쓰러짐: 하얗게 번쩍인 뒤 납작해지며 흐려져 사라짐
  die(ms, flashMs) {
    this.dead = true;
    this.flash(flashMs);
    const scene = this.sprite.scene;
    scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scaleY: this.sprite.scaleY * 0.4,
      scaleX: this.sprite.scaleX * 1.15,
      delay: flashMs,
      duration: ms,
      ease: 'Quad.easeIn',
    });
    scene.tweens.add({ targets: this.shadow, alpha: 0, delay: flashMs, duration: ms, onComplete: () => this.destroy() });
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
