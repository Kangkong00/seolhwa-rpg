// 캐릭터 그림을 불러와 걷기 프레임을 만듦.
// - 없는 그림은 서 있기 그림으로 대체
// - 정면·뒷면의 반대 발: step 그림에서 legSplitY 아래 다리만 좌우 반전하고 상체를 다시 얹음
// - 큰 원본(400×720)을 화면에 맞는 크기로 미리 줄여 둠 (아이폰에서 부드럽게 보이도록)

const FILES = ['front', 'front_step', 'back', 'back_step', 'side', 'side_step', 'front_punch', 'back_punch', 'side_punch'];

export function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const imageCache = new Map();

// { front, front_step, ... } — 없는 파일은 null
export function loadOutfitImages(outfit) {
  if (!imageCache.has(outfit.id)) {
    const p = Promise.all(FILES.map((f) => loadImage(`${outfit.folder}/${f}.png`))).then((imgs) => {
      const out = {};
      FILES.forEach((f, i) => { out[f] = imgs[i]; });
      if (!out.front) throw new Error(`${outfit.folder}/front.png 을 불러오지 못했습니다`);
      return out;
    });
    imageCache.set(outfit.id, p);
  }
  return imageCache.get(outfit.id);
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// 다리만 좌우 반전 (몸 중심선 = 캔버스 가로 가운데)
function mirrorLegs(img, splitY) {
  const w = img.width;
  const h = img.height;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, splitY, w, h - splitY);
  ctx.clip();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, splitY);
  ctx.clip();
  ctx.drawImage(img, 0, 0);
  ctx.restore();
  return c;
}

// 반씩 여러 번 줄여서 계단 현상 없이 축소
export function downscale(src, scale) {
  const tw = Math.max(1, Math.round(src.width * scale));
  const th = Math.max(1, Math.round(src.height * scale));
  let cur = src;
  let w = src.width;
  let h = src.height;
  while (w / 2 >= tw * 1.01) {
    w = Math.round(w / 2);
    h = Math.round(h / 2);
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, w, h);
    cur = c;
  }
  const out = makeCanvas(tw, th);
  const ctx = out.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cur, 0, 0, tw, th);
  return out;
}

// Phaser 텍스처로 등록하고 방향별 프레임 키를 돌려줌
// 반환: { down: {stand, step, stepAlt, punch}, up: {...}, side: {...} }
// 주먹 그림은 640×720(몸 가운데 x=320), 서 있기는 400×720(x=200): 둘 다 캔버스 가로 가운데가 몸 가운데라
// 같은 기준점(가로 0.5)으로 그리면 몸이 겹침. 없으면 서 있기 그림으로 대체.
export function buildOutfitFrames(textures, outfit, images, scale) {
  const add = (name, source) => {
    const key = `${outfit.id}/${name}`;
    if (textures.exists(key)) textures.remove(key);
    textures.addCanvas(key, downscale(source, scale));
    return key;
  };

  const frontStep = images.front_step || images.front;
  const back = images.back || images.front;
  const backStep = images.back_step || back;
  const side = images.side || images.front;
  const sideStep = images.side_step || side;

  const down = {
    stand: add('front', images.front),
    step: add('front_step', frontStep),
    stepAlt: add('front_step_alt', mirrorLegs(frontStep, outfit.legSplitY)),
    punch: add('front_punch', images.front_punch || images.front),
  };
  const up = {
    stand: add('back', back),
    step: add('back_step', backStep),
    stepAlt: add('back_step_alt', mirrorLegs(backStep, outfit.legSplitY)),
    punch: add('back_punch', images.back_punch || back),
  };
  // 옆면은 다리 반전 없이 side_step ↔ side 번갈아
  const sideStand = add('side', side);
  const sideStepKey = add('side_step', sideStep);
  const sidePunch = add('side_punch', images.side_punch || side);
  return { down, up, side: { stand: sideStand, step: sideStepKey, stepAlt: sideStepKey, punch: sidePunch } };
}
