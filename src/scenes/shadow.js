// 발밑 반투명 타원 그림자. 가장자리가 부드러운 타원 그림 하나를 만들어 두고 크기만 바꿔 씀.
// 크기·진하기는 data/game.json의 shadow 항목.

const TEXTURE_KEY = 'shadow-ellipse';
const SIZE = 128;

function ensureTexture(scene, softness) {
  if (scene.textures.exists(TEXTURE_KEY)) return;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const r = SIZE / 2;
  // softness: 0 = 테두리가 또렷함, 1 = 가운데부터 흐려짐
  const solid = Math.max(0, Math.min(0.99, 1 - softness));
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(solid, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  scene.textures.addCanvas(TEXTURE_KEY, canvas);
}

// width·height: 맵 좌표 기준 그림자 크기, alpha: 진하기(0~1)
export function createShadow(scene, shadowCfg, width, height, alpha) {
  ensureTexture(scene, shadowCfg.softness);
  const color = Phaser.Display.Color.HexStringToColor(shadowCfg.color).color;
  return (
    scene.add
      .image(0, 0, TEXTURE_KEY)
      .setDisplaySize(width, height)
      .setTint(color)
      .setAlpha(alpha)
      // 땅 위(맵 바로 위)에 그려서, 지붕·나무 조각이 캐릭터를 가릴 때 그림자도 함께 가려짐
      .setDepth(-0.9)
  );
}

// 몬스터 그림자 크기: 몬스터 표시 키에 비례 (단계 3에서 몬스터를 띄울 때 사용)
export function createMonsterShadow(scene, shadowCfg, monsterHeight) {
  const m = shadowCfg.monster;
  return createShadow(scene, shadowCfg, monsterHeight * m.widthRatio, monsterHeight * m.heightRatio, m.alpha);
}
