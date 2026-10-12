// 물건 앞뒤 가림(docs/spec/maps.md '물건 앞뒤 가림').
// 마을 그림은 그대로 바닥에 깔고, 물건마다 오린 조각을 같은 자리에 겹쳐 놓고 깊이 = baseY.
// 캐릭터·몬스터·NPC·떨어진 물건의 깊이 = 발 y라서, 발이 baseY보다 북쪽(뒤)이면 조각이 앞에 그려져 가림.
// 내 캐릭터가 가려지면 가려진 부분에만 윤곽을 옅게 비춤(OcclusionGhost, 몬스터는 안 함).

const atlasKey = (mapId) => `objects:${mapId}`;

// preload에서: 조각 아틀라스(그림 한 장 + 프레임 목록) 받기
export function preloadMapObjects(scene, mapId, data) {
  if (!data || scene.textures.exists(atlasKey(mapId))) return;
  scene.load.atlas(atlasKey(mapId), data.image, data.atlas);
}

// create에서: 조각 프레임을 좌표계 크기(w, h)로 줄여 (x, y)에 놓고 깊이 = baseY. 반환: [{ o, key, image }]
export function createMapObjects(scene, mapId, data) {
  const key = atlasKey(mapId);
  if (!data || !scene.textures.exists(key)) return [];
  const tex = scene.textures.get(key);
  return data.objects
    .filter((o) => tex.has(o.frame))
    .map((o) => ({
      o,
      key,
      image: scene.add.image(o.x, o.y, key, o.frame).setOrigin(0, 0).setDisplaySize(o.w, o.h).setDepth(o.baseY),
    }));
}

// 가려졌을 때 윤곽(v2, docs/spec/maps.md 'v2'): 흰색 덮기 대신 진한 갈색 윤곽선만, 가려진 부분에만,
// 몸이 실제 조각 픽셀로 minCovered(25%) 넘게 가려졌을 때만. 몬스터는 하지 않음.
// 화면 쪽 가림막(mask) 대신 작은 캔버스에서 직접 계산(몸 그림 크기만큼, 앞에 조각이 겹칠 때만):
//   ① 몸 그림 ∩ 앞 조각 픽셀 → 가려진 비율  ② 몸 둘레 윤곽선 ∩ 앞 조각 픽셀 → 보여 줄 그림
export class OcclusionGhost {
  // body: 주인공 몸 그림(Phaser Image), cfg: data/game.json occlusionGhost
  constructor(scene, objects, body, cfg) {
    this.scene = scene;
    this.objects = objects;
    this.body = body;
    this.cfg = cfg || {};
    this.active = false;
    this.covered = 0;
    if (!this.cfg.enabled || !objects.length) return;
    this.atlas = scene.textures.get(objects[0].key);
    this.atlasImg = this.atlas.getSourceImage();
    this.work = document.createElement('canvas');
    this.workCtx = this.work.getContext('2d', { willReadFrequently: true });
    this.rings = new Map(); // 몸 그림 이름 → 윤곽선 캔버스
    this.counts = new Map(); // 몸 그림 이름 → 몸 픽셀 수
    this.texKey = `ghost:${Math.random().toString(36).slice(2)}`;
    this.canvasTex = null;
    this.image = scene.add.image(0, 0, '__DEFAULT').setDepth(5e4).setAlpha(this.cfg.alpha ?? 0.6).setVisible(false);
  }

  hide() {
    if (this.active && this.image) this.image.setVisible(false);
    this.active = false;
  }

  // 앞 조각들을 몸 그림 캔버스 좌표로 한 장(가림막)에 모아 그림(오른쪽을 보면 몸 그림이 뒤집혀 있으므로 같이 뒤집음).
  // destination-in은 그릴 때마다 그 그림 밖을 지우므로, 조각을 하나씩 바로 쓰지 않고 이 한 장으로 씀
  maskCanvas(front, g) {
    const m = this.mask || (this.mask = document.createElement('canvas'));
    if (m.width !== g.W || m.height !== g.H) {
      m.width = g.W;
      m.height = g.H;
    }
    const ctx = m.getContext('2d');
    ctx.clearRect(0, 0, g.W, g.H);
    for (const e of front) {
      const f = this.atlas.get(e.o.frame);
      ctx.save();
      if (g.flip) {
        ctx.translate(g.W, 0);
        ctx.scale(-1, 1);
      }
      ctx.scale(1 / g.s, 1 / g.s);
      ctx.translate(-g.left, -g.top);
      ctx.drawImage(this.atlasImg, f.cutX, f.cutY, f.cutWidth, f.cutHeight, e.o.x, e.o.y, e.o.w, e.o.h);
      ctx.restore();
    }
    return m;
  }

