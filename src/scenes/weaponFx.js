// 무기 휘두르기 연출: 궤적(정해 둔 모양), 맞은 자리의 먹 튐.
// 궤적 모양은 data/weapons.json의 trail, 색은 무기별 trailColor, 시간은 data/game.json의 swingFx.

// 휘두르기 궤적: 칼끝 경로를 잇지 않고, 방향마다 정해 둔 모양으로 그림(data/weapons.json trail).
// 옆면은 낫 모양 타원 호, 정면·뒷면은 사선 직선. 양 끝 뾰족, peakAt 지점이 가장 두꺼움,
// 시작 쪽 tailPart는 꼬리처럼 흐려짐, 바깥(직선은 가운데)으로 갈수록 밝고 진함.
// 좌표는 640×720 몸 그림 기준 → toMap(px, py)로 맵 좌표로 바꿈(오른쪽 반전 포함).
// 그림은 작은 캔버스에 그려 텍스처로 올리고, 진행만큼 다시 그림.

function hexToRgb(hex) {
  const c = Phaser.Display.Color.HexStringToColor(hex);
  return [c.red, c.green, c.blue];
}

function mixWhite([r, g, b], k) {
  return [r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k].map((v) => Math.round(v));
}

let trailSeq = 0;

export class SwingTrail {
  // shape: data/weapons.json trail.side|front|back, cfg: trail 공통 값, k: 무기 길이 배율,
  // toMap: (px, py) → { x, y }, res: 맵 1픽셀당 텍스처 픽셀 수
  constructor(scene, { shape, cfg, k, color, toMap, res, depth, fx }) {
    this.scene = scene;
    this.shape = shape;
    this.cfg = cfg;
    this.fx = fx;
    this.rgb = hexToRgb(color);
    this.res = res;
    this.fading = false;
    const [ax, ay] = shape.scaleAbout;
    // 몸 그림 좌표에서 무기 길이만큼 늘리거나 줄인 뒤 맵 좌표로
    this.pt = (px, py) => toMap(ax + (px - ax) * k, ay + (py - ay) * k);
    this.thick = shape.thickness;
    this.k = k;
    this.samples = this.buildSamples(48);

    // 그릴 범위
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const smp of this.samples) {
      for (const p of [smp.a, smp.b]) {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      }
    }
    const pad = 2;
    this.ox = minX - pad;
    this.oy = minY - pad;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.max(1, Math.ceil((maxX - minX + pad * 2) * res));
    this.canvas.height = Math.max(1, Math.ceil((maxY - minY + pad * 2) * res));
    this.ctx = this.canvas.getContext('2d');
    this.key = `trail:${trailSeq++}`;
    this.tex = scene.textures.addCanvas(this.key, this.canvas);
    this.image = scene.add.image(this.ox, this.oy, this.key).setOrigin(0, 0).setScale(1 / res).setDepth(depth);
  }

  // 진행 s(0~1)마다 두 가장자리 점: 호는 a=바깥 테두리, b=안쪽(두께만큼), 직선은 a·b = 양쪽 가장자리
  buildSamples(n) {
    const sh = this.shape;
    const out = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const w = this.taper(s) * this.thick;
      if (sh.shape === 'arc') {
        const deg = sh.fromDeg + (sh.toDeg - sh.fromDeg) * s;
        const r = (deg * Math.PI) / 180;
        const ox = sh.center[0] + sh.rx * Math.cos(r);
        const oy = sh.center[1] + sh.ry * Math.sin(r);
        const dx = sh.center[0] - ox;
        const dy = sh.center[1] - oy;
        const len = Math.hypot(dx, dy) || 1;
        out.push({ s, a: this.pt(ox, oy), b: this.pt(ox + (dx / len) * w, oy + (dy / len) * w) });
      } else {
        const [x0, y0] = sh.from;
        const [x1, y1] = sh.to;
        const cx = x0 + (x1 - x0) * s;
        const cy = y0 + (y1 - y0) * s;
        const L = Math.hypot(x1 - x0, y1 - y0) || 1;
        const nx = -(y1 - y0) / L;
        const ny = (x1 - x0) / L;
        out.push({ s, a: this.pt(cx + nx * w / 2, cy + ny * w / 2), b: this.pt(cx - nx * w / 2, cy - ny * w / 2) });
      }
    }
    return out;
  }

  // 양 끝 뾰족, peakAt에서 가장 두꺼움
  taper(s) {
    const p = this.cfg.peakAt;
    if (s <= 0 || s >= 1) return 0;
    return s < p ? Math.sin((Math.PI / 2) * (s / p)) : Math.sin((Math.PI / 2) * ((1 - s) / (1 - p)));
  }

  // 시작 쪽 꼬리: 투명에서 시작해 tailPart 지점에서 다 진해짐
  lengthAlpha(s) {
    const t = this.cfg.tailPart;
    return t > 0 ? Math.min(1, s / t) : 1;
  }

  // 가로 방향 진하기·밝기. r: 호는 안쪽 0 → 바깥 1, 직선은 가장자리 0 → 가운데 1
  across(r) {
    const c = this.cfg;
    if (this.shape.shape === 'arc') {
      return { alpha: Math.pow(r, c.alphaPower) * c.alphaMax, white: c.whiten * r };
    }
    return { alpha: c.alphaMax * (0.75 + 0.25 * r), white: c.whiten * r };
  }

  // 진행 u(0~1)까지 그림
  draw(u) {
    if (this.destroyed) return;
    const ctx = this.ctx;
    const res = this.res;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const X = (p) => (p.x - this.ox) * res;
    const Y = (p) => (p.y - this.oy) * res;
    const lerp = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    const strips = 8;
    const arc = this.shape.shape === 'arc';
    const sm = this.samples;
    for (let i = 0; i < sm.length - 1; i++) {
      const s0 = sm[i];
      let s1 = sm[i + 1];
      if (s0.s >= u) break;
      if (s1.s > u) {
        const t = (u - s0.s) / (s1.s - s0.s);
        s1 = { s: u, a: lerp(s0.a, s1.a, t), b: lerp(s0.b, s1.b, t) };
      }
      const la = this.lengthAlpha((s0.s + s1.s) / 2);
      for (let j = 0; j < strips; j++) {
        // 호: j=0이 바깥(a) 쪽, 직선: 가장자리 → 가운데 → 가장자리
        const f0 = j / strips;
        const f1 = (j + 1) / strips;
        const mid = (f0 + f1) / 2;
        const r = arc ? 1 - mid : 1 - Math.abs(mid - 0.5) * 2;
        const { alpha, white } = this.across(r);
        if (alpha * la <= 0.003) continue;
        const [cr, cg, cb] = mixWhite(this.rgb, white);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${(alpha * la).toFixed(3)})`;
        const p0 = lerp(s0.a, s0.b, f0);
        const p1 = lerp(s1.a, s1.b, f0);
        const p2 = lerp(s1.a, s1.b, f1);
        const p3 = lerp(s0.a, s0.b, f1);
        ctx.beginPath();
        ctx.moveTo(X(p0), Y(p0));
        ctx.lineTo(X(p1), Y(p1));
        ctx.lineTo(X(p2), Y(p2));
        ctx.lineTo(X(p3), Y(p3));
        ctx.closePath();
        ctx.fill();
      }
      // 또렷한 바깥 테두리 (직선은 양쪽 가장자리)
      const [er, eg, eb] = mixWhite(this.rgb, this.cfg.whiten);
      ctx.strokeStyle = `rgba(${er},${eg},${eb},${(this.cfg.alphaMax * la).toFixed(3)})`;
      ctx.lineWidth = this.cfg.edgeWidth * res;
      ctx.beginPath();
      ctx.moveTo(X(s0.a), Y(s0.a));
      ctx.lineTo(X(s1.a), Y(s1.a));
      if (!arc) {
        ctx.moveTo(X(s0.b), Y(s0.b));
        ctx.lineTo(X(s1.b), Y(s1.b));
      }
      ctx.stroke();
    }
    this.tex.refresh();
  }

  // 다 그은 뒤 흐려짐
  fadeOut() {
    if (this.fading) return;
    this.fading = true;
    this.scene.tweens.add({
      targets: this.image,
      alpha: 0,
      duration: this.fx.trailMs,
      ease: 'Quad.easeIn',
      onComplete: () => this.destroy(),
    });
  }

  destroy() {
    this.destroyed = true;
    this.image.destroy();
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }
}

// 맞은 자리의 작은 먹 튐: 먹 방울 몇 개가 바깥으로 튀며 사라짐
export function inkSplash(scene, x, y, color, fx, dirX, dirY) {
  const c = Phaser.Display.Color.HexStringToColor(color).color;
  for (let i = 0; i < fx.splashCount; i++) {
    // 맞은 방향 쪽으로 더 많이 튐
    const a = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * 2.2;
    const dist = 6 + Math.random() * 10;
    const r = fx.splashSize * (0.5 + Math.random() * 0.8);
    const dot = scene.add.circle(x, y, r, c, 0.9).setDepth(1e6 - 1);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(a) * dist,
      y: y + Math.sin(a) * dist,
      alpha: 0,
      scale: 0.4,
      duration: fx.splashMs * (0.7 + Math.random() * 0.5),
      ease: 'Cubic.easeOut',
      onComplete: () => dot.destroy(),
    });
  }
  // 가운데 번진 먹 한 점
  const blot = scene.add.circle(x, y, fx.splashSize * 2.2, c, 0.55).setDepth(1e6 - 1);
  scene.tweens.add({ targets: blot, scale: 1.6, alpha: 0, duration: fx.splashMs, onComplete: () => blot.destroy() });
}
