// 데미지 숫자: 맞은 자리 위로 떠오르며 흐려짐. 모양은 data/game.json의 hitFx.
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
  scene.tweens.add({
    targets: t,
    y: y - fx.floatPx,
    alpha: { from: 1, to: 0 },
    duration: fx.floatMs,
    ease: 'Cubic.easeOut',
    onComplete: () => t.destroy(),
  });
}
