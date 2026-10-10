// 주인공 그림 표시와 걷기 애니메이션.
// 프레임 순서: step → stand → step(다리 반전) → stand, 걷기 자세에서 몸을 살짝 띄움.
// 무기 휘두르기: raise(치켜들기) → strike(내려치기). 무기 그림은 쥐는 점을 자세 그림의 주먹 위치에 맞추고
// raise 각도 → strike 각도로 돌림 (data/weapons.json의 attach). 자세 그림은 640×720, 몸 가운데 x=320.

import { createShadow } from './shadow.js';
import { HpBar } from '../ui/hpBar.js';

const WALK_SEQUENCE = ['step', 'stand', 'stepAlt', 'stand'];
const POSE_CANVAS_CENTER_X = 320;
const POSE_CANVAS_WIDTH = 640;

// a → b 각도 보간(짧은 쪽으로 돎, 정확히 반대면 시계 방향)
function lerpAngle(a, b, t) {
  let d = ((b - a) % 360 + 540) % 360 - 180;
  if (d === -180) d = 180;
  return a + d * t;
}

export class PlayerView {
  constructor(scene, playerCfg, canvasSpec, shadowCfg, hpBarCfg) {
    this.scene = scene;
    this.cfg = playerCfg;
    this.canvasSpec = canvasSpec;
    this.frames = null;
    this.walkTime = 0;
    this.sprite = scene.add.image(0, 0, '__DEFAULT');
    this.sprite.setOrigin(0.5, canvasSpec.footY / canvasSpec.height);
    const sh = shadowCfg.player;
    this.shadow = createShadow(scene, shadowCfg, sh.width, sh.height, sh.alpha);
    this.shadowOffsetY = sh.offsetY || 0;
    this.hpBarCfg = hpBarCfg;
    this.hpBar = new HpBar(scene, hpBarCfg, hpBarCfg.playerColor);
    this.hpRatio = 1;
    this.weapon = null; // { def, key, canvas, attach, textureScale }
    this.weaponSprite = scene.add.image(0, 0, '__DEFAULT').setVisible(false);
  }

  // 무기 들기(null이면 맨손). attach: 이 옷의 무기 붙이는 값
  setWeapon(weapon) {
    this.weapon = weapon;
    if (!weapon) {
      this.weaponSprite.setVisible(false);
      return;
    }
    const c = weapon.canvas;
    this.weaponSprite.setTexture(weapon.key).setOrigin(c.gripX / c.width, c.gripY / c.height);
  }

  // 자세 그림의 점(px, py)을 맵 좌표로 (오른쪽을 보면 옆면 그림을 뒤집으므로 x도 뒤집음)
  posePoint(px, py, x, y, flip) {
    const unit = this.cfg.height / this.canvasSpec.standHeight;
    const cx = flip ? POSE_CANVAS_WIDTH - px : px;
    return { x: x + (cx - POSE_CANVAS_CENTER_X) * unit, y: y + (py - this.canvasSpec.footY) * unit };
  }

  // 지금 무기 모습: 쥐는 점·각도·세로 비율·뒤에 그릴지, 칼끝 위치
  // pose: 'raise' | 'strike', sweep: 내려치기에서 raise 각도 → strike 각도로 돈 정도(0~1)
  weaponGeometry(facing, pose, sweep, x, y) {
    const dirName = facing === 'up' ? 'back' : facing === 'down' ? 'front' : 'side';
    const a = this.weapon.attach;
    const raise = a[`${dirName}_raise`];
    const strike = a[`${dirName}_strike`];
    const flip = facing === 'right';
    const from = pose === 'raise' ? raise : strike;
    const angle0 = pose === 'raise' ? raise.angle : lerpAngle(raise.angle, strike.angle, sweep);
    const scaleY = pose === 'raise' ? raise.scaleY : raise.scaleY + (strike.scaleY - raise.scaleY) * sweep;
    const angle = flip ? -angle0 : angle0;
    const grip = this.posePoint(from.grip[0], from.grip[1], x, y, flip);
    const unit = this.cfg.height / this.canvasSpec.standHeight;
    const r = this.weapon.def.tipFromGrip * unit * scaleY;
    const rad = (angle * Math.PI) / 180;
    const tip = { x: grip.x + Math.sin(rad) * r, y: grip.y - Math.cos(rad) * r };
    return { grip, tip, angle, scaleY, behind: (pose === 'raise' ? raise : strike).behind };
  }

  setHp(ratio) {
    this.hpRatio = ratio;
  }

  // 물렸을 때: 붉게 번쩍
  flash(color, ms) {
    const c = Phaser.Display.Color.HexStringToColor(color).color;
    this.sprite.setTint(c).setTintMode(Phaser.TintModes.FILL);
    this.sprite.setAlpha(0.85);
    this.scene.time.delayedCall(ms, () => {
      if (this.sprite.active) this.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY).setAlpha(1);
    });
  }

  // textureScale: 원본 대비 텍스처 축소 비율
  setFrames(frames, textureScale) {
    this.frames = frames;
    const s = this.cfg.height / this.canvasSpec.standHeight / textureScale;
    this.sprite.setScale(s);
  }

  // punching: 주먹 자세(그 동안은 걷기 그림 대신 punch)
  // action: null | 'punch' | { pose: 'raise' | 'strike', sweep }
  update(deltaMs, x, y, facing, moving, action = null) {
    const punching = action === 'punch';
    const swing = action && typeof action === 'object' ? action : null;
    if (!this.frames) return;
    const set = facing === 'up' ? this.frames.up : facing === 'down' ? this.frames.down : this.frames.side;

    let frameName = 'stand';
    let lift = 0;
    if (swing) {
      frameName = swing.pose;
      this.walkTime = 0;
    } else if (punching) {
      frameName = 'punch';
      this.walkTime = 0;
    } else if (moving) {
      this.walkTime += deltaMs;
      const i = Math.floor(this.walkTime / this.cfg.walkFrameMs) % WALK_SEQUENCE.length;
      frameName = WALK_SEQUENCE[i];
      if (frameName !== 'stand') lift = this.cfg.stepLift;
    } else {
      this.walkTime = 0;
    }

    const key = set[frameName];
    if (this.sprite.texture.key !== key) this.sprite.setTexture(key);
    // side 그림은 왼쪽을 봄 → 오른쪽은 좌우 반전
    this.sprite.setFlipX(facing === 'right');
    this.sprite.setPosition(x, y - lift);
    // 그림자는 걷기 들썩임과 상관없이 발 위치에 둠
    this.shadow.setPosition(x, y + this.shadowOffsetY);
    // 발 위치로 앞뒤 순서를 정함 (지붕 조각의 baseY와 비교됨)
    this.sprite.setDepth(y);
    this.hpBar.set(x, y - this.cfg.height - this.hpBarCfg.gap, this.hpRatio);

    // 무기: 휘두를 때만 손에 보임
    if (swing && this.weapon) {
      const g = this.weaponGeometry(facing, swing.pose, swing.sweep, x, y - lift);
      const unit = this.cfg.height / this.canvasSpec.standHeight;
      const s = unit / this.weapon.textureScale;
      this.weaponSprite
        .setVisible(true)
        .setPosition(g.grip.x, g.grip.y)
        .setRotation((g.angle * Math.PI) / 180)
        .setScale(s, s * g.scaleY)
        .setDepth(y + (g.behind ? -0.01 : 0.01));
      this.lastWeapon = g;
    } else {
      this.weaponSprite.setVisible(false);
      this.lastWeapon = null;
    }
  }
}
