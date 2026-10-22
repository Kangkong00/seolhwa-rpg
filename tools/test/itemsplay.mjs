// 물건 쓰기 게임 안 시험(docs/spec/items_fix_1022.md 7): 브라우저로 약·술·산삼을 실제로 쓰고
// 맵 옮김·쓰러짐 뒤 술·기다림, 저장 → 불러오기 뒤 산삼 횟수·찾은 비밀·최대 체력을 봄.
// 쓰는 법: python3 -m http.server 8123 & 을 켠 뒤 node tools/test/itemsplay.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
await ctx.addInitScript(() => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.clear();
  localStorage.setItem('seolhwa-rpg:save:v1', JSON.stringify({ version: 1, map: 'dungeon_rat_1', x: 0, y: 0, facing: 'down', progress: { level: 30, exp: 0 },
    equipment: { equipped: { weapon: 'cloud_long', outfit: 'outfit1_hotot', head: '', arms: '', feet: '' }, bag: [], coins: 0 } }));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ready = async () => { await page.waitForFunction(() => document.getElementById('loading').classList.contains('hide'), null, { timeout: 30000 }); await page.waitForTimeout(1200); };
await page.goto('http://localhost:8123/');
await ready();
const rows = [];
const check = (name, cond, detail) => rows.push({ name, cond, detail });
const r = await page.evaluate(() => {
  const s = seolhwa.game.scene.getScene('map');
  const idx = (id) => s.equip.bag.findIndex((e) => e.id === id);
  s.equip.bag = [{ id: 'food_riceball', n: 5 }, { id: 'med_tangyak', n: 3 }, { id: 'drink_takju', n: 2 }, { id: 'drink_yakju', n: 1 }, { id: 'drink_songsun', n: 1 }, { id: 'med_sansam', n: 12 }];
  const o = {};
  s.player.hp = 100;
  const max = s.player.maxHp;
  s.useBagItem(idx('food_riceball'));
  o.rice = [s.player.hp - 100, Math.round(max * 0.15)];
  const hp = s.player.hp;
  s.useBagItem(idx('food_riceball'));
  o.riceAgain = [s.player.hp === hp, s.bagMessage];
  const a0 = s.stats().attack;
  s.useBagItem(idx('drink_takju'));
  const a1 = s.stats().attack;
  s.useBagItem(idx('drink_yakju'));
  o.drink = [a0, a1, s.stats().attack, s.d.useState.drink.id];
  s.useBagItem(idx('drink_songsun'));
  o.lv = s.bagMessage;
  const m0 = s.player.maxHp;
  for (let i = 0; i < 12; i++) { s.d.useState.groups = {}; s.useBagItem(idx('med_sansam')); }
  o.sansam = [m0, s.player.maxHp, s.d.sansamEaten, s.d.secretsFound.join(',')];
  s.save();
  return o;
});
check('주먹밥 15%', r.rice[0] === r.rice[1], `+${r.rice[0]} (최대 체력의 15% = ${r.rice[1]})`);
check('기다림 묶음(주먹밥 바로 다시)', r.riceAgain[0], r.riceAgain[1]);
check('술 바뀜·공격력', r.drink[1] === Math.round(r.drink[0] * 1.15) && r.drink[2] === Math.round(r.drink[0] * 1.25) && r.drink[3] === 'drink_yakju', `${r.drink[0]} → 탁주 ${r.drink[1]} → 약주 ${r.drink[2]}`);
check('레벨 막힘(송순주 33)', r.lv.includes('레벨 33부터'), r.lv);
check('산삼 10번 상한', r.sansam[2] === 10 && r.sansam[1] - r.sansam[0] === 400 && r.sansam[3] === 'sansam', `최대 체력 ${r.sansam[0]} → ${r.sansam[1]}, ${r.sansam[2]}번, 비밀 ${r.sansam[3]}`);
// 맵 옮김 → 술 그대로, 쓰러짐 → 술 끝
const m = await page.evaluate(async () => {
  const s = seolhwa.game.scene.getScene('map');
  const before = s.d.useState.drink && s.d.useState.drink.left;
  await new Promise((res) => { s.d.fetchMap('village').then((j) => s.travel('village', { ...j.spawn, facing: 'down' })); setTimeout(res, 2500); });
  const s2 = seolhwa.game.scene.getScene('map');
  const after = s2.d.useState.drink && s2.d.useState.drink.left;
  s2.die();
  await new Promise((res) => setTimeout(res, 3000));
  const s3 = seolhwa.game.scene.getScene('map');
  return { before, after, dead: s3.d.useState.drink, map: s3.d.mapId };
});
check('맵 옮김 뒤 술', m.after > 0 && m.after <= m.before, `${Math.round(m.before / 1000)}초 → ${Math.round(m.after / 1000)}초`);
check('쓰러진 뒤 술', m.dead === null, String(m.dead));
// 저장 → 불러오기
await page.evaluate(() => seolhwa.game.scene.getScene('map').save());
await page.reload();
await ready();
const l = await page.evaluate(() => { const s = seolhwa.game.scene.getScene('map'); return [s.d.sansamEaten, s.d.secretsFound.join(','), s.player.maxHp, s.player.hp]; });
check('저장 후 불러오기', l[0] === 10 && l[1] === 'sansam' && l[2] === r.sansam[1] && l[3] <= l[2], `산삼 ${l[0]}번, 비밀 ${l[1]}, 체력 ${l[3]}/${l[2]}`);
console.log('| 시험 | 결과 | 자세히 |');
console.log('|---|---|---|');
for (const x of rows) console.log(`| ${x.name} | ${x.cond ? '좋음' : '문제'} | ${x.detail} |`);
const bad = rows.filter((x) => !x.cond).length + errors.length;
console.log(errors.length ? errors.join('\n') : '오류 없음');
console.log(bad ? `문제 ${bad}개` : '문제 없음');
await browser.close();
process.exitCode = bad ? 1 : 0;
