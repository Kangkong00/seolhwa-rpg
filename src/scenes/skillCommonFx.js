// 무예 공통 연출 층(docs/spec/feedback_1020.md 5): 모든 액티브 무예에 얹음. 값은 data/skills.json fxCommon.
// 시전: 화면 어둡게 · 빛 알갱이가 빨려 듦(기 모으기) · 발밑 원 문양 · 무예 이름 큰 글씨 · 화면 무예 색 섬광
// 실행: 흰 중심 빛 + 무예 색 몸통 + 바깥 잔광 3겹 · 알갱이(무예마다 모양) · 땅 충격파 고리 · 잔상(돌진·연속)
// 맞힘: 큰 섬광 + X자 베인 자국 + 파편 · 칠성검무: 더 어둡게 + 하늘의 북두칠성 + 마지막 흰 섬광·느린 화면
// 빛 번짐(bloom)은 이 층(this.layer)에만, 무예를 쓰는 동안에만 켬. 평타 파편 등 무예 밖에서 그리는 것은 일반 층.
// 기본은 fxCommon.bloom(false). 아이폰·사파리는 켜 두어도 자동으로 끔(10-21 아이폰에서 평타마다 화면이 검게 된 일).
// 관리자 창 설정 탭 '빛 번짐'으로 이번 실행만 켜고 끔(scene.d.admin.bloom). 알갱이는 화면에 동시 maxParticles개까지.
import { hitStar, slashMark } from './impactFx.js';
import { afterimage } from './skillFx.js';

const hex = (c) => Phaser.Display.Color.HexStringToColor(c).color;

// 아이폰·아이패드(모든 브라우저가 WebKit)와 맥 사파리
export function isAppleWebkit() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true; // 아이패드 데스크톱 모드
  return /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|Android/.test(ua);
}
const NAME_FONT = '"Nanum Brush Script", "Gungsuh", "AppleMyungjo", "Apple SD Gothic Neo", serif';

// 무예 kind마다 알갱이 모양: cloud 구름(둥근), flame 불꽃, star 별, petal 꽃잎·잎, spark 불티(마름모)
const SHAPE = { heal: 'cloud', spin: 'petal', multi: 'star', ultimate: 'star', dash: 'flame', powerSlash: 'flame', shout: 'cloud' };

export class SkillCommonFx {
  constructor(scene, cfg) {
    this.scene = scene;
    this.cfg = cfg;
    this.particles = 0;
    this.cast = null;
    // 무예 연출 층: 주인공·몬스터 위, 숫자(1e6) 아래
    this.layer = scene.add.layer().setDepth(1e6 - 3);
    this.bloom = null; // 빛 번짐 필터(처음 켤 때 만듦)
    this.layer.setVisible(false);
    // 화면 어둡게(화면에 붙음)
    const cam = scene.cameras.main;
    this.dim = scene.add.rectangle(0, 0, cam.width * 3, cam.height * 3, 0x000000, 1).setOrigin(0.5).setScrollFactor(0).setDepth(1e6 - 4).setAlpha(0);
    this.dim.setPosition(cam.width / 2, cam.height / 2);
    this.sky = null;
  }

  // 빛 번짐을 쓸지: 관리자 창에서 고른 값이 있으면 그것, 없으면 fxCommon.bloom이고 아이폰·사파리가 아닐 때만
  get bloomWanted() {
    const a = this.scene.d.admin;
    if (a && typeof a.bloom === 'boolean') return a.bloom;
    return !!this.cfg.bloom && !isAppleWebkit();
  }

  // 빛 번짐 필터를 켜고 끔(무예 시작에 켜고, 끝나면 끔)
  setBloom(on) {
    if (on && !this.bloom && Phaser.Actions.AddEffectBloom) {
      try {
        const b = this.cfg.bloomCfg || {};
        this.bloom = Phaser.Actions.AddEffectBloom(this.layer, { threshold: b.threshold, blurRadius: b.blurRadius, blurSteps: b.blurSteps, blendAmount: b.amount });
      } catch {
        this.bloom = []; // 빛 번짐을 못 쓰는 기기: 없이
      }
    }
    for (const b of this.bloom || []) if (b.parallelFilters) b.parallelFilters.active = on;
  }

