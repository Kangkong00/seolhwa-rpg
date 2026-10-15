// 마을 사람(NPC) 그림: 정면 서 있기 그림 1장(assets/npcs/<id>/front.png, 400×800, 발 y=780) + 머리 위 이름표 + 발밑 그림자.
// 5명 같은 배율: 가장 큰 사람 기준 refHeight(740px)를 displayHeight(70)로 줄여 그림(data/npcs.json imageCanvas).
// image가 빈 문자열이면(성황당처럼 사람이 아닌 곳) 그림·그림자 없이 이름표만.
import { loadImage, downscale } from './characterFrames.js';
import { createShadow } from './shadow.js';

const FONT = '-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const loaded = new Map();

// 그림을 한 번만 받아 화면 크기에 맞게 줄여 텍스처로. 반환: 텍스처 이름(못 받으면 null)
export function loadNpcTexture(scene, npc, canvas, pixelScale, outlineFor) {
  if (!npc.image) return Promise.resolve(null);
  const key = `npc:${npc.id}@${pixelScale}`;
  if (!loaded.has(key)) {
    const texScale = Math.min(1, (canvas.displayHeight * pixelScale * 1.25) / canvas.refHeight);
    loaded.set(
      key,
      loadImage(npc.image).then((img) => {
        if (!img) return null;
        if (!scene.textures.exists(key)) scene.textures.addCanvas(key, downscale(img, texScale, outlineFor(texScale)));
        return { key, texScale };
      }),
    );
  }
  return loaded.get(key);
}

export class NpcView {
  // tex: loadNpcTexture 결과(없으면 이름표만), canvas: data/npcs.json imageCanvas
  constructor(scene, npc, tex, { canvas, shadowCfg, pixelRatio }) {
    this.npc = npc;
    this.height = tex ? canvas.displayHeight : npc.tapHeight || 40;
    let labelY = npc.y - this.height - 3;
    if (tex) {
      this.sprite = scene.add
        .image(npc.x, npc.y, tex.key)
        .setOrigin(0.5, canvas.footY / canvas.height)
        .setScale(canvas.displayHeight / canvas.refHeight / tex.texScale)
        .setDepth(npc.y);
      // 이름표는 실제 머리 위(사람마다 키가 다름)
      labelY = npc.y - this.sprite.displayHeight * (canvas.footY / canvas.height) + this.topPad(scene, tex.key) - 3;
      const sh = shadowCfg.player;
      this.shadow = createShadow(scene, shadowCfg, sh.width, sh.height, sh.alpha);
      this.shadow.setPosition(npc.x, npc.y + (sh.offsetY || 0));
    }
    this.label = scene.add
      .text(npc.x, labelY, npc.name, {
        fontFamily: FONT,
        fontSize: '9px',
        color: '#ffe9b0',
        backgroundColor: 'rgba(20,16,10,0.6)',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setResolution(pixelRatio * 2)
      .setDepth(1e5);
    this.labelY = labelY;
  }

  // 그림 위쪽 빈 공간(맵 픽셀): 사람마다 키가 달라 이름표를 머리 바로 위에 두려고 첫 불투명 줄을 찾음
  topPad(scene, key) {
    const src = scene.textures.get(key).getSourceImage();
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (d[(y * c.width + x) * 4 + 3] > 40) return y * (this.sprite.displayHeight / c.height);
      }
    }
    return 0;
  }

  // 맵 좌표(wx, wy)가 이 사람을 누른 것인지(몸 + 이름표, 옆으로 tapRadius)
  hit(wx, wy, tapRadius) {
    const n = this.npc;
    return Math.abs(wx - n.x) <= tapRadius && wy <= n.y + 6 && wy >= this.labelY - 14;
  }
}
