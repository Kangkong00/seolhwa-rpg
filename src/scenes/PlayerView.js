// 주인공 그림 표시와 걷기 애니메이션.
// 맨손: step → stand → step(다리 반전) → stand, 걷기 자세에서 몸을 살짝 띄움.
// 무기를 들면 몸 그림을 hold(서 있기)·hold_step(걷기)으로 바꾸고 무기를 늘 손에 쥠.
// 무기 방향은 3D로 계산해 화면에 투영(weaponPose.js), 쥐는 점은 지금 보이는 몸 그림의 주먹에 고정.
// 그리는 순서: (칼이 몸 뒤면 칼) → 몸 → (칼이 몸 앞이면 칼) → 손 덮개(주먹만 오린 그림).
// 자세 그림(punch·hold·raise·strike)은 640×720, 몸 가운데 x=320.

import { createShadow } from './shadow.js';
import { HpBar } from '../ui/hpBar.js';
import { projectWeapon } from './weaponPose.js';

const WALK_SEQUENCE = ['step', 'stand', 'stepAlt', 'stand'];
const HOLD_WALK_SEQUENCE = ['holdStep', 'hold', 'holdStepAlt', 'hold'];
const POSE_CANVAS_CENTER_X = 320;
const POSE_CANVAS_WIDTH = 640;
const DIR_NAME = { down: 'front', up: 'back', left: 'side', right: 'side' };
// 몸 그림 이름 → data/weapons.json attach 의 자세 이름
const ATTACH_POSE = { hold: 'hold', holdStep: 'hold_step', holdStepAlt: 'hold_step', raise: 'raise', strike: 'strike' };

export class PlayerView {
  constructor(scene, playerCfg, canvasSpec, shadowCfg, hpBarCfg) {
    this.scene = scene;
    this.cfg = playerCfg;
    this.canvasSpec = canvasSpec;
    this.frames = null;
    this.walkTime = 0;
    this.sprite = scene.add.image(0, 0, '__DEFAULT');
    this.sprite.setOrigin(0.5, canvasSpec.footY / canvasSpec.height);
    // 손 덮개: 몸과 같은 자리·크기로 맨 위에
    this.hand = scene.add.image(0, 0, '__DEFAULT').setOrigin(0.5, canvasSpec.footY / canvasSpec.height).setVisible(false);
    const sh = shadowCfg.player;
    this.shadow = createShadow(scene, shadowCfg, sh.width, sh.height, sh.alpha);
    this.shadowOffsetY = sh.offsetY || 0;
    this.hpBarCfg = hpBarCfg;
    this.hpBar = new HpBar(scene, hpBarCfg, hpBarCfg.playerColor);
    this.hpRatio = 1;
    this.weapon = null; // { def, key, canvas, attach, swing, textureScale }
    this.weaponSprite = scene.add.image(0, 0, '__DEFAULT').setVisible(false);
    this.lastWeapon = null;
  }

  // 무기 들기(null이면 맨손). attach: 이 옷의 쥐는 점, swing: data/weapons.json swing
  setWeapon(weapon) {
    this.weapon = weapon;
    if (!weapon) {
      this.weaponSprite.setVisible(false);
      this.hand.setVisible(false);
      return;
    }
    const c = weapon.canvas;
    this.weaponSprite.setTexture(weapon.key).setOrigin(c.gripX / c.width, c.gripY / c.height);
  }

  unit() {
    return this.cfg.height / this.canvasSpec.standHeight;
  }

  // 자세 그림의 점(px, py)을 맵 좌표로 (오른쪽을 보면 옆면 그림을 뒤집으므로 x도 뒤집음)
  posePoint(px, py, x, y, flip) {
    const unit = this.unit();
    const cx = flip ? POSE_CANVAS_WIDTH - px : px;
    return { x: x + (cx - POSE_CANVAS_CENTER_X) * unit, y: y + (py - this.canvasSpec.footY) * unit };
  }

  // 무기 모습: 몸 그림(pose)의 주먹에 쥐는 점을 고정하고, theta·lat로 방향을 투영
  // 반환: { grip, tip, angle, length, behind }
  weaponGeometry(facing, pose, theta, lat, x, y) {
    const a = this.weapon.attach[ATTACH_POSE[pose]][DIR_NAME[facing]];
    const grip = this.posePoint(a.grip[0], a.grip[1], x, y, facing === 'right');
    const pr = projectWeapon(facing, theta, lat, this.weapon.swing.depthK);
    const r = this.weapon.def.tipFromGrip * this.unit() * pr.length;
    const rad = (pr.angle * Math.PI) / 180;
    const tip = { x: grip.x + Math.sin(rad) * r, y: grip.y - Math.cos(rad) * r };
    return { grip, tip, angle: pr.angle, length: pr.length, behind: pr.behind };
  }