  // 무예를 쓰는 동안만 빛 번짐 층에 넣고, 평타 파편처럼 무예 밖에서 그리는 것은 일반 층에
  add(obj) {
    if (!this.cast) {
      obj.setDepth(1e6 - 3);
      return obj;
    }
    this.layer.add(obj);
    this.layer.setVisible(true);
    obj.once('destroy', () => {
      if (this.layer.list && this.layer.list.length <= 1) this.layer.setVisible(false);
    });
    return obj;
  }

  // 무예를 쓴 순간. sk: 무예 정의, color: 이 무예 색
  start(sk, color) {
    const s = this.scene;
    const c = this.cfg;
    const ult = sk.kind === 'ultimate';
    const pos = { x: s.pos.x, y: s.pos.y };
    this.cast = { sk, color, t: 0, holdMs: ult ? sk.durationMs + 400 : c.holdMs, ult };
    this.setBloom(this.bloomWanted);
    s.tweens.killTweensOf(this.dim);
    s.tweens.add({ targets: this.dim, alpha: ult ? c.ultimateDim : c.dim, duration: c.dimInMs });
    this.screenFlash(color, c.flashAlpha, c.flashMs);
    this.charge(pos, color, c.chargeCount);
    this.sigil(pos, color);
    this.skillName(sk.name, color);
    this.burst(pos, sk, color);
    if (sk.kind === 'dash' || sk.kind === 'chain') this.ghosts(color);
    if (ult) this.skyDipper(color);
  }

  // 매 프레임: 무예가 끝나면 어둠을 걷고 끝 섬광
  update(dt, busy) {
    const k = this.cast;
    if (!k) return;
    k.t += dt;
    if (k.t < k.holdMs || busy) return;
    this.cast = null;
    this.setBloom(false);
    const s = this.scene;
    s.tweens.killTweensOf(this.dim);
    s.tweens.add({ targets: this.dim, alpha: 0, duration: this.cfg.dimOutMs });
    this.screenFlash(k.color, this.cfg.flashAlpha, this.cfg.flashMs);
    if (this.sky) {
      const sky = this.sky;
      this.sky = null;
      s.tweens.add({ targets: sky.g, alpha: 0, duration: 300, onComplete: () => sky.g.destroy() });
    }
  }

  // 화면에 붙은(scrollFactor 0) 것의 좌표계에서 실제로 보이는 사각형. 카메라 확대(= 기기 픽셀 배율)가 가운데를 기준으로 걸려서
  // 보이는 곳은 가운데의 width/zoom × height/zoom 만큼
  view() {
    const cam = this.scene.cameras.main;
    const w = cam.width / cam.zoom;
    const h = cam.height / cam.zoom;
    return { x: (cam.width - w) / 2, y: (cam.height - h) / 2, w, h };
  }

  get active() {
    return !!this.cast;
  }

  get color() {
    return this.cast && this.cast.color;
  }

  // 화면 전체 색 섬광
  screenFlash(color, alpha, ms) {
    const s = this.scene;
    const cam = s.cameras.main;
    const r = s.add.rectangle(cam.width / 2, cam.height / 2, cam.width * 3, cam.height * 3, hex(color), 1).setScrollFactor(0).setDepth(1e6 - 1).setAlpha(alpha);
    s.tweens.add({ targets: r, alpha: 0, duration: ms, onComplete: () => r.destroy() });
  }

  // 화면 가장자리가 하얗게(회심)
  edgeFlash(alpha, ms) {
    const s = this.scene;
    const v = this.view();
    const g = s.add.graphics().setScrollFactor(0).setDepth(1e6 - 1);
    const band = Math.min(v.w, v.h) * 0.06;
    for (let i = 0; i < 4; i++) {
      g.lineStyle(band * (1 - i / 4) * 2, 0xffffff, alpha * (1 - i / 4));
      g.strokeRect(v.x, v.y, v.w, v.h);
    }
    s.tweens.add({ targets: g, alpha: 0, duration: ms, onComplete: () => g.destroy() });
  }

