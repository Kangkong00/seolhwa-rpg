// 무예 숙련 게임 안 시험(docs/spec/feedback_1024.md 4): 레벨 20(구간 4)에서 호통(둘레 무예)으로
// ① 세 마리를 한 번에 맞혀도 1 ② 낮은 구간(들쥐) 안 셈·우두머리(곳간 쥐왕) 셈·분신 안 셈 ③ 19 → 20번에 2등급 + 머리 위 "숙련 2" 글자
// ④ 10등급 데미지 ×1.45·기다림 ×0.82 ⑤ 무예창 등급 표시·관리자 등급 정하기 ⑥ 저장 → 다시 열기(skillMastery·skillsEverLearned)
// 쓰는 법: python3 -m http.server 8123 & 을 켠 뒤 node tools/test/masteryplay.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
await ctx.addInitScript(() => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.clear();
  localStorage.setItem('seolhwa-rpg:save:v1', JSON.stringify({ version: 1, map: 'dungeon_rat_1', x: 690, y: 400, facing: 'down', progress: { level: 20, exp: 0 },
    skills: ['roar', 'breath'], skillSlots: ['roar', 'breath'], equipment: { equipped: { weapon: 'wood_pine', outfit: 'outfit1_hotot', head: '', arms: '', feet: '' }, bag: [], coins: 0 } }));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const boot = async () => {
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('hide'), null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const s = seolhwa.game.scene.getScene('map');
    s.spawner.update = () => ({ born: [], bites: [] });
    s.cfg.impact.crit.chance = 0; // 회심 없이(데미지 비교)
    window.__s = s;
    // (type, dx, dy, opts) 자리에 몬스터를 세움
    window.put = (type, dx, dy, o = {}) => {
      let zi = s.map.spawnZones.findIndex((z) => z.monster === type);
      if (zi < 0) { s.map.spawnZones.push({ monster: type, count: 0, respawnMs: 1e9, x: 0, y: 0, w: s.map.width, h: s.map.height }); s.spawner.timers.push(0); zi = s.map.spawnZones.length - 1; }
      const m = s.spawner.spawn(zi);
      m.x = s.pos.x + dx; m.y = s.pos.y + dy; m.hp = m.maxHp = 1e9; m.state = 'rest'; m.timer = 1e9;
      if (o.clone) m.clone = true;
      s.addMonsterView(m);
      return m;
    };
    window.clear = () => { for (const m of [...s.spawner.monsters]) { s.monsterViews.get(m.id)?.destroy(); s.monsterViews.delete(m.id); } s.spawner.monsters = []; };
    // 호통 한 번(기다림·동작 비우고)
    window.roar = () => { s.cooldowns.left = {}; s.act = null; s.swing = null; s.useSkill('roar'); s.act = null; };
  });
};
await page.goto('http://localhost:8123/');
await boot();
const rows = [];
let bad = 0;
const ok = (name, cond, detail) => {
  rows.push(`| ${name} | ${cond ? '좋음' : '문제'} | ${detail} |`);
  if (!cond) bad++;
};
const cnt = () => page.evaluate(() => window.__s.d.skillMastery.roar || 0);

