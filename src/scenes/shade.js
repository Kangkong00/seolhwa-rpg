// 무예 시전 때 '나머지'를 어둡게 물들이기(docs/spec/feedback_1021.md 6).
// 바닥 맵 그림은 SkillCommonFx.dim(바닥 바로 위의 검은 막)이 어둡게 하고, 깊이 순으로 서는 것 중
// 물건 조각·NPC·이번 무예와 상관없는 몬스터·떨어진 물건은 같은 정도(k)로 물들여 앞뒤 가림 순서는 그대로 둠.
const TintModes = () => Phaser.TintModes;

// 색 c(0xRRGGBB)를 f배(0~1) 어둡게
export function shadeColor(c, f) {
  const r = Math.round(((c >> 16) & 255) * f);
  const g = Math.round(((c >> 8) & 255) * f);
  const b = Math.round((c & 255) * f);
  return (r << 16) | (g << 8) | b;
}

// 그림 하나를 k만큼 어둡게(k = 0이면 원래 색 base). base = 본디 물들임(없으면 흰색 = 그대로)
export function shadeImage(img, k, base = 0xffffff) {
  if (!img || !img.active || typeof img.setTint !== 'function') return;
  if (k <= 0) {
    if (base === 0xffffff) img.clearTint();
    else img.setTint(base);
    return;
  }
  img.setTint(shadeColor(base, 1 - k));
  if (img.setTintMode) img.setTintMode(TintModes().MULTIPLY);
}
