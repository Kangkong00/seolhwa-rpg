// 무예창 칸 ↔ 화면 숫자패드(docs/spec/feedback_1031.md 2)와 숙련 이름(3) 시험.
// ① 두 쪽 i번 칸이 같은 자리(3×3)·같은 무예 ② 무예창 칸에서 넣기 → 화면 칸 바로 바뀜 ③ 「칸에 넣기」 중 화면 칸이 깜빡이고 눌러도 넣어짐
// ④ 화면 칸 길게 누르기 → 그 칸을 고른 채 무예창 ⑤ 등급 4/5/9/10 이름·테두리(무예창·정보창·화면 칸·시전 글씨)·다음 이름
// ⑥ 관리자 등급 정하기 뒤 바로 바뀜 ⑦ 5등급이 되는 순간 "호통 → 사자후" 큰 글씨
// 쓰는 법: python3 -m http.server 8123 & 을 켠 뒤 node tools/test/skillslots.mjs [그림 폴더]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const OUT = process.argv[2];
const SK = ['power_slash', 'breath', 'whirl', 'triple_cut', 'roar', 'earth_split', 'sword_wind'];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
await ctx.addInitScript((SK) => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.clear();
  localStorage.setItem('seolhwa-rpg:save:v1', JSON.stringify({ version: 1, map: 'dungeon_rat_1', x: 690, y: 400, facing: 'down', progress: { level: 30, exp: 0 },
    skills: SK, skillSlots: ['power_slash', 'breath', 'whirl', null, 'roar'], equipment: { equipped: { weapon: 'wood_pine', outfit: 'outfit1_hotot', head: '', arms: '', feet: '' }, bag: [], coins: 0 } }));
}, SK);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8123/');
await page.waitForFunction(() => document.getElementById('loading').classList.contains('hide'), null, { timeout: 30000 });
await page.waitForTimeout(1200);
await page.evaluate(() => { const s = seolhwa.game.scene.getScene('map'); s.spawner.update = () => ({ born: [], bites: [] }); window.__s = s; });
const rows = [];
let bad = 0;
const ok = (name, cond, detail) => {
  rows.push(`| ${name} | ${cond ? '좋음' : '문제'} | ${detail} |`);
  if (!cond) bad++;
};
const frame = () => page.waitForTimeout(400);
// 두 쪽 칸: 자리(행·열)·무예
const compare = () => page.evaluate(() => {
  const s = window.__s;
  const pad = [...document.querySelectorAll('#skill-buttons .skill-btn')].map((b, i) => ({ i, row: b.style.gridRow, col: b.style.gridColumn, id: s.d.skillButtons.buttons[i].id || null }));
  const pan = [...document.querySelectorAll('.sk-slots .sk-slot')].map((b) => ({ i: Number(b.dataset.slot), row: b.style.gridRow, col: b.style.gridColumn, id: b.dataset.skill || null }));
  const diff = pad.filter((p) => { const q = pan.find((x) => x.i === p.i); return !q || q.row !== p.row || q.col !== p.col || q.id !== p.id || p.id !== (s.skillSlots[p.i] || null); });
  return { n: pan.length, diff: diff.map((d) => d.i + 1), order: pan.sort((a, b) => a.row - b.row || a.col - b.col).map((x) => x.i + 1).join('') };
});
// ① 무예창(무예를 고르지 않은 화면)의 3×3
await page.evaluate(() => window.__s.d.skillPanel.show());
await frame();
let c = await compare();
ok('두 쪽 칸 같은 자리·같은 무예', c.n === 9 && !c.diff.length && c.order === '789456123', `칸 ${c.n}개, 위→아래 순서 ${c.order}, 다른 칸 ${c.diff.join(',') || '없음'}`);
// ② 무예창 칸에서 넣기: 검풍 고르고 「무예 칸에 넣기」 → 무예창 9번 칸
await page.evaluate(() => { const p = window.__s.d.skillPanel; p.sel = 'sword_wind'; p.render(); });
await page.locator('.sk-info-acts button', { hasText: '무예 칸에 넣기' }).click();
const placing = await page.evaluate(() => ({ cls: document.getElementById('skill-buttons').classList.contains('placing'), hidden: document.getElementById('skill-buttons').hidden, z: getComputedStyle(document.getElementById('skill-buttons')).zIndex }));
if (OUT) await page.screenshot({ path: `${OUT}/slots_placing.png` });
await page.locator('.sk-slots .sk-slot[data-slot="8"]').click();
await frame();
c = await compare();
const s9 = await page.evaluate(() => window.__s.skillSlots[8]);
ok('무예창 칸에 넣기 → 화면 칸 바로', s9 === 'sword_wind' && !c.diff.length, `9번 = ${s9}, 다른 칸 ${c.diff.join(',') || '없음'}`);
ok('「칸에 넣기」 중 화면 칸 깜빡임·창 위', placing.cls && !placing.hidden && Number(placing.z) > 34, `placing ${placing.cls}, 보임 ${!placing.hidden}, z ${placing.z}`);
// ③ 화면 칸을 눌러 넣기: 지축 가르기 → 화면 4번 칸
await page.evaluate(() => { const p = window.__s.d.skillPanel; p.sel = 'earth_split'; p.placing = true; p.render(); });
await frame();
const r4 = await page.evaluate(() => { const b = document.querySelectorAll('#skill-buttons .skill-btn')[3].getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
const hitEl = await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e && e.closest('#skill-buttons') ? 'pad' : (e && e.id) || e && e.className; }, r4);
await page.touchscreen.tap(r4.x, r4.y);
await frame();
c = await compare();
const st3 = await page.evaluate(() => ({ s4: window.__s.skillSlots[3], placing: document.getElementById('skill-buttons').classList.contains('placing') }));
ok('화면 칸을 눌러 넣기', st3.s4 === 'earth_split' && !st3.placing && !c.diff.length, `눌린 곳 ${hitEl}, 4번 = ${st3.s4}, 넣은 뒤 깜빡임 ${st3.placing}, 다른 칸 ${c.diff.join(',') || '없음'}`);
await page.evaluate(() => window.__s.d.skillPanel.close());
await frame();
// ④ 길게 누르기(화면 5번 칸 = 호통)
const r5 = await page.evaluate(() => { const b = document.querySelectorAll('#skill-buttons .skill-btn')[4].getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
const cdp = await ctx.newCDPSession(page);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r5.x, y: r5.y, id: 1 }] });
await page.waitForTimeout(900);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await frame();
const lp = await page.evaluate(() => { const p = window.__s.d.skillPanel; return { open: p.open, sel: p.sel, slot: p.slotSel, picked: !!document.querySelector('.sk-slot.picked[data-slot="4"]') }; });
const kept = await page.evaluate(() => window.__s.skillSlots[4]);
ok('화면 칸 길게 누르기 → 그 칸 고른 무예창', lp.open && lp.sel === 'roar' && lp.slot === 4 && kept === 'roar', `열림 ${lp.open}, 고른 무예 ${lp.sel}, 고른 칸 ${lp.slot + 1}, 손을 뗀 뒤에도 5번 = ${kept}(창 단추가 눌리지 않음)`);
await page.evaluate(() => window.__s.d.skillPanel.close());
// ⑤ 등급 4/5/9/10: 호통(5번 칸)
const NAMES = { 4: '호통', 5: '사자후', 9: '사자후', 10: '대사자후' };
const RANK = { 4: '', 5: 'rank-silver', 9: 'rank-silver', 10: 'rank-gold' };
for (const g of [4, 5, 9, 10]) {
  const r = await page.evaluate(async (g) => {
    const s = window.__s;
    const { countForGrade } = await import('/src/core/mastery.js');
    s.d.skillMastery.roar = countForGrade(g, s.d.skills.mastery);
    const p = s.d.skillPanel;
    p.show(); p.sel = 'roar'; p.render();
    const node = [...document.querySelectorAll('.sk-node')].find((b) => b.querySelector('.sk-node-name') && ['호통', '사자후', '대사자후'].includes(b.querySelector('.sk-node-name').textContent));
    const info = document.querySelector('.sk-info-name').textContent;
    const next = (document.querySelector('.sk-m-next') || {}).textContent || '';
    const nodeRank = node ? ['rank-silver', 'rank-gold'].find((c) => node.classList.contains(c)) || '' : '?';
    p.close();
    await new Promise((res) => setTimeout(res, 500));
    const padBtn = document.querySelectorAll('#skill-buttons .skill-btn')[4];
    const padRank = ['rank-silver', 'rank-gold'].find((c) => padBtn.classList.contains(c)) || '';
    // 시전 글씨
    let cast = '';
    const orig = s.skillFx.skillName.bind(s.skillFx);
    s.skillFx.skillName = (name, color) => { cast = name; return orig(name, color); };
    s.cooldowns.left = {}; s.act = null; s.swing = null;
    s.useSkill('roar');
    s.act = null;
    s.skillFx.skillName = orig;
    return { node: node && node.querySelector('.sk-node-name').textContent, info, next, nodeRank, padRank, cast };
  }, g);
  const want = NAMES[g];
  const nextWant = g < 5 ? '다음 이름: 사자후 (5등급)' : g < 10 ? '다음 이름: 대사자후 (10등급)' : '';
  ok(`${g}등급 이름·테두리`, r.node === want && r.info === want && r.cast === want && r.nodeRank === RANK[g] && r.padRank === RANK[g] && r.next === nextWant,
    `무예창 ${r.node}·정보창 ${r.info}·시전 ${r.cast}, 테두리 창 ${r.nodeRank || '기본'}·칸 ${r.padRank || '기본'}, "${r.next}"`);
  await page.waitForTimeout(400);
}
if (OUT) {
  await page.evaluate(() => { const p = window.__s.d.skillPanel; p.show(); p.sel = 'roar'; p.render(); });
  await page.screenshot({ path: `${OUT}/slots_gold.png` });
  await page.evaluate(() => window.__s.d.skillPanel.close());
}
// ⑥ 관리자 등급 정하기(호통 5등급) 뒤 바로
await page.evaluate(() => document.getElementById('btn-admin').click());
for (let i = 0; i < 20; i++) {
  const cur = await page.locator('#admin-panel .ad-value', { hasText: /등급\)|모두/ }).first().textContent();
  if (/^(호통|사자후|대사자후) /.test(cur)) break;
  await page.locator('#admin-panel button', { hasText: '▶' }).click();
}
await page.locator('#admin-panel button', { hasText: /^5$/ }).click();
await page.locator('#admin-panel button', { hasText: '닫기' }).click();
await frame();
const ad = await page.evaluate(() => { const s = window.__s; const b = document.querySelectorAll('#skill-buttons .skill-btn')[4]; return { name: s.skillDisplayName(s.skills.find((k) => k.id === 'roar')), rank: b.classList.contains('rank-silver') }; });
ok('관리자 5등급 → 바로 사자후·은빛', ad.name === '사자후' && ad.rank, `${ad.name}, 은빛 ${ad.rank}`);
// ⑦ 4 → 5등급 순간 큰 글씨
await page.evaluate(async () => {
  const s = window.__s;
  const { countForGrade } = await import('/src/core/mastery.js');
  s.d.skillMastery.roar = countForGrade(5, s.d.skills.mastery) - 1;
  // 레벨 30(구간 6)에서 세는 몬스터: 여우(구간 6)
  let zi = s.map.spawnZones.findIndex((z) => z.monster === 'fox');
  if (zi < 0) { s.map.spawnZones.push({ monster: 'fox', count: 0, respawnMs: 1e9, x: 0, y: 0, w: s.map.width, h: s.map.height }); s.spawner.timers.push(0); zi = s.map.spawnZones.length - 1; }
  const m = s.spawner.spawn(zi);
  m.x = s.pos.x + 30; m.y = s.pos.y; m.hp = m.maxHp = 1e9; m.state = 'rest'; m.timer = 1e9;
  s.addMonsterView(m);
  s.cooldowns.left = {}; s.act = null; s.swing = null;
  s.useSkill('roar');
  s.act = null;
});
await page.waitForTimeout(200);
const big = await page.evaluate(() => { const t = window.__s.children.list.filter((o) => o.masteryUp).pop(); return t ? { text: t.text, px: t.style.fontSize } : null; });
ok('5등급 되는 순간 "호통 → 사자후"', big && big.text === '호통 → 사자후', big ? `${big.text} ${big.px}` : '글씨 없음');
console.log('| 시험 | 결과 | 자세히 |');
console.log('|---|---|---|');
console.log(rows.join('\n'));
console.log(errors.length ? errors.join('\n') : '오류 없음');
console.log(bad || errors.length ? `문제 ${bad + errors.length}개` : '문제 없음');
await browser.close();
process.exitCode = bad || errors.length ? 1 : 0;
