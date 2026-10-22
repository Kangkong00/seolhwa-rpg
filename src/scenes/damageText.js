// 데미지·회복 숫자(docs/spec/feedback_1015.md 2). 모양·시간은 data/game.json의 hitFx.
// kind: 'hit'(몬스터가 맞음, 흰색) · 'skill'(무예로 맞음, 금색 크게) · 'crit'(회심, 금색 더 크게 + 위에 작은 "회심!") · 'player'(주인공이 맞음, 빨강) · 'heal'(회복 "+n", 초록)
// 뜰 때 popMs 동안 popScale배 → 1배로 톡 튀고, 위로 떠오르며 damageHoldMs 뒤 damageFadeMs 동안 흐려짐.
// spreadMs 안에 가까운 자리에 여러 개가 뜨면 좌우로 ±spreadPx 흩뜨려 겹치지 않게.
import { formatNum } from '../ui/format.js';
const recent = []; // { x, y, at, n }

// opt: { scale: 글자 크기 배율, stroke: 테두리 색 } — 무예로 맞힌 숫자는 1.3배 + 무예 색 테두리(docs/spec/feedback_1020.md 5)
export function showDamage(scene, x, y, amount, fx, pixelRatio, kind = 'hit', opt = null) {
  const base = (fx.numbers && fx.numbers[kind]) || { fontPx: 22, color: '#ffffff' };
  const style = opt && opt.scale ? { ...base, fontPx: Math.round(base.fontPx * opt.scale) } : base;
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
      stroke: (opt && opt.stroke) || fx.damageStroke,
      strokeThickness: fx.strokePx,
    })
    .setOrigin(0.5, 1)
    .setResolution(pixelRatio * 2)
    .setDepth(1e6)
    .setScale(fx.popScale);
  const texts = [make(kind === 'heal' ? `+${formatNum(amount)}` : formatNum(amount), style.fontPx, y)]; // 1,000이 넘으면 쉼표
  if (style.label) texts.push(make(style.label, style.labelPx || 14, y - style.fontPx * 0.95));
  for (const t of texts) {
    const y0 = t.y;
    scene.tweens.add({ targets: t, scale: 1, duration: fx.popMs, ease: 'Quad.easeOut' });
    scene.tweens.add({ targets: t, y: y0 - fx.floatPx, duration: fx.damageHoldMs + fx.damageFadeMs, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: t, alpha: 0, delay: fx.damageHoldMs, duration: fx.damageFadeMs, onComplete: () => t.destroy() });
  }
}
