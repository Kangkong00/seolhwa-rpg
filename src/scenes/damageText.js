// 데미지 숫자: 맞은 자리 위로 떠오른 뒤 흐려짐. 모양·시간은 data/game.json의 hitFx
// (damageHoldMs 동안 그대로 보이며 떠오르고, damageFadeMs 동안 흐려짐).
export function showDamage(scene, x, y, amount, fx, pixelRatio) {
  const t = scene.add
    .text(x, y, String(amount), {
      fontFamily: '-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
      fontSize: `${fx.damageFontPx}px`,
      fontStyle: 'bold',
      color: fx.damageColor,
      stroke: fx.damageStroke,
      strokeThickness: 3,
    })
    .setOrigin(0.5, 1)
    .setResolution(pixelRatio * 2)
    .setDepth(1e6);
  scene.tweens.add({ targets: t, y: y - fx.floatPx, duration: fx.damageHoldMs, ease: 'Cubic.easeOut' });
  scene.tweens.add({
    targets: t,
    alpha: 0,
    delay: fx.damageHoldMs,
    duration: fx.damageFadeMs,
    onComplete: () => t.destroy(),
  });
}
