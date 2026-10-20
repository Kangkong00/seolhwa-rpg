// 몬스터 그림 표시: 서 있기 ↔ 걷기 자세 번갈아(다리 반전 없음), 오른쪽은 side 좌우 반전, 발밑 그림자, 머리 위 체력바.
// 물기: 그림 없이 코드로 — 바라보는 쪽으로 빠르게 튀어나갔다 돌아옴 + step 그림.
import { loadImage, downscale } from './characterFrames.js';
import { createMonsterShadow } from './shadow.js';
import { HpBar } from '../ui/hpBar.js';
import { smokeBurst, inkBurst } from './impactFx.js';
import { isEnraged } from '../core/monsters.js';

const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const FILES = ['front', 'front_step', 'back', 'back_step', 'side', 'side_step'];
const loaded = new Map();

// 몬스터 종류별 그림을 한 번만 불러와 화면 크기에 맞게 줄여 텍스처로 등록
// outlineFor(texScale) → 외곽선 설정(없으면 null)
export function loadMonsterTextures(scene, def, canvasSpec, pixelScale, outlineFor = () => null) {
  const key = `${def.id}@${pixelScale}`;
  if (!loaded.has(key)) {
    const p = Promise.all(FILES.map((f) => loadImage(`${def.folder}/${f}.png`))).then((imgs) => {
      const scale = Math.min(1, (def.height * pixelScale * 1.25) / canvasSpec.standHeight);
      const keys = {};
      FILES.forEach((f, i) => {
        const img = imgs[i] || imgs[FILES.indexOf(f.replace('_step', ''))] || imgs[0];
        const tk = `mon:${def.id}/${f}`;
        if (scene.textures.exists(tk)) scene.textures.remove(tk);
        scene.textures.addCanvas(tk, downscale(img, scale, outlineFor(scale)));
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
    this.baseScale = this.sprite.scaleX;
    // 물들임(굴 들쥐: 들쥐 그림을 어둡게)
    this.tint = def.tint ? Phaser.Display.Color.HexStringToColor(def.tint).color : null;
    this.clearFlash();
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
    // 레벨업 충격파 등으로 밀려나 보이기(그림만, 실제 위치는 그대로)
    if (this.push) {
      this.push.t += dtMs;
      const k = Math.min(1, this.push.t / this.push.ms);
      const e = Math.sin(Math.PI * k) * (1 - k * 0.3);
      ox += this.push.dx * e;
      oy += this.push.dy * e;
      if (k >= 1) this.push = null;
    }
    // 돌진 예고(쥐왕): 웅크림 — 납작해지고 옆으로 퍼지며 부르르 떪. 돌진 중엔 걷기 그림
    let sx = 1;
    let sy = 1;
    // (특기 돌진의 예고는 아래 특기 예고가 그림 — def.charge가 있는 쥐왕만 여기)
    if (m.chargeState === 'windup' && this.def.charge) {
      const k = 1 - Math.max(0, m.chargeMs) / this.def.charge.windupMs;
      sy = 1 - 0.18 * k;
      sx = 1 + 0.1 * k;
      ox += Math.sin(m.chargeMs / 18) * 1.2 * k;
    } else if (m.chargeState === 'dash') {
      step = true;
    }
    // 웅크림(물뱀이 물기 전): 세로로 눌리고 가로로 조금 퍼짐
    if (m.biteWindup > 0 && this.def.biteWindupMs) {
      const k = 1 - m.biteWindup / this.def.biteWindupMs;
      sy *= 1 - (1 - (this.def.crouchY || 0.85)) * Math.min(1, k * 2);
      sx *= 1 + 0.05 * Math.min(1, k * 2);
    }
    // 특기 예고(docs/spec/tier4_9.md 3): style별 자세 — 몸을 비틂(꼬리)·일어섬(내려찍기·충격파)·움츠림(돌진·덮치기)·
    // 고개를 젖힘(울부짖음·포효)·뒤로 젖힘(발톱)·떪(분신)·푸르게 빛남(여우불)
    let angle = 0;
    const mv = m.move && this.def.moves ? this.def.moves[m.move.i] : null;
    if (mv && m.move.state === 'windup') {
      const k = Math.min(1, 1 - Math.max(0, m.move.ms) / mv.windupMs);
      const shake = Math.sin(this.sprite.scene.time.now / 25) * 1.2 * k;
      switch (mv.style) {
        case 'tail':
          angle = Math.sin(k * Math.PI * 3) * 10 * k;
          sx *= 1 - 0.08 * k;
          break;
        case 'slam':
          sy *= 1 + 0.15 * k;
          sx *= 1 - 0.05 * k;
          break;
        case 'shock':
          sy *= 1 + 0.2 * k;
          sx *= 1 - 0.06 * k;
          ox += shake;
          break;
        case 'dash':
        case 'pounce':
          sy *= 1 - 0.15 * k;
          sx *= 1 + 0.08 * k;
          ox += shake;
          break;
        case 'howl':
        case 'roar':
          sy *= 1 + 0.06 * Math.sin(k * Math.PI);
          angle = (m.facing === 'right' ? -1 : 1) * 8 * k;
          break;
        case 'claw':
          sx *= 1 - 0.08 * k;
          angle = (m.facing === 'right' ? 1 : -1) * -6 * k;
          break;
        case 'smoke':
          ox += shake * 1.5;
          break;
        case 'fire':
          if (!this.flashing) this.sprite.setTint(0x9fd0ff).setTintMode(Phaser.TintModes.MULTIPLY);
          this.fireTint = true;
          break;
        default:
          break;
      }
    } else if (this.fireTint && !this.flashing) {
      this.fireTint = false;
      this.clearFlash();
    }
    if (!this.dead) this.sprite.setAngle(angle);
    // 특기를 쓴 순간: 연출 + 소리
    if (this.def.moves && m.moveCount !== (this.moveSeen ?? m.moveCount)) this.moveFx(m, this.def.moves[m.moveLast]);
    this.moveSeen = m.moveCount;
    // 순간이동(너구리): 떠난 자리·도착한 자리에 연기
    if (m.blinkCount !== (this.blinkSeen ?? m.blinkCount)) {
      const sc = this.sprite.scene;
      const cfg = { smokeColor: '#e8e2d6', smokeCount: 7, smokeMs: 380 };
      if (m.blinkFrom) smokeBurst(sc, m.blinkFrom.x, m.blinkFrom.y - this.def.height * 0.4, cfg);
      smokeBurst(sc, m.x, m.y - this.def.height * 0.4, cfg);
      if (sc.sfx) sc.sfx.play('poof');
    }
    this.blinkSeen = m.blinkCount;
    // 아홉 꼬리 그림자(구미호): 몸 뒤로 어두운 꼬리 9개가 부채꼴로 일렁임
    if (this.def.nineTails && !this.dead) this.drawTails(m, dtMs);
    // 성남(체력 50% 아래): 붉게 깜빡임
    if (this.def.enrage && !this.dead && !this.flashing) {
      const on = isEnraged(m, this.def) && Math.floor(this.sprite.scene.time.now / this.def.enrage.blinkMs) % 2 === 0;
      if (on !== this.blinkOn) {
        this.blinkOn = on;
        if (on) this.sprite.setTint(Phaser.Display.Color.HexStringToColor(this.def.enrage.blinkColor).color).setTintMode(Phaser.TintModes.MULTIPLY);
        else this.clearFlash();
      }
    }
    // 맞아서 찌그러짐(가로로 퍼지고 세로로 눌렸다 돌아옴)
    if (this.squashing) {
      const q = this.squashing;
      q.t += dtMs;
      const k = Math.max(0, 1 - q.t / q.ms);
      sx *= 1 + (q.sx - 1) * k;
      sy *= 1 + (q.sy - 1) * k;
      if (k <= 0) this.squashing = null;
    }
    if (!this.dead) this.sprite.setScale(this.baseScale * sx, this.baseScale * sy);
    const key = this.textures.keys[step ? `${base}_step` : base];
    if (this.sprite.texture.key !== key) this.sprite.setTexture(key);
    this.sprite.setFlipX(m.facing === 'right');
    this.sprite.setPosition(m.x + ox, m.y + oy);
    this.sprite.setDepth(m.y);
    this.shadow.setPosition(m.x + ox, m.y + oy);
    const showBar = this.hpBarCfg.monsterShowAlways || m.hp < m.maxHp || m.aggro;
    this.hpBar.set(m.x, m.y - this.def.height - this.hpBarCfg.gap, m.hp / m.maxHp, showBar);
  }

  // 그림만 (dx, dy)만큼 밀렸다가 돌아옴
  nudge(dx, dy, ms) {
    this.push = { dx, dy, ms, t: 0 };
  }

  // 번쩍 끝: 원래 색(물들임이 있으면 그 색)으로
  clearFlash() {
    this.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    if (this.tint !== null) this.sprite.setTint(this.tint);
  }

  // 맞았을 때: 하얗게 번쩍
  flash(ms) {
    this.flashing = true;
    this.blinkOn = false;
    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.sprite.scene.time.delayedCall(ms, () => {
      this.flashing = false;
      if (this.sprite.active) this.clearFlash();
    });
  }

  // 특기를 쓴 순간의 연출(style별) + 소리(mv.sound)
  moveFx(m, mv) {
    if (!mv) return;
    const scene = this.sprite.scene;
    if (mv.sound && scene.sfx) scene.sfx.play(mv.sound);
    const c = Phaser.Display.Color.HexStringToColor(mv.color || '#ffffff').color;
    const cx = m.x;
    const cy = m.y - this.def.height * 0.3;
    const base = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[m.facing];
    if (mv.style === 'tail' || mv.style === 'slam' || mv.style === 'claw') {
      // 바라보는 쪽 반원을 바람 호가 쓸고 지나감(발톱은 짧은 줄 3개)
      const g = scene.add.graphics().setDepth(m.y + 0.05).setBlendMode(Phaser.BlendModes.ADD);
      const o = { k: 0 };
      scene.tweens.add({
        targets: o,
        k: 1,
        duration: mv.style === 'claw' ? 160 : 260,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          g.clear();
          if (mv.style === 'claw') {
            for (let n = -1; n <= 1; n++) {
              const a = base + n * 0.35;
              const r0 = mv.radius * 0.35;
              const r1 = mv.radius * (0.35 + 0.65 * o.k);
              g.lineStyle(4 * (1 - o.k * 0.5), c, 0.9 * (1 - o.k * 0.5));
              g.lineBetween(cx + Math.cos(a) * r0 - 6, cy + Math.sin(a) * r0 * 0.6 - 6, cx + Math.cos(a) * r1 + 6, cy + Math.sin(a) * r1 * 0.6 + 6);
            }
            return;
          }
          const end = base - Math.PI / 2 + Math.PI * o.k;
          for (const [w, al, rr] of [[8, 0.35, mv.radius], [3, 0.9, mv.radius * 0.92]]) {
            g.lineStyle(w * (1 - o.k * 0.5), c, al * (1 - o.k * 0.6));
            g.beginPath();
            for (let i = 0; i <= 16; i++) {
              const a = base - Math.PI / 2 + (end - (base - Math.PI / 2)) * (i / 16);
              const px = cx + Math.cos(a) * rr;
              const py = cy + Math.sin(a) * rr * 0.55;
              if (i === 0) g.moveTo(px, py);
              else g.lineTo(px, py);
            }
            g.strokePath();
          }
        },
        onComplete: () => scene.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() }),
      });
      if (mv.style === 'slam') {
        smokeBurst(scene, m.x + Math.cos(base) * mv.radius * 0.6, m.y + Math.sin(base) * mv.radius * 0.35, { smokeColor: '#c8b48c', smokeCount: 6, smokeMs: 420 });
        scene.cameras.main.shake(120, 0.003);
      }
    } else if (mv.style === 'shock' || mv.style === 'howl' || mv.style === 'roar') {
      // 고리가 퍼짐: 충격파(땅, radius까지), 울부짖음·포효(소리 고리 3개)
      const rings = mv.style === 'shock' ? 2 : 3;
      for (let n = 0; n < rings; n++) {
        scene.time.delayedCall(n * 110, () => {
          const g = scene.add.graphics().setDepth(mv.style === 'shock' ? -0.8 : 1e6 - 3).setBlendMode(Phaser.BlendModes.ADD);
          const o = { k: 0 };
          const R = mv.style === 'shock' ? mv.radius : 70;
          const yy = mv.style === 'shock' ? m.y : m.y - this.def.height * 0.7;
          scene.tweens.add({
            targets: o,
            k: 1,
            duration: mv.style === 'shock' ? 420 : 450,
            ease: 'Cubic.easeOut',
            onUpdate: () => {
              g.clear();
              g.lineStyle(7 * (1 - o.k) + 1.5, mv.style === 'shock' ? c : 0xffe9b0, 0.9 * (1 - o.k));
              g.strokeEllipse(m.x, yy, R * 2 * o.k + 10, (R * 2 * o.k + 10) * (mv.style === 'shock' ? 0.5 : 0.7));
            },
            onComplete: () => g.destroy(),
          });
        });
      }
      if (mv.style === 'shock') {
        smokeBurst(scene, m.x, m.y, { smokeColor: '#c8b48c', smokeCount: 10, smokeMs: 500 });
        scene.cameras.main.shake(220, 0.006);
      }
      if (mv.style === 'roar') scene.cameras.main.shake(400, 0.008);
    } else if (mv.style === 'smoke') {
      smokeBurst(scene, m.x, m.y - this.def.height * 0.4, { smokeColor: '#e8e2d6', smokeCount: 12, smokeMs: 500 });
    }
  }

  // 구미호의 꼬리 9개 그림자: 몸 뒤 반투명 어두운 꼬리가 부채꼴로 일렁임
  drawTails(m, dtMs) {
    const scene = this.sprite.scene;
    if (!this.tailsG) this.tailsG = scene.add.graphics();
    this.tailT = (this.tailT || 0) + dtMs;
    const g = this.tailsG;
    g.clear().setDepth(m.y - 0.02).setVisible(this.sprite.visible);
    const back = { up: Math.PI / 2, down: -Math.PI / 2, left: 0, right: Math.PI }[m.facing];
    const cx = this.sprite.x;
    const cy = m.y - this.def.height * 0.35;
    for (let i = 0; i < 9; i++) {
      const a = back + (i - 4) * 0.22 + Math.sin(this.tailT / 400 + i) * 0.06;
      const len = this.def.height * (0.75 + 0.1 * Math.sin(this.tailT / 300 + i * 1.7));
      g.fillStyle(0x1a1430, 0.28);
      g.fillEllipse(cx + Math.cos(a) * len * 0.5, cy + Math.sin(a) * len * 0.35, len, len * 0.22);
    }
  }

  // 맞았을 때 몸이 살짝 찌그러졌다 돌아옴(ms 동안). 바로 한 번 그려 둠(맞는 순간 멈춤 동안에도 보이게)
  squash(ms, sx, sy) {
    if (this.dead) return;
    this.squashing = { t: 0, ms, sx, sy };
    this.sprite.setScale(this.baseScale * sx, this.baseScale * sy);
  }

  // 쓰러뜨림(docs/spec/skills_impact.md 1): 하얗게 번쩍 → 맞은 방향으로 flyPx 튕겨 날아가며 조금 돌고 → 흰 연기 폭발 후 사라짐
  dieFly(dir, k, flashMs) {
    this.dead = true;
    if (this.tailsG) this.tailsG.setVisible(false);
    this.hpBar.set(0, 0, 0, false);
    this.flash(flashMs);
    const scene = this.sprite.scene;
    const s = this.sprite;
    const lift = s.displayHeight * (s.originY - 0.5);
    s.setOrigin(0.5, 0.5).setY(s.y - lift);
    const [dx, dy] = DIR[dir] || [0, 0];
    const turn = (dx < 0 || (dx === 0 && Math.random() < 0.5) ? -1 : 1) * k.spinDeg;
    scene.tweens.add({
      targets: s,
      x: s.x + dx * k.flyPx,
      y: s.y + dy * k.flyPx * 0.6 - 6,
      angle: turn,
      duration: k.flyMs,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        smokeBurst(scene, s.x, s.y, k);
        if (k.inkCount) inkBurst(scene, s.x, s.y, k);
        scene.tweens.add({ targets: s, alpha: 0, scale: s.scaleX * 0.6, duration: 120, onComplete: () => this.destroy() });
      },
    });
    scene.tweens.add({ targets: this.shadow, alpha: 0, duration: k.flyMs });
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

  // 분신이 쓰러지거나 사라짐: 연기로 사라짐(날아가지 않음)
  vanish() {
    this.dead = true;
    this.hpBar.set(0, 0, 0, false);
    smokeBurst(this.sprite.scene, this.sprite.x, this.sprite.y - this.def.height * 0.4, { smokeColor: '#e8e2d6', smokeCount: 10, smokeMs: 420 });
    this.destroy();
  }

  destroy() {
    if (this.tailsG) this.tailsG.destroy();
    this.hpBar.destroy();
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