  // 휘두르는 중 theta에서 보이는 몸 그림 (bodySwitchTheta까지 raise, 그 뒤 strike)
  swingPose(theta) {
    return theta < this.weapon.swing.bodySwitchTheta ? 'raise' : 'strike';
  }

  // 휘두르기 lat (정면·뒷면 / 옆면)
  swingLat(facing) {
    const s = this.weapon.swing;
    return facing === 'left' || facing === 'right' ? s.latSide : s.latFrontBack;
  }

  setHp(ratio) {
    this.hpRatio = ratio;
  }

  // 물렸을 때: 붉게 번쩍
  flash(color, ms) {
    const c = Phaser.Display.Color.HexStringToColor(color).color;
    for (const sp of [this.sprite, this.hand]) sp.setTint(c).setTintMode(Phaser.TintModes.FILL).setAlpha(0.85);
    this.scene.time.delayedCall(ms, () => {
      for (const sp of [this.sprite, this.hand]) {
        if (sp.active) sp.clearTint().setTintMode(Phaser.TintModes.MULTIPLY).setAlpha(1);
      }
    });
  }

  // textureScale: 원본 대비 텍스처 축소 비율
  setFrames(frames, textureScale) {
    this.frames = frames;
    const s = this.cfg.height / this.canvasSpec.standHeight / textureScale;
    this.sprite.setScale(s);
    this.hand.setScale(s);
  }

  // action: null | 'punch' | { theta } (무기 휘두르는 중)
  update(deltaMs, x, y, facing, moving, action = null) {
    if (!this.frames) return;
    const punching = action === 'punch';
    const swing = action && typeof action === 'object' && this.weapon ? action : null;
    const holding = !!this.weapon && !punching;
    const set = facing === 'up' ? this.frames.up : facing === 'down' ? this.frames.down : this.frames.side;

    let frameName = holding ? 'hold' : 'stand';
    let lift = 0;
    if (swing) {
      frameName = this.swingPose(swing.theta);
      this.walkTime = 0;
    } else if (punching) {
      frameName = 'punch';
      this.walkTime = 0;
    } else if (moving) {
      this.walkTime += deltaMs;
      const seq = holding ? HOLD_WALK_SEQUENCE : WALK_SEQUENCE;
      const i = Math.floor(this.walkTime / this.cfg.walkFrameMs) % seq.length;
      frameName = seq[i];
      if (frameName !== 'stand' && frameName !== 'hold') lift = this.cfg.stepLift;
    } else {
      this.walkTime = 0;
    }

    const key = set[frameName];
    const flip = facing === 'right';
    if (this.sprite.texture.key !== key) this.sprite.setTexture(key);
    // side 그림은 왼쪽을 봄 → 오른쪽은 좌우 반전
    this.sprite.setFlipX(flip);
    this.sprite.setPosition(x, y - lift);
    // 그림자는 걷기 들썩임과 상관없이 발 위치에 둠
    this.shadow.setPosition(x, y + this.shadowOffsetY);
    // 발 위치로 앞뒤 순서를 정함 (지붕 조각의 baseY와 비교됨)
    this.sprite.setDepth(y);
    this.hpBar.set(x, y - this.cfg.height - this.hpBarCfg.gap, this.hpRatio);

    // 무기: 들고 있으면 늘 손에. 걷는 동안 몸이 들썩이는 만큼 같이 (쥐는 점을 y - lift 기준으로)
    if (holding) {
      let theta;
      let lat;
      if (swing) {
        theta = swing.theta;
        lat = this.swingLat(facing);
      } else {
        const a = this.weapon.attach[ATTACH_POSE[frameName]][DIR_NAME[facing]];
        theta = a.theta;
        lat = a.lat;
      }
      const g = this.weaponGeometry(facing, frameName, theta, lat, x, y - lift);
      const s = this.unit() / this.weapon.textureScale;
      this.weaponSprite
        .setVisible(true)
        .setPosition(g.grip.x, g.grip.y)
        .setRotation((g.angle * Math.PI) / 180)
        .setScale(s, s * g.length)
        .setDepth(y + (g.behind ? -0.02 : 0.01));
      this.lastWeapon = g;
      // 손 덮개: 맨 위 (다리 반전 걷기 프레임도 반전하지 않은 덮개 그대로)
      const handKey = set.hand && set.hand[frameName];
      if (handKey) {
        if (this.hand.texture.key !== handKey) this.hand.setTexture(handKey);
        this.hand.setVisible(true).setFlipX(flip).setPosition(x, y - lift).setDepth(y + 0.02);
      } else {
        this.hand.setVisible(false);
      }
    } else {
      this.weaponSprite.setVisible(false);
      this.hand.setVisible(false);
      this.lastWeapon = null;
    }
  }
}
