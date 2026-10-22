// 물건 시험(docs/spec/items_fix_1022.md 7) — 브라우저 없이 데이터와 규칙(src/core)만으로.
// ① 모든 전리품을 사 주는 가게가 적어도 하나(또는 anyShop) ② 장비 칸마다 값이 레벨 순으로 오름(같거나 큼)
// ③ 기다림 묶음 ④ 술 바뀜 ⑤ 산삼 10번 상한 — 문제가 있으면 끝에 "문제 N개"와 함께 실패
// 쓰는 법: node tools/test/items.mjs
import { readFileSync } from 'node:fs';
import { createUseState, tickUse, canUse, applyUse, drinkMul, groupLeft, onDeath } from '../../src/core/consumables.js';

const root = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root)));
const items = read('data/items.json').items;
const npcs = read('data/npcs.json').npcs;
const defs = Object.fromEntries(items.map((d) => [d.id, d]));
const problems = [];
const rows = [];
const ok = (name, cond, detail = '') => {
  rows.push(`| ${name} | ${cond ? '좋음' : '문제'} | ${detail} |`);
  if (!cond) problems.push(name);
};

// ① 전리품 사 주는 곳
const buyers = {};
for (const n of npcs) for (const id of (n.shop && n.shop.buys) || []) (buyers[id] = buyers[id] || []).push(n.name);
const loots = items.filter((d) => d.id.startsWith('loot_'));
const noBuyer = loots.filter((d) => !d.anyShop && !buyers[d.id]);
ok(`전리품 ${loots.length}개 — 사 주는 곳`, !noBuyer.length, noBuyer.length ? `없음: ${noBuyer.map((d) => d.name).join(', ')}` : '모두 있음(anyShop 포함)');

// ② 칸마다 장비 값이 레벨 순으로 오름(shopPrice.coins 또는 가게 price)
const priceOf = (d) => {
  for (const n of npcs) for (const g of (n.shop && n.shop.sells) || []) if (g.id === d.id && g.price) return g.price;
  return d.shopPrice && d.shopPrice.coins;
};
for (const slot of [...new Set(items.filter((d) => d.slot).map((d) => d.slot))]) {
  const list = items.filter((d) => d.slot === slot && priceOf(d)).map((d) => ({ d, lv: d.level || 1, p: priceOf(d) })).sort((a, b) => a.lv - b.lv || a.p - b.p);
  const bad = [];
  for (let i = 1; i < list.length; i++) if (list[i].lv > list[i - 1].lv && list[i].p < list[i - 1].p) bad.push(`${list[i - 1].d.name}(Lv${list[i - 1].lv} ${list[i - 1].p}) > ${list[i].d.name}(Lv${list[i].lv} ${list[i].p})`);
  ok(`${slot} ${list.length}개 — 값이 레벨 순`, !bad.length, bad.join('; ') || list.map((x) => `${x.lv}:${x.p}`).join(' '));
}

// ③ 기다림 묶음: 주먹밥(food 3초) 뒤 주먹밥은 막히고 탕약(med)은 됨, 3초 지나면 다시 됨
{
  const us = createUseState();
  const ctx = { level: 40, hp: 100, maxHp: 1000, sansamEaten: 0 };
  const a = canUse(us, defs.food_riceball, ctx).ok;
  applyUse(us, defs.food_riceball, ctx);
  const b = canUse(us, defs.food_riceball, ctx).ok;
  const c = canUse(us, defs.med_tangyak, ctx).ok;
  tickUse(us, 3000);
  const d = canUse(us, defs.food_riceball, ctx).ok;
  const lv = canUse(createUseState(), defs.drink_songsun, { ...ctx, level: 30 });
  ok('기다림 묶음', a && !b && c && d && groupLeft(us, 'food') === 0, `처음 ${a}, 바로 다시 ${b}, 다른 묶음 ${c}, 3초 뒤 ${d}`);
  ok('레벨 막힘', !lv.ok && lv.reason === '레벨 33부터', lv.reason);
  const r = applyUse(createUseState(), defs.food_riceball, { maxHp: 1660 });
  ok('주먹밥 = 최대 체력 15%', r.heal === Math.round(1660 * 0.15), `${r.heal}`);
}

// ④ 술 바뀜: 탁주 → 약주로 바뀌고 남은 시간도 새로, 쓰러지면 깸
{
  const us = createUseState();
  applyUse(us, defs.drink_takju, {});
  tickUse(us, 20000);
  const m1 = drinkMul(us);
  applyUse(us, defs.drink_yakju, {});
  const m2 = drinkMul(us);
  const left = us.drink.left;
  tickUse(us, 60000);
  const m3 = drinkMul(us);
  applyUse(us, defs.drink_takju, {});
  onDeath(us);
  ok('술 바뀜', m1 === 1.15 && m2 === 1.25 && left === 60000 && m3 === 1 && drinkMul(us) === 1, `탁주 ×${m1} → 약주 ×${m2}(남은 ${left / 1000}초) → 끝 ×${m3}, 쓰러지면 ×${drinkMul(us)}`);
}

// ⑤ 산삼 10번 상한(체력이 가득해도 상한 전에는 먹을 수 있음)
{
  const us = createUseState();
  let eaten = 0;
  let added = 0;
  for (let i = 0; i < 12; i++) {
    us.groups = {};
    const c = canUse(us, defs.med_sansam, { level: 1, hp: 1000, maxHp: 1000, sansamEaten: eaten });
    if (!c.ok) continue;
    const r = applyUse(us, defs.med_sansam, { maxHp: 1000, sansamEaten: eaten });
    if (r.maxHpAdd) { eaten++; added += r.maxHpAdd; }
  }
  ok('산삼 10번 상한', eaten === 10 && added === 400, `먹은 횟수 ${eaten}, 최대 체력 +${added}`);
  ok('산삼은 숨은 물건', defs.med_sansam.secret === true && !npcs.some((n) => ((n.shop && n.shop.sells) || []).some((g) => g.id === 'med_sansam')), '가게에서 팔지 않음');
}

console.log('| 시험 | 결과 | 자세히 |');
console.log('|---|---|---|');
console.log(rows.join('\n'));
console.log(problems.length ? `문제 ${problems.length}개: ${problems.join(', ')}` : '문제 없음');
process.exitCode = problems.length ? 1 : 0;