  bodyCount(key, src) {
    if (!this.counts.has(key)) {
      const c = document.createElement('canvas');
      c.width = src.width;
      c.height = src.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(src, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 127) n++;
      this.counts.set(key, Math.max(1, n));
    }
    return this.counts.get(key);
  }

  // 몸 둘레 윤곽선(몸 바깥으로 r 텍스처 픽셀): 실루엣을 둘레로 밀어 그린 뒤 몸 자리를 지움
  ring(key, src, r) {
    const k = `${key}|${r.toFixed(2)}`;
    if (!this.rings.has(k)) {
      const w = src.width;
      const h = src.height;
      const sil = document.createElement('canvas');
      sil.width = w;
      sil.height = h;
      const sctx = sil.getContext('2d');
      sctx.drawImage(src, 0, 0);
      sctx.globalCompositeOperation = 'source-in';
      sctx.fillStyle = this.cfg.color || '#3a2a1a';
      sctx.fillRect(0, 0, w, h);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      for (const rr of [r, r * 0.5]) {
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          ctx.drawImage(sil, Math.cos(a) * rr, Math.sin(a) * rr);
        }
      }
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(src, 0, 0);
      this.rings.set(k, c);
    }
    return this.rings.get(k);
  }

  // footY: 주인공 발 y
  update(footY) {
    if (!this.image) return;
    const sp = this.body;
    if (!sp.visible || !sp.texture || sp.texture.key === '__DEFAULT') return this.hide();
    const src = sp.texture.getSourceImage();
    const W = src.width;
    const H = src.height;
    const s = Math.abs(sp.scaleX);
    const g = { W, H, s, flip: sp.flipX, left: sp.x - sp.originX * W * s, top: sp.y - sp.originY * H * s };
    const right = g.left + W * s;
    const bottom = g.top + H * s;
    const front = this.objects.filter(
      (e) => e.o.baseY > footY && e.o.x < right && e.o.x + e.o.w > g.left && e.o.y < bottom && e.o.y + e.o.h > g.top,
    );
    if (!front.length) {
      this.covered = 0;
      return this.hide();
    }
    // ① 가려진 비율: 몸 그림에서 앞 조각 픽셀과 겹치는 부분만 남겨 셈
    if (this.work.width !== W || this.work.height !== H) {
      this.work.width = W;
      this.work.height = H;
    }
    const ctx = this.workCtx;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    const mask = this.maskCanvas(front, g);
    ctx.drawImage(mask, 0, 0);
    const d = ctx.getImageData(0, 0, W, H).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 127) n++;
    this.covered = n / this.bodyCount(sp.texture.key, src);
    if (this.covered <= (this.cfg.minCovered ?? 0.25)) return this.hide();
    // ② 윤곽선 ∩ 앞 조각 → 가려진 부분의 윤곽선만
    if (!this.canvasTex) this.canvasTex = this.scene.textures.createCanvas(this.texKey, W, H);
    else if (this.canvasTex.width !== W || this.canvasTex.height !== H) this.canvasTex.setSize(W, H);
    const out = this.canvasTex.context;
    out.globalCompositeOperation = 'source-over';
    out.clearRect(0, 0, W, H);
    out.drawImage(this.ring(sp.texture.key, src, (this.cfg.widthPx ?? 2) / s), 0, 0);
    out.globalCompositeOperation = 'destination-in';
    out.drawImage(mask, 0, 0);
    out.globalCompositeOperation = 'source-over';
    this.canvasTex.refresh();
    if (this.image.texture.key !== this.texKey) this.image.setTexture(this.texKey);
    this.image.setOrigin(sp.originX, sp.originY).setPosition(sp.x, sp.y).setScale(s).setFlipX(sp.flipX).setVisible(true);
    this.active = true;
  }

  // 맵을 옮길 때: 그때마다 만든 캔버스 텍스처를 지움
  destroy() {
    if (this.canvasTex) this.scene.textures.remove(this.texKey);
    this.canvasTex = null;
  }
}
