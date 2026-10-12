// 레벨업 연출(docs/spec/economy.md '2차 다듬기 — 레벨업 연출'). 그림 없이 코드로, 약 3.5초.
// 값은 모두 data/economy.json levelUpFx. 시간 순서:
//  0.0초 멈칫(게임 느려짐은 MapScene) + 가장자리 어둡게 + 낮은 징
//  0.2초 발밑 금빛 원진(두 겹 원 + 눈금 24개 + 福壽康寧이 천천히 돎)
//  0.4초 하늘에서 빛줄기 → 땅에 닿으면 충격파 고리 두 겹 + 화면 살짝 흔들림 + 주변 몬스터가 밀려나 보임(보이기만) + 맑은 화음
//  0.5초 빛기둥 + 나선으로 오르는 불티 40개 + 캐릭터가 1초 동안 금빛
//  0.7초 화면 가운데 붓글씨 `레벨 업`(왼쪽부터 써지듯) + `Lv N` + `최대 체력 +3`, 2.5초 유지 후 흐려짐
//  5의 배수 레벨: 빛기둥 붉은 금색 + 원진 2배 + 꽃잎. 10의 배수: 화면 전체에 금빛 물결.
import { ensurePillarTexture, ensureSparkleTexture } from './progressFx.js';

const hex = (c) => Phaser.Display.Color.HexStringToColor(c).color;

