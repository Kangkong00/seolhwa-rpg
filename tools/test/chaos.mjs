// 무작위 자동 시험(docs/spec/feedback_1022.md 10): 레벨 40 + 무예 모두 배우고, 정해진 시간 동안
// 무작위로 걷기·평타·무예 13개·물건 쓰기(약·술·산삼)·맵 옮기기·맞기(가끔 쓰러짐)를 섞어 돌림.
// 1초마다 ① 화면 글자 수 ② 체력·공격력·기다림·몬스터 값이 NaN·음수·무한대인지 ③ 콘솔 오류·경고를 기록해 표로.
// 프레임마다 모든 몬스터 발 상자가 바닥(설 수 있는 자리) 위인지도 셈(docs/spec/feedback_1023.md 4).
// 쓰는 법: python3 -m http.server 8123 & 을 켠 뒤 node tools/test/chaos.mjs [초=120] [씨앗=1] [맵,맵…]
//   맵을 주면 그 맵들만 오가고, 쓰러지지 않게(관리자 '안 죽기') 그 맵에 머묾 — 예: node tools/test/chaos.mjs 120 1 dungeon_fox_1
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const SEC = Number(process.argv[2] || 120);
let seed = Number(process.argv[3] || 1);
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const ONLY = process.argv[4] ? process.argv[4].split(',') : null; // 이 맵들만 오가며(예: dungeon_fox_1,dungeon_fox_2)
const MAPS = ONLY || ['dungeon_rat_1', 'dungeon_snake_1', 'dungeon_raccoon_1', 'dungeon_tiger_1', 'village', 'dungeon_fox_2', 'back_mountain'];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const START = ONLY ? ONLY[0] : 'dungeon_rat_1';
await ctx.addInitScript((START) => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.clear();
  localStorage.setItem('seolhwa-rpg:save:v1', JSON.stringify({ version: 1, map: START, x: 0, y: 0, facing: 'down', progress: { level: 40, exp: 0 },
    equipment: { equipped: { weapon: 'seven_star', outfit: 'outfit1_hotot', head: '', arms: '', feet: '' }, bag: [], coins: 0 } }));
}, START);
const page = await ctx.newPage();
if (ONLY) await page.addInitScript(() => { window.__only = true; });
const errors = [];
const warns = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !t.includes('404') && !t.includes('Failed to load resource')) errors.push(t);
  if (m.type() === 'warning' && t.startsWith('[감시]')) warns.push(t);
});
await page.goto('http://localhost:8123/');
await page.waitForFunction(() => document.getElementById('loading').classList.contains('hide'), null, { timeout: 30000 });
await page.waitForTimeout(1200);
// 관리자: 무예 모두 배우기 → 칸 채우기 1~8, 입력은 시험이 정한 방향으로
await page.tap('#btn-admin');
await page.locator('#admin-panel button', { hasText: '모두 배우기' }).click();
await page.locator('#admin-panel button', { hasText: '닫기' }).click();
// 프레임마다 모든 몬스터 발 상자(bodyBox = def.footBox)가 설 수 있는 자리인지(docs/spec/feedback_1023.md 4, 여우불 같은 날아가는 것은 몬스터가 아님)
await page.evaluate(async () => {
  const { isStandable } = await import('/src/core/movement.js');
  window.__offFloor = { frames: 0, bad: 0, list: [] };
  const fn = () => {
    const s = seolhwa.game.scene.getScene('map');
    if (!s || !s.spawner || !s.map || s.transitioning) return;
    window.__offFloor.frames++;
    for (const m of s.spawner.monsters) {
      const def = s.monsterDefs[m.type];
      if (!isStandable(s.map.grid, m.x, m.y, def.footBox)) {
        window.__offFloor.bad++;
        if (window.__offFloor.list.length < 10) window.__offFloor.list.push(`${s.d.mapId} ${m.type} (${Math.round(m.x)},${Math.round(m.y)})`);
      }
    }
  };
  // 맵을 옮기면(장면 다시 시작) 듣기가 빠질 수 있어 0.1초마다 확인해 한 번만 붙임
  const hook = () => {
    const s = seolhwa.game.scene.getScene('map');
    if (s && s.events && !s.events.listeners('postupdate').includes(fn)) s.events.on('postupdate', fn);
  };
  setInterval(hook, 100);
  hook();
});
await page.evaluate(() => {
  const s = seolhwa.game.scene.getScene('map');
  window.__vec = { x: 0, y: 0 };
  if (window.__only) s.d.admin.noDie = true; // 맵을 정해 돌릴 때는 쓰러져 마을로 가지 않게
  s.d.input.getVector = () => window.__vec;
});
const act = (name, arg) => page.evaluate(([name, arg]) => {
  const s = seolhwa.game.scene.getScene('map');
  if (!s || !s.pos || s.transitioning) return 'busy';
  const active = s.skills.filter((k) => k.type !== 'passive').map((k) => k.id);
  switch (name) {
    case 'walk': window.__vec = arg; return 'walk';
    case 'attack': s.attackButton.pressedOnce = true; return 'attack';
    case 'skill': { const id = active[Math.floor(arg * active.length)]; s.cooldowns.left[id] = 0; s.useSkill(id); return `skill:${id}`; }
    case 'item': {
      // 약·술·산삼(docs/spec/items_fix_1022.md): 기다림 묶음에 걸리면 안 쓰이는 것도 그대로 섞음
      const pool = ['food_riceball', 'med_tangyak', 'med_insam', 'med_nogyong', 'drink_takju', 'drink_yakju', 'drink_songsun', 'med_sansam'];
      const id = pool[Math.floor(arg * pool.length)];
      if (!s.itemDefs[id]) return 'noitem';
      if (!s.equip.bag.some((e) => e.id === id)) s.equip.bag.push({ id, n: 3 });
      s.player.hp = Math.max(1, Math.floor(s.player.hp * 0.5));
      s.useBagItem(s.equip.bag.findIndex((e) => e.id === id));
      return `item:${id}`;
    }
    case 'hurt': s.onBitten({ monster: s.spawner.monsters[0] || null, damage: Math.round(arg * s.player.maxHp * 0.6), dir: 'left' }); return 'hurt';
    case 'map': { const id = arg; s.d.fetchMap(id).then((j) => s.travel(id, { ...j.spawn, facing: 'down' })); return `map:${id}`; }
    default: return '?';
  }
}, [name, arg]).catch((e) => `err:${e.message}`);
const samples = [];
const counts = {};
const t0 = Date.now();
let nextSample = 0;
while (Date.now() - t0 < SEC * 1000) {
  const r = rng();
  let res;
  if (r < 0.3) res = await act('walk', [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 0, y: 0 }][Math.floor(rng() * 5)]);
  else if (r < 0.55) res = await act('attack');
  else if (r < 0.85) res = await act('skill', rng());
  else if (r < 0.92) res = await act('item', rng());
  else if (r < 0.97) res = await act('hurt', rng());
  else res = await act('map', MAPS[Math.floor(rng() * MAPS.length)]);
  const k = String(res).split(':')[0];
  counts[k] = (counts[k] || 0) + 1;
  await page.waitForTimeout(120 + rng() * 200);
  if (Date.now() - t0 >= nextSample) {
    nextSample += 1000;
    const snap = await page.evaluate(() => {
      const s = seolhwa.game.scene.getScene('map');
      if (!s || !s.children) return null;
      const texts = s.children.list.filter((o) => o.type === 'Text' && o.visible).length;
      const st = s.stats ? s.stats() : {};
      const nums = { hp: s.player && s.player.hp, maxHp: s.player && s.player.maxHp, attack: st.attack, cooldownMul: st.cooldownMul,
        cd: Math.min(0, ...Object.values((s.cooldowns && s.cooldowns.left) || {})), mon: (s.spawner ? s.spawner.monsters : []).filter((m) => !Number.isFinite(m.hp) || !Number.isFinite(m.x)).length };
      const bad = Object.entries(nums).filter(([k, v]) => (k === 'mon' ? v > 0 : typeof v !== 'number' || !Number.isFinite(v) || (k !== 'cd' && v < 0))).map(([k, v]) => `${k}=${v}`);
      return { map: s.d.mapId, texts, bad, hp: s.player && s.player.hp };
    }).catch(() => null);
    if (snap) samples.push(snap);
  }
}
const watch = await page.evaluate(() => window.__devWatch || {}).catch(() => ({}));
const maxTexts = Math.max(0, ...samples.map((x) => x.texts));
const avgTexts = samples.length ? (samples.reduce((a, x) => a + x.texts, 0) / samples.length).toFixed(1) : 0;
const badSamples = samples.filter((x) => x.bad.length);
console.log(`무작위 시험 ${SEC}초(씨앗 ${process.argv[3] || 1}) — 동작 ${JSON.stringify(counts)}, 지나간 맵 ${[...new Set(samples.map((x) => x.map))].join(' ')}`);
console.log('| 항목 | 결과 |');
console.log('|---|---|');
console.log(`| 화면 글자 수(1초마다 잰 것) | 최대 ${maxTexts}개, 평균 ${avgTexts}개 |`);
console.log(`| 1초에 새로 생긴 글자(감시) | 최대 ${watch.maxTextsPerSec ?? '-'}개 |`);
console.log(`| NaN·음수·무한대 | ${badSamples.length ? `${badSamples.length}번: ${[...new Set(badSamples.flatMap((x) => x.bad))].join(', ')}` : '0번'} |`);
console.log(`| 감시 경고 | ${warns.length ? [...new Set(warns)].join(' / ') : '0개'} |`);
const floor = await page.evaluate(() => window.__offFloor).catch(() => ({ frames: 0, bad: 0, list: [] }));
console.log(`| 몬스터 발이 바닥 밖(프레임마다) | ${floor.bad}건 / ${floor.frames.toLocaleString('en-US')}프레임${floor.list.length ? `: ${floor.list.join(', ')}` : ''} |`);
console.log(`| 콘솔 오류 | ${errors.length ? [...new Set(errors)].slice(0, 8).join(' / ') : '0개'} |`);
await browser.close();
process.exitCode = errors.length || badSamples.length || warns.length || floor.bad ? 1 : 0;