  // 알갱이 하나(상한을 넘으면 안 만듦)
  particle(x, y, shape, color, size) {
    if (this.particles >= this.cfg.maxParticles) return null;
    this.particles++;
    const g = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    const col = hex(color);
    g.fillStyle(col, 1);
    if (shape === 'cloud') {
      g.fillCircle(0, 0, size);
      g.fillStyle(0xffffff, 0.6);
      g.fillCircle(0, 0, size * 0.45);
    } else if (shape === 'star') {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.fillTriangle(-dy * size * 0.3, dx * size * 0.3, dy * size * 0.3, -dx * size * 0.3, dx * size * 1.4, dy * size * 1.4);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(0, 0, size * 0.35);
    } else if (shape === 'petal') {
      g.fillEllipse(0, 0, size * 2.2, size);
    } else if (shape === 'flame') {
      g.fillTriangle(-size * 0.6, 0, size * 0.6, 0, 0, -size * 2);
      g.fillCircle(0, 0, size * 0.6);
    } else {
      g.fillTriangle(0, -size, size * 0.5, 0, 0, size);
      g.fillTriangle(0, -size, -size * 0.5, 0, 0, size);
    }
    g.setPosition(x, y);
    g.once('destroy', () => { this.particles--; });
    return this.add(g);
  }

