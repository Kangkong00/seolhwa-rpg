// 무예 데미지 시험(docs/spec/feedback_1022.md 1): 움직이지 않는 몬스터 하나에 액티브 무예를 하나씩 써서
// 맞힌 횟수·한 번 숫자·합계·평타 한 대 대비를 표로. 회심은 끔.
// 쓰는 법: python3 -m http.server 8123 & 를 켠 뒤 node tools/test/skilldmg.mjs [맵] [레벨] [무기] [몬스터]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [map = 'dungeon_raccoon_1', level = '27', weapon = 'steel_hwando', mon = ''] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
await ctx.addInitScript(([map, level, weapon]) => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.clear();
  localStorage.setItem('seolhwa-rpg:save:v1', JSON.stringify({ version: 1, map, x: 0, y: 0, facing: 'right', progress: { level: Number(level), exp: 0 },
    equipment: { equipped: { weapon, outfit: 'outfit1_hotot', head: '', arms: '', feet: '' }, bag: [], coins: 0 } }));
}, [map, level, weapon]);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8123/');
await page.waitForFunction(() => document.getElementById('loading').classList.contains('hide'), null, { timeout: 30000 });
await page.waitForTimeout(1200);
const ids = await page.evaluate((mon) => {
  const s = seolhwa.game.scene.getScene('map');
  s.spawner.update = () => ({ born: [], bites: [], gone: [] }); // 몬스터를 멈춤
  s.cfg.impact.crit.chance = 0;
  s.d.admin.noDie = true;
  window.__type = mon || s.map.spawnZones[0].monster;
  for (const sk of s.skills) if (sk.type !== 'passive' && !s.learned.includes(sk.id)) s.learned.push(sk.id); // 패시브(회심·공격력 +)는 빼고
  const wrap = s.impactHit.bind(s);
  window.__log = [];
  s.impactHit = (t, d, dmg, o) => { const r = wrap(t, d, dmg, o); window.__log.push(r.damage); return r; };
  return s.skills.filter((k) => k.type !== 'passive' && k.kind !== 'heal').map((k) => k.id); // 숨 고르기(회복)는 뺌
}, mon);
// 몬스터 하나를 주인공 오른쪽 28px에 세움(체력 아주 큼)
const fresh = () => page.evaluate(() => {
  const s = seolhwa.game.scene.getScene('map');
  for (const m of [...s.spawner.monsters]) { s.monsterViews.get(m.id)?.destroy(); s.monsterViews.delete(m.id); }
  s.spawner.monsters = [];
  const sp = s.map.spawn;
  s.pos.x = sp.x; s.pos.y = sp.y; s.facing = 'right';
  const zi = Math.max(0, s.map.spawnZones.findIndex((z) => z.monster === window.__type));
  const m = s.spawner.spawn(zi);
  m.type = window.__type; m.x = s.pos.x + 28; m.y = s.pos.y; m.hp = m.maxHp = 1e9; m.state = 'rest'; m.timer = 1e9; m.facing = 'left';
  s.addMonsterView(m);
  s.cooldowns.left = {}; s.act = null; s.spin = null; s.swing = null; s.attackCooldown = 0;
  window.__log = [];
});
// 평타 한 대
await fresh();
await page.evaluate(() => seolhwa.game.scene.getScene('map').attackWithAssist(null));
await page.waitForTimeout(1500);
const basic = await page.evaluate(() => window.__log[0] || 0);
const rows = [];
for (const id of ids) {
  await fresh();
  await page.waitForTimeout(200);
  await page.evaluate((id) => seolhwa.game.scene.getScene('map').useSkill(id), id);
  if (id === 'counter') {
    await page.waitForTimeout(150);
    await page.evaluate(() => { const s = seolhwa.game.scene.getScene('map'); s.onBitten({ monster: s.spawner.monsters[0], damage: 1, dir: 'left' }); });
  }
  // 오래 걸리는 무예가 끝날 때까지(게임 시간이 느리므로 넉넉히)
  await page.waitForFunction(() => { const s = seolhwa.game.scene.getScene('map'); return !s.act && !s.spin && !s.swing && !s.chainNext; }, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const log = await page.evaluate(() => window.__log.slice());
  const sum = log.reduce((a, b) => a + b, 0);
  rows.push({ id, n: log.length, one: log.length ? Math.round(Math.max(...log)) : 0, min: log.length ? Math.round(Math.min(...log)) : 0, sum: Math.round(sum), vs: basic ? (sum / basic).toFixed(1) : '-' });
}
console.log(`평타 한 대: ${basic} (맵 ${map}, 레벨 ${level}, 무기 ${weapon}, 몬스터 ${await page.evaluate(() => window.__type)})`);
console.log('| 무예 | 맞힌 횟수 | 한 번 숫자(최소~최대) | 합계 | 평타 대비 |');
console.log('|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.id} | ${r.n} | ${r.min === r.one ? r.one : `${r.min}~${r.one}`} | ${r.sum} | ×${r.vs} |`);
const bad = rows.filter((r) => !r.n || r.min < basic);
console.log(bad.length ? `문제: ${bad.map((r) => r.id).join(', ')}` : '문제 없음');
console.log(errors.length ? errors.join('\n') : '오류 없음');
await browser.close();
