// 물건 앞뒤 가림(docs/spec/maps.md '물건 앞뒤 가림').
// 마을 그림은 그대로 바닥에 깔고, 물건마다 오린 조각을 같은 자리에 겹쳐 놓고 깊이 = baseY.
// 캐릭터·몬스터·NPC·떨어진 물건의 깊이 = 발 y라서, 발이 baseY보다 북쪽(뒤)이면 조각이 앞에 그려져 가림.
// 내 캐릭터가 가려지면 가려진 부분에만 윤곽을 옅게 비춤(OcclusionGhost, 몬스터는 안 함).

const keyOf = (mapId, file) => `obj:${mapId}/${file}`;

// preload에서: 조각 그림 받기
export function preloadMapObjects(scene, mapId, data) {
  if (!data) return;
  for (const o of data.objects) {
    const key = keyOf(mapId, o.file);
    if (!scene.textures.exists(key)) scene.load.image(key, `${data.folder}/${o.file}`);
  }
}

// create에서: 조각을 (x, y)에 좌표계 크기(w, h)로 놓고 깊이 = baseY. 반환: [{ o, image }]
export function createMapObjects(scene, mapId, data) {
  if (!data) return [];
  return data.objects
    .filter((o) => scene.textures.exists(keyOf(mapId, o.file)))
    .map((o) => ({
      o,
      key: keyOf(mapId, o.file),
      image: scene.add.image(o.x, o.y, keyOf(mapId, o.file)).setOrigin(0, 0).setDisplaySize(o.w, o.h).setDepth(o.baseY),
    }));
}

// 가려진 부분에만 보이는 옅은 윤곽.
// 몸·무기·손 덮개를 흰색으로 칠한 복사본을 조각들 위에 그리되, 지금 캐릭터 앞에 있는 조각 모양으로만 보이게 가림막(mask)을 씌움.
// 앞에 있는 조각이 겹치지 않으면 아무것도 그리지 않음(평소엔 비용 없음).
export class OcclusionGhost {
  // parts: 따라 그릴 그림들(PlayerView의 몸·무기·손 덮개), cfg: data/game.json occlusionGhost
  constructor(scene, objects, parts, cfg) {
    this.scene = scene;
    this.objects = objects;
    this.parts = parts;
    this.cfg = cfg || {};
    this.active = false;
    if (!this.cfg.enabled || !objects.length) return;
    const color = Phaser.Display.Color.HexStringToColor(this.cfg.color || '#ffffff').color;
    this.copies = parts.map(() => new Phaser.GameObjects.Image(scene, 0, 0, '__DEFAULT').setTint(color).setTintMode(Phaser.TintModes.FILL));
    this.ghost = scene.add.container(0, 0, this.copies).setDepth(5e4).setAlpha(this.cfg.alpha ?? 0.3).setVisible(false);
    // 가림막: 지금 앞에 있는 조각들의 복사본(화면에는 따로 그리지 않음)
    this.maskBox = new Phaser.GameObjects.Container(scene, 0, 0);
    this.maskImages = new Map();
    this.ghost.enableFilters();
    this.ghost.filters.internal.addMask(this.maskBox);
    this.front = '';
  }

  maskImage(entry) {
    let img = this.maskImages.get(entry);
    if (!img) {
      img = new Phaser.GameObjects.Image(this.scene, entry.o.x, entry.o.y, entry.key).setOrigin(0, 0).setDisplaySize(entry.o.w, entry.o.h);
      this.maskImages.set(entry, img);
    }
    return img;
  }

  // footY: 캐릭터 발 y, box: 캐릭터가 차지하는 사각형(맵 좌표) { x0, y0, x1, y1 }
  update(footY, box) {
    if (!this.ghost) return;
    const front = this.objects.filter(
      (e) => e.o.baseY > footY && e.o.x < box.x1 && e.o.x + e.o.w > box.x0 && e.o.y < box.y1 && e.o.y + e.o.h > box.y0,
    );
    if (!front.length) {
      if (this.active) this.ghost.setVisible(false);
      this.active = false;
      return;
    }
    const sig = front.map((e) => e.o.file).join(',');
    if (sig !== this.front) {
      this.front = sig;
      this.maskBox.removeAll(false);
      this.maskBox.add(front.map((e) => this.maskImage(e)));
    }
    this.parts.forEach((p, i) => {
      const c = this.copies[i];
      c.setVisible(p.visible);
      if (!p.visible) return;
      if (c.texture.key !== p.texture.key) c.setTexture(p.texture.key);
      c.setOrigin(p.originX, p.originY).setPosition(p.x, p.y).setScale(p.scaleX, p.scaleY).setRotation(p.rotation).setFlipX(p.flipX);
    });
    this.ghost.setVisible(true);
    this.active = true;
  }

  // 맵을 옮길 때: 화면 밖에서 만든 가림막 복사본을 지움(윤곽 그림은 장면과 함께 지워짐)
  destroy() {
    if (!this.ghost) return;
    this.maskBox.destroy();
    for (const img of this.maskImages.values()) img.destroy();
    for (const c of this.copies) if (!c.parentContainer) c.destroy();
    this.maskImages.clear();
  }
}
