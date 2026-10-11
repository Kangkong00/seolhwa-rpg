// 마을 사람(NPC) 그림: 그림이 나오기 전까지 옷 서 있기 그림을 임시로 씀 + 머리 위 이름표 + 발밑 그림자.
import { loadImage, downscale } from './characterFrames.js';
import { createShadow } from './shadow.js';

const DIR_FILE = { down: 'front', up: 'back', left: 'side', right: 'side' };
const loaded = new Map();

// 옷 서 있기 그림을 한 번만 불러와 텍스처로. 반환: { front, side, back } 텍스처 이름
export function loadNpcTextures(scene, outfit, scale, outline) {
  const key = `${outfit.id}@${scale}`;
  if (!loaded.has(key)) {
    const p = Promise.all(['front', 'side', 'back'].map((f) => loadImage(`${outfit.folder}/${f}.png`))).then((imgs) => {
      const keys = {};
      ['front', 'side', 'back'].forEach((f, i) => {
        const tk = `npc:${outfit.id}/${f}`;
        if (!scene.textures.exists(tk)) scene.textures.addCanvas(tk, downscale(imgs[i] || imgs[0], scale, outline));
        keys[f] = tk;
      });
      return keys;
    });
    loaded.set(key, p);
  }
  return loaded.get(key);
}

export class NpcView {
  // npc: data/npcs.json 한 사람, keys: loadNpcTextures 결과, texScale: 텍스처 축소 비율
  constructor(scene, npc, keys, { canvasSpec, height, texScale, shadowCfg, pixelRatio }) {
    this.npc = npc;
    this.height = height;
    const file = DIR_FILE[npc.facing] || 'front';
    this.sprite = scene.add.image(npc.x, npc.y, keys[file])
      .setOrigin(0.5, canvasSpec.footY / canvasSpec.height)
      .setScale(height / canvasSpec.standHeight / texScale)
      .setFlipX(npc.facing === 'right')
      .setDepth(npc.y);
    const sh = shadowCfg.player;
    this.shadow = createShadow(scene, shadowCfg, sh.width, sh.height, sh.alpha);
    this.shadow.setPosition(npc.x, npc.y + (sh.offsetY || 0));
    this.label = scene.add
      .text(npc.x, npc.y - height - 3, npc.name, {
        fontFamily: '-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
        fontSize: '9px',
        color: '#ffe9b0',
        backgroundColor: 'rgba(20,16,10,0.6)',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setResolution(pixelRatio * 2)
      .setDepth(1e5);
  }

  // 맵 좌표(wx, wy)가 이 사람을 누른 것인지(몸 + 이름표, 옆으로 tapRadius)
  hit(wx, wy, tapRadius) {
    const n = this.npc;
    return Math.abs(wx - n.x) <= tapRadius && wy <= n.y + 6 && wy >= n.y - this.height - 16;
  }
}