// ① 세 마리 한 번에 → 1
await page.evaluate(() => { clear(); put('snake', 30, 0); put('snake', -30, 0); put('dog', 0, 25); roar(); });
await page.waitForTimeout(300);
ok('세 마리 한 번에 = 1', (await cnt()) === 1, `${await cnt()}번`);
// ② 들쥐(구간 1, 내 구간 4) 안 셈 / 쥐왕 셈 / 분신 안 셈
await page.evaluate(() => { clear(); put('rat', 30, 0); put('bigrat', -30, 0); roar(); });
await page.waitForTimeout(300);
const afterRat = await cnt();
await page.evaluate(() => { clear(); put('rat_king', 30, 0); roar(); });
await page.waitForTimeout(300);
const afterKing = await cnt();
await page.evaluate(() => { clear(); put('dog', 30, 0, { clone: true }); roar(); });
await page.waitForTimeout(300);
const afterClone = await cnt();
ok('들쥐 안 셈·쥐왕 셈·분신 안 셈', afterRat === 1 && afterKing === 2 && afterClone === 2, `들쥐 뒤 ${afterRat} → 쥐왕 뒤 ${afterKing} → 분신 뒤 ${afterClone}`);
// 숨 고르기: 싸우는 중이면 셈
await page.evaluate(() => { const s = window.__s; clear(); put('dog', 30, 0); roar(); s.player.hp = 1; s.cooldowns.left = {}; s.act = null; s.useSkill('breath'); s.act = null; });
await page.waitForTimeout(300);
const brc = await page.evaluate(() => window.__s.d.skillMastery.breath || 0);
ok('숨 고르기: 싸우는 중에 쓰면 셈', brc === 1, `${brc}번`);
// ③ 19 → 20: 2등급 + 머리 위 글자
await page.evaluate(() => { window.__s.d.skillMastery.roar = 19; clear(); put('dog', 30, 0); roar(); });
await page.waitForTimeout(250);
const up = await page.evaluate(() => {
  const s = window.__s;
  const t = s.children.list.find((o) => o.masteryUp);
  return { n: s.d.skillMastery.roar, text: t && t.text, color: t && t.style.color };
});
ok('20번째에 2등급 + 글자', up.n === 20 && up.text === '호통 숙련 2', `${up.n}번, 글자 "${up.text}" ${up.color}`);
await page.evaluate(() => { window.__s.d.skillMastery.roar = 899; clear(); put('dog', 30, 0); roar(); });
await page.waitForTimeout(250);
const up10 = await page.evaluate(() => { const t = window.__s.children.list.filter((o) => o.masteryUp).pop(); return { text: t && t.text, color: t && t.style.color }; });
const gold = await page.evaluate(() => window.__s.d.skills.mastery.upMaxColor);
ok('10등급은 금빛', up10.text === '호통 숙련 10' && up10.color === gold, `"${up10.text}" ${up10.color}`);
// ④ 데미지·기다림: 1등급과 10등급 비교(같은 몬스터, 회심 없음)
const dmgAt = async (n) => page.evaluate((n) => {
  const s = window.__s;
  s.d.skillMastery.roar = n;
  clear();
  const m = put('dog', 30, 0);
  s.cooldowns.left = {}; s.act = null; s.swing = null;
  s.d.admin.noCooldown = false;
  s.useSkill('roar');
  s.act = null;
  return { dmg: m.maxHp - m.hp, cd: s.cooldowns.left.roar };
}, n);
const d1 = await dmgAt(0);
const d10 = await dmgAt(900);
const ratio = d10.dmg / d1.dmg;
const cdr = d10.cd / d1.cd;
ok('10등급 데미지 ×1.45·기다림 ×0.82', Math.abs(ratio - 1.45) < 0.02 && Math.abs(cdr - 0.82) < 0.01, `데미지 ${d1.dmg} → ${d10.dmg} (×${ratio.toFixed(3)}), 기다림 ${d1.cd} → ${d10.cd}ms (×${cdr.toFixed(3)})`);
// ⑤ 무예창·관리자
await page.evaluate(() => { window.__s.d.skillMastery.roar = 70; window.__s.d.skillPanel.show(); });
await page.waitForTimeout(300);
const panel = await page.evaluate(() => [...document.querySelectorAll('.sk-node')].filter((b) => b.querySelector('.sk-node-grade')).map((b) => `${b.querySelector('.sk-node-name').textContent}:${b.querySelector('.sk-node-grade').textContent}:${b.querySelector('.sk-node-bar i').style.width}`));
ok('무예창 등급·막대', panel.includes('호통:3:16%') && panel.some((x) => x.startsWith('숨 고르기:1')), panel.join(', '));
await page.evaluate(() => window.__s.d.skillPanel.close());
await page.evaluate(() => document.getElementById('btn-admin').click());
await page.locator('#admin-panel button', { hasText: '10' }).last().click();
const allG = await page.evaluate(() => { const s = window.__s; return s.skills.filter((k) => k.type !== 'passive').every((k) => (s.d.skillMastery[k.id] || 0) === 900); });
await page.locator('#admin-panel button', { hasText: '▶' }).click();
await page.locator('#admin-panel button', { hasText: /^1$/ }).click();
const one = await page.evaluate(() => { const s = window.__s; const ids = s.skills.filter((k) => k.type !== 'passive').map((k) => [k.id, s.d.skillMastery[k.id] || 0]); return ids.filter(([, n]) => n === 0).map(([id]) => id); });
await page.locator('#admin-panel button', { hasText: '닫기' }).click();
ok('관리자: 모두 10 → 하나만 1', allG && one.length === 1, `모두 900번 ${allG}, 1등급으로 돌린 것 ${one.join(',')}`);
// ⑥ 저장 → 다시 열기
const before = await page.evaluate(() => { const s = window.__s; s.save(); return JSON.stringify(s.d.skillMastery); });
await page.reload();
await boot();
const after = await page.evaluate(() => ({ m: JSON.stringify(window.__s.d.skillMastery), ever: window.__s.d.everLearned, raw: JSON.parse(localStorage.getItem('seolhwa-rpg:save:v1')).skillsEverLearned }));
ok('저장 → 다시 열기', before === after.m && after.ever.includes('roar') && after.ever.includes('breath') && after.raw.length === 2, `skillMastery 같음 ${before === after.m}, skillsEverLearned ${JSON.stringify(after.raw)}`);
console.log('| 시험 | 결과 | 자세히 |');
console.log('|---|---|---|');
console.log(rows.join('\n'));
console.log(errors.length ? errors.join('\n') : '오류 없음');
console.log(bad || errors.length ? `문제 ${bad + errors.length}개` : '문제 없음');
await browser.close();
process.exitCode = bad || errors.length ? 1 : 0;
