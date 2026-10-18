// 데미지·회복 숫자(docs/spec/feedback_1015.md 2). 모양·시간은 data/game.json의 hitFx.
// kind: 'hit'(몬스터가 맞음, 흰색) · 'skill'(무예로 맞음, 금색 크게) · 'crit'(회심, 금색 더 크게 + 위에 작은 "회심!") · 'player'(주인공이 맞음, 빨강) · 'heal'(회복 "+n", 초록)
// 뜰 때 popMs 동안 popScale배 → 1배로 톡 튀고, 위로 떠오르며 damageHoldMs 뒤 damageFadeMs 동안 흐려짐.
// spreadMs 안에 가까운 자리에 여러 개가 뜨면 좌우로 ±spreadPx 흩뜨려 겹치지 않게.
const recent = []; // { x, y, at, n }

export function showDamage(scene, x, y, amount, fx, pixelRatio, kind = 'hit') {
  const style = (fx.numbers && fx.numbers[kind]) || { fontPx: 22, color: '#ffffff' };
  const now = scene.time.now;
  for (let i = recent.length - 1; i >= 0; i--) if (now - recent[i].at > fx.spreadMs) recent.splice(i, 1);
  const near = recent.filter((r) => Math.abs(r.x - x) < 30 && Math.abs(r.y - y) < 30).length;
  const dx = near ? (near % 2 ? 1 : -1) * fx.spreadPx * Math.ceil(near / 2) : 0;
  recent.push({ x, y, at: now });
  const font = '-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const make = (text, px, yy) => scene.add
    .text(x + dx, yy, text, {
      fontFamily: font,
      fontSize: `${px}px`,
      fontStyle: 'bold',
      color: style.color,
      stroke: fx.damageStroke,
      strokeThickness: fx.strokePx,
    })
    .setOrigin(0.5, 1)
    .setResolution(pixelRatio * 2)
    .setDepth(1e6)
    .setScale(fx.popScale);
  const texts = [make(kind === 'heal' ? `+${amount}` : String(amount), style.fontPx, y)];
  if (style.label) texts.push(make(style.label, style.labelPx || 14, y - style.fontPx * 0.95));
  for (const t of texts) {
    const y0 = t.y;
    scene.tweens.add({ targets: t, scale: 1, duration: fx.popMs, ease: 'Quad.easeOut' });
    scene.tweens.add({ targets: t, y: y0 - fx.floatPx, duration: fx.damageHoldMs + fx.damageFadeMs, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: t, alpha: 0, delay: fx.damageHoldMs, duration: fx.damageFadeMs, onComplete: () => t.destroy() });
  }
}