  // 기 모으기: 둘레에서 몸 쪽으로 빨려 듦
  charge(pos, color, n) {
    const s = this.scene;
    const c = this.cfg;
    const cy = pos.y - 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const r = c.chargeRadius * (0.8 + Math.random() * 0.4);
      const p = this.particle(pos.x + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7, 'spark', i % 3 ? color : '#ffffff', 2.4);
      if (!p) break;
      s.tweens.add({ targets: p, x: pos.x, y: cy, alpha: 0.2, scale: 0.4, duration: c.chargeMs, delay: Math.random() * 60, ease: 'Cubic.easeIn', onComplete: () => p.destroy() });
    }
  }

  // 발밑 원 문양: 두 겹 원 + 여덟 갈래 금, 빙글 돌며 사라짐
  sigil(pos, color) {
    const s = this.scene;
    const c = this.cfg;
    const g = s.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setPosition(pos.x, pos.y);
    const col = hex(color);
    const r = c.sigilRadius;
    g.lineStyle(2, col, 0.9);
    g.strokeEllipse(0, 0, r * 2, r * 1.2);
    g.lineStyle(1.5, 0xffffff, 0.7);
    g.strokeEllipse(0, 0, r * 1.5, r * 0.9);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fillStyle(col, 0.9);
      g.fillCircle(Math.cos(a) * r * 0.87, Math.sin(a) * r * 0.52, 2);
      g.lineStyle(1, col, 0.6);
      g.lineBetween(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.3, Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.45);
    }
    this.add(g);
    g.setScale(0.4);
    s.tweens.add({ targets: g, scale: 1, duration: 160, ease: 'Back.easeOut' });
    // 땅에 누운 원이라 돌리는 대신 문양이 흐르게(세로로 눌린 모양을 지키며 조금씩 기울임)
    const o = { k: 0 };
    s.tweens.add({ targets: o, k: 1, duration: c.sigilMs, onUpdate: () => { g.rotation = Math.sin(o.k * Math.PI * 2) * 0.12; g.alpha = o.k < 0.7 ? 1 : 1 - (o.k - 0.7) / 0.3; }, onComplete: () => g.destroy() });
  }

  // 무예 이름: 화면 위 가운데 큰 글씨, 빠르게 커졌다 자리 잡음
  skillName(name, color) {
    const s = this.scene;
    const c = this.cfg;
    const v = this.view();
    const t = s.add.text(v.x + v.w / 2, v.y + v.h * c.nameY, name, {
      fontFamily: NAME_FONT,
      fontSize: `${c.namePx}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: color,
      strokeThickness: c.nameStrokePx,
      shadow: { offsetX: 0, offsetY: 3, color: '#000000', blur: 8, fill: true, stroke: true },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1e6 + 1).setResolution((s.d.getPixelRatio() || 1) * 2).setScale(1.8).setAlpha(0);
    s.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 140, ease: 'Back.easeOut' });
    s.tweens.add({ targets: t, alpha: 0, y: t.y - 6, delay: c.nameMs - 200, duration: 200, onComplete: () => t.destroy() });
  }

  // 실행 3겹 빛 + 알갱이 + 땅 충격파 고리
  burst(pos, sk, color) {
    const s = this.scene;
    const c = this.cfg;
    const r = (sk.radius || sk.waveRadius || sk.width || 40) * c.sizeMul;
    const x = pos.x;
    const y = pos.y - 12;
    const col = hex(color);
    const g = this.add(s.add.graphics().setBlendMode(Phaser.BlendModes.ADD));
    const o = { k: 0 };
    s.tweens.add({
      targets: o,
      k: 1,
      duration: c.glowMs,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        const a = 1 - o.k;
        g.clear();
        g.fillStyle(col, 0.25 * a); // 바깥 잔광
        g.fillEllipse(x, y, r * 2.2 * (0.6 + o.k * 0.4), r * 1.3 * (0.6 + o.k * 0.4));
        g.fillStyle(col, 0.55 * a); // 무예 색 몸통
        g.fillEllipse(x, y, r * 1.3 * (0.5 + o.k * 0.5), r * 0.8 * (0.5 + o.k * 0.5));
        g.fillStyle(0xffffff, 0.9 * Math.max(0, 1 - o.k * 1.8)); // 흰 중심
        g.fillEllipse(x, y, r * 0.6, r * 0.36);
      },
      onComplete: () => g.destroy(),
    });
    // 알갱이(기본 수의 particleMul배)
    const shape = (sk.leafCount && 'petal') || SHAPE[sk.kind] || 'spark';
    const n = Math.round(c.burstCount * c.particleMul);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = r * (0.5 + Math.random() * 0.8);
      const p = this.particle(x, y, shape, i % 4 ? color : '#ffffff', 2 + Math.random() * 2.5);
      if (!p) break;
      p.rotation = a;
      s.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.65 - (shape === 'cloud' || shape === 'flame' ? 10 : 0), alpha: 0, scale: 0.5, duration: c.particleMs * (0.6 + Math.random() * 0.6), ease: 'Cubic.easeOut', onComplete: () => p.destroy() });
    }
    // 땅 충격파 고리
    for (let i = 0; i < c.shockRings; i++) {
      const ring = this.add(s.add.graphics().setBlendMode(Phaser.BlendModes.ADD));
      const q = { k: 0 };
      s.tweens.add({
        targets: q,
        k: 1,
        delay: i * c.shockGapMs,
        duration: c.shockMs,
        ease: 'Quad.easeOut',
        onUpdate: () => {
          const rr = r * (0.3 + q.k * 1.1);
          ring.clear();
          ring.lineStyle(4 * (1 - q.k) + 1, i ? col : 0xffffff, 1 - q.k);
          ring.strokeEllipse(pos.x, pos.y, rr * 2, rr * 1.1);
        },
        onComplete: () => ring.destroy(),
      });
    }
  }

  // 잔상: 주인공 그림 3장이 흐려지며 따라옴
  ghosts(color) {
    const s = this.scene;
    for (let i = 0; i < this.cfg.ghosts; i++) {
      s.time.delayedCall(i * this.cfg.ghostGapMs, () => afterimage(s, s.playerView, color, 0.5, this.cfg.ghostMs));
    }
  }

  // 무예로 맞힘: 큰 섬광 + X자 베인 자국 + 파편
  hit(x, y, dir, color) {
    const s = this.scene;
    const c = this.cfg;
    hitStar(s, x, y, c.hitStarSize, '#ffffff', 160);
    const other = { left: 'up', right: 'down', up: 'right', down: 'left' }[dir] || 'up';
    slashMark(s, x, y, dir, c.hitSlashLen, 4, color, 240);
    slashMark(s, x, y, other, c.hitSlashLen, 4, color, 240);
    this.shards(x, y, color, c.hitShards);
  }

  // 파편: 사방으로 튀며 떨어짐
  shards(x, y, color, n, spread = 26) {
    const s = this.scene;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = spread * (0.5 + Math.random() * 0.7);
      const p = this.particle(x, y, 'spark', i % 3 ? color : '#ffffff', 1.6 + Math.random() * 1.4);
      if (!p) break;
      p.rotation = a;
      s.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7 + 8, alpha: 0, duration: 260 + Math.random() * 160, ease: 'Quad.easeOut', onComplete: () => p.destroy() });
    }
  }

  // 칠성검무: 하늘(화면 위쪽)에 북두칠성 7점, skyStar(i)로 차례로 켜고 선으로 이음
  skyDipper(color) {
    const s = this.scene;
    const v = this.view();
    const shape = [[-1.0, -0.3], [-0.62, -0.42], [-0.28, -0.3], [0.02, -0.1], [0.08, 0.32], [0.6, 0.38], [0.66, -0.02]];
    const w = v.w * 0.22;
    const pts = shape.map(([x, y]) => ({ x: v.x + v.w / 2 + x * w + w * 0.15, y: v.y + v.h * 0.3 + y * w * 0.6 }));
    const g = s.add.graphics().setScrollFactor(0).setDepth(1e6 - 2).setBlendMode(Phaser.BlendModes.ADD);
    this.sky = { g, pts, lit: 0, color: hex(color), pops: [] };
    this.drawSky();
  }

  drawSky() {
    const k = this.sky;
    if (!k) return;
    const g = k.g;
    g.clear();
    k.pts.forEach((p, i) => {
      g.fillStyle(0xffffff, 0.25);
      g.fillCircle(p.x, p.y, 2);
      if (i >= k.lit) return;
      if (i > 0) {
        g.lineStyle(2, k.color, 0.8);
        g.lineBetween(k.pts[i - 1].x, k.pts[i - 1].y, p.x, p.y);
      }
      g.fillStyle(k.color, 0.5);
      g.fillCircle(p.x, p.y, 9);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(p.x, p.y, 4);
    });
  }

  // i번째 별을 켜고(선으로 이음) 그 별이 터짐
  skyStar(i) {
    const k = this.sky;
    if (!k) return;
    k.lit = Math.max(k.lit, i + 1);
    this.drawSky();
    const p = k.pts[i];
    const s = this.scene;
    const ring = s.add.graphics().setScrollFactor(0).setDepth(1e6 - 2).setBlendMode(Phaser.BlendModes.ADD);
    const o = { k: 0 };
    s.tweens.add({ targets: o, k: 1, duration: 320, onUpdate: () => { ring.clear(); ring.lineStyle(3 * (1 - o.k) + 1, 0xffffff, 1 - o.k); ring.strokeCircle(p.x, p.y, 6 + o.k * 26); ring.fillStyle(k.color, 0.6 * (1 - o.k)); ring.fillCircle(p.x, p.y, 12 * (1 - o.k) + 4); }, onComplete: () => ring.destroy() });
  }

  // 칠성검무 마지막: 화면 흰 섬광 + 느린 화면
  ultimateFinal() {
    const c = this.cfg;
    this.screenFlash('#ffffff', c.finalFlashAlpha, c.finalFlashMs);
    this.scene.slowMo = { left: c.finalSlowMs, scale: c.finalSlowScale };
  }

  destroy() {
    this.layer.destroy();
    this.dim.destroy();
    if (this.sky) this.sky.g.destroy();
  }
}
