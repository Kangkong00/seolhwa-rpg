// 주인공 그림 표시와 걷기 애니메이션.
// 프레임 순서: step → stand → step(다리 반전) → stand, 걷기 자세에서 몸을 살짝 띄움.

const WALK_SEQUENCE = ['step', 'stand', 'stepAlt', 'stand'];

export class PlayerView {
  constructor(scene, playerCfg, canvasSpec) {
    this.scene = scene;
    this.cfg = playerCfg;
    this.canvasSpec = canvasSpec;
    this.frames = null;
    this.walkTime = 0;
    this.sprite = scene.add.image(0, 0, '__DEFAULT');
    this.sprite.setOrigin(0.5, canvasSpec.footY / canvasSpec.height);
  }

  // textureScale: 원본 대비 텍스처 축소 비율
  setFrames(frames, textureScale) {
    this.frames = frames;
    const s = this.cfg.height / this.canvasSpec.standHeight / textureScale;
    this.sprite.setScale(s);
  }

  update(deltaMs, x, y, facing, moving) {
    if (!this.frames) return;
    const set = facing === 'up' ? this.frames.up : facing === 'down' ? this.frames.down : this.frames.side;

    let frameName = 'stand';
    let lift = 0;
    if (moving) {
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
    // 발 위치로 앞뒤 순서를 정함 (지붕 조각의 baseY와 비교됨)
    this.sprite.setDepth(y);
  }
}