// 원진 그림(한 번만 만듦): 두 겹 원 + 바깥 원의 짧은 눈금 24개 + 네 방향 한자
function ensureCircleTexture(scene, cfg) {
  const key = `fx:circle:${cfg.circleChars}`;
  if (scene.textures.exists(key)) return key;
  const n = 512;
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const ctx = c.getContext('2d');
  const r = n / 2;
  ctx.translate(r, r);
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 4;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
    ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
    ctx.stroke();
  }
  ctx.font = `bold ${Math.round(r * 0.2)}px "Apple SD Gothic Neo", "Noto Serif CJK KR", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [...cfg.circleChars].slice(0, 4).forEach((ch, i) => {
    const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  scene.textures.addCanvas(key, c);
  return key;
}

// 꽃잎 그림
function ensurePetalTexture(scene) {
  const key = 'fx:petal';
  if (scene.textures.exists(key)) return key;
  const c = document.createElement('canvas');
  c.width = 24;
  c.height = 16;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(12, 8, 11, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  scene.textures.addCanvas(key, c);
  return key;
}

// DOM 연출(가장자리 어둡게·가운데 글자·금빛 물결): CSS 애니메이션을 다시 시작
function playDom(id, vars) {
  const el = document.getElementById(id);
  if (!el) return null;
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  return el;
}

// scene: MapScene. getPos(): 지금 주인공 발 위치(연출이 주인공을 따라감)
export function levelUpFx(scene, getPos, height, level, hpGain, cfg, pixelRatio) {
  const big5 = level % 5 === 0;
  const big10 = level % 10 === 0;
  const t = (ms, fn) => scene.time.delayedCall(ms, fn);
  const p0 = getPos();

  // ① 가장자리 어둡게 + 징 (멈칫은 MapScene이 게임 시간을 느리게)
  playDom('vignette', { '--vg-color': cfg.vignetteColor, '--vg-ms': `${cfg.vignetteMs}ms` });
  scene.sfx.play('levelGong');

  // ② 발밑 원진: 눕힌 판(세로 circleSquash배) 위에서 천천히 돎
  t(cfg.circleDelayMs, () => {
    const p = getPos();
    const radius = cfg.circleRadius * (big5 ? cfg.big5.circleScale : 1);
    const disc = scene.add.image(0, 0, ensureCircleTexture(scene, cfg)).setTint(hex(cfg.circleColor)).setBlendMode(Phaser.BlendModes.ADD);
    disc.setDisplaySize(radius * 2, radius * 2);
    const base = disc.scaleX;
    const plate = scene.add.container(p.x, p.y, [disc]).setScale(1, cfg.circleSquash).setDepth(-0.85).setAlpha(0);
    disc.setScale(base * 0.3);
    scene.tweens.add({ targets: disc, scale: base, duration: 400, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: plate, alpha: 0.95, duration: 300 });
    scene.tweens.add({ targets: disc, angle: (cfg.circleSpinDeg * cfg.circleMs) / 1000, duration: cfg.circleMs });
    scene.tweens.add({ targets: plate, alpha: 0, delay: cfg.circleMs - 700, duration: 700, onComplete: () => plate.destroy() });
    // 주인공을 따라감
    const follow = scene.time.addEvent({ delay: 16, loop: true, callback: () => { const q = getPos(); if (plate.active) plate.setPosition(q.x, q.y); else follow.remove(); } });
  });

  // ③ 빛줄기 → 충격파 + 흔들림 + 몬스터 밀려남(보이기만) + 화음
  t(cfg.beamDelayMs, () => {
    const p = getPos();
    const top = scene.cameras.main.worldView.y - 10;
    const beam = scene.add
      .image(p.x, top, ensurePillarTexture(scene))
      .setOrigin(0.5, 0)
      .setFlipY(false)
      .setTint(hex(cfg.beamColor))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(cfg.beamWidth, 1)
      .setDepth(p.y + 0.07);
    scene.tweens.add({
      targets: beam,
      displayHeight: p.y - top,
      duration: cfg.beamMs,
      ease: 'Quad.easeIn',
      onComplete: () => {
        scene.tweens.add({ targets: beam, alpha: 0, displayWidth: cfg.beamWidth * 2.5, duration: 350, onComplete: () => beam.destroy() });
        shockRings(scene, p.x, p.y, cfg);
        scene.cameras.main.shake(cfg.shakeMs, cfg.shakeIntensity);
        scene.sfx.play('levelUp');
        for (const [m, view] of scene.monsterViewsNear(p.x, p.y, cfg.pushRadius)) {
          const dx = m.x - p.x;
          const dy = m.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          view.nudge((dx / d) * cfg.pushPx, (dy / d) * cfg.pushPx, 500);
        }
      },
    });
  });

  // ④ 빛기둥 + 불티 나선 + 캐릭터 금빛
  t(cfg.pillarDelayMs, () => {
    const p = getPos();
    const color = big5 ? cfg.big5.pillarColor : cfg.pillarColor;
    const H = height * cfg.pillarHeight;
    for (const [dz, alpha] of [[-0.05, 0.9], [0.05, 0.25]]) {
      const pl = scene.add
        .image(p.x, p.y + 2, ensurePillarTexture(scene))
        .setOrigin(0.5, 1)
        .setTint(hex(color))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(cfg.pillarWidth, 1)
        .setAlpha(alpha)
        .setDepth(p.y + dz);
      scene.tweens.add({ targets: pl, displayHeight: H, duration: cfg.pillarMs * 0.35, ease: 'Cubic.easeOut' });
      scene.tweens.add({
        targets: pl,
        alpha: 0,
        displayWidth: cfg.pillarWidth * 0.4,
        delay: cfg.pillarMs * 0.45,
        duration: cfg.pillarMs * 0.55,
        ease: 'Quad.easeIn',
        onComplete: () => pl.destroy(),
      });
    }
    embers(scene, getPos, cfg);
    scene.playerView.setGlow(cfg.glowColor, cfg.glowAlpha, cfg.glowMs);
    if (big5) petals(scene, getPos, height, cfg.big5);
  });

  // ⑤ 화면 가운데 붓글씨
  t(cfg.bannerDelayMs, () => {
    const el = playDom('levelup-banner', {
      '--lb-write': `${cfg.bannerWriteMs}ms`,
      '--lb-hold': `${cfg.bannerHoldMs}ms`,
      '--lb-fade': `${cfg.bannerFadeMs}ms`,
      '--lb-font': `'${cfg.font}'`,
    });
    if (el) {
      el.querySelector('.lb-level').textContent = `Lv ${level}`;
      el.querySelector('.lb-hp').textContent = hpGain > 0 ? `최대 체력 +${hpGain}` : '';
      el.classList.toggle('big5', big5);
    }
    if (big10) playDom('gold-wave', { '--gw-color': cfg.big10.waveColor, '--gw-ms': `${cfg.big10.waveMs}ms` });
  });
  return p0;
}

// 충격파: 땅에 눕힌 고리 두 겹이 퍼짐
function shockRings(scene, x, y, cfg) {
  [0, 120].forEach((delay, i) => {
    const g = scene.add.graphics().setDepth(y - 0.08).setBlendMode(Phaser.BlendModes.ADD);
    const o = { k: 0 };
    scene.tweens.add({
      targets: o,
      k: 1,
      delay,
      duration: cfg.shockMs,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        const r = cfg.shockRadius * (0.15 + 0.85 * o.k) * (i ? 0.8 : 1);
        g.clear();
        g.lineStyle(4 * (1 - o.k) + 1, hex(cfg.shockColor), 1 - o.k);
        g.strokeEllipse(x, y, r * 2, r * 2 * cfg.circleSquash);
      },
      onComplete: () => g.destroy(),
    });
  });
}

// 불티 나선: 몸 둘레를 돌며 위로 올라감(앞쪽을 지날 때는 몸 앞, 뒤쪽은 몸 뒤)
function embers(scene, getPos, cfg) {
  const tex = ensureSparkleTexture(scene);
  for (let i = 0; i < cfg.emberCount; i++) {
    const a0 = (i / cfg.emberCount) * Math.PI * 2 * 3 + Math.random() * 0.5;
    const size = 3 + Math.random() * 4;
    const delay = (i / cfg.emberCount) * cfg.emberMs * 0.35;
    const img = scene.add.image(0, 0, tex).setTint(hex(cfg.emberColor)).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(size, size).setAlpha(0);
    const o = { k: 0 };
    scene.tweens.add({
      targets: o,
      k: 1,
      delay,
      duration: cfg.emberMs * (0.7 + Math.random() * 0.3),
      ease: 'Sine.easeOut',
      onUpdate: () => {
        const p = getPos();
        const a = a0 + o.k * Math.PI * 3;
        const r = cfg.emberRadius * (1 - 0.5 * o.k);
        const front = Math.sin(a) > 0;
        img
          .setPosition(p.x + Math.cos(a) * r, p.y - 4 - o.k * cfg.emberRise + Math.sin(a) * r * 0.35)
          .setAlpha(o.k < 0.15 ? o.k / 0.15 : 1 - (o.k - 0.15) / 0.85)
          .setDepth(p.y + (front ? 0.06 : -0.06));
      },
      onComplete: () => img.destroy(),
    });
  }
}

// 꽃잎(5의 배수 레벨): 몸 둘레에서 흩날리며 떨어짐
function petals(scene, getPos, height, big) {
  const tex = ensurePetalTexture(scene);
  for (let i = 0; i < big.petalCount; i++) {
    const p = getPos();
    const sx = p.x + (Math.random() - 0.5) * 50;
    const sy = p.y - height * (0.6 + Math.random() * 0.9);
    const col = big.petalColors[i % big.petalColors.length];
    const img = scene.add.image(sx, sy, tex).setTint(hex(col)).setDisplaySize(5, 3.4).setAngle(Math.random() * 360).setAlpha(0).setDepth(1e5);
    const dx = (Math.random() - 0.5) * 120;
    const delay = Math.random() * 500;
    scene.tweens.add({ targets: img, alpha: 0.95, delay, duration: 200 });
    scene.tweens.add({
      targets: img,
      x: sx + dx,
      y: sy + height * (0.6 + Math.random() * 0.6),
      angle: img.angle + (Math.random() < 0.5 ? -1 : 1) * 540,
      delay,
      duration: big.petalMs,
      ease: 'Sine.easeOut',
    });
    scene.tweens.add({ targets: img, alpha: 0, delay: delay + big.petalMs * 0.65, duration: big.petalMs * 0.35, onComplete: () => img.destroy() });
  }
}
