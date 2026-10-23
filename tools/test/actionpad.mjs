// 공격·무예 단추 배치 시험(docs/spec/feedback_1023.md 6): 숫자패드(numpad)와 예전 줄(rows) 배치마다
// ① 보이는 칸 안을 2px마다 눌러 다른 단추가 눌리는 곳이 없는지(10-20 "단추 안 눌림") ② 조이스틱을 누른 채 단추마다 눌러 모두 눌리는지·계속 걷는지
// ③ 기다리는 초 글자(최대 두 자리)가 칸 안에 맞는지 ④ 키: 숫자패드 1~9·Enter, 윗줄 숫자·스페이스 ⑤ 저장된 8칸 → 9칸(9는 빈칸)
// 그리고 방물장수가 제자리에 서 있는지(feedback_1023.md 7).
// 쓰는 법: python3 -m http.server 8123 & 을 켠 뒤 node tools/test/actionpad.mjs [그림 저장 폴더]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const OUT = process.argv[2];
const SLOTS8 = ['power_slash', 'breath', 'whirl', 'triple_cut', 'dash_cut', 'roar', 'earth_split', 'sword_wind'];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
await ctx.addInitScript((SLOTS8) => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.clear();
  localStorage.setItem('seolhwa-rpg:save:v1', JSON.stringify({ version: 1, map: 'village', x: 690, y: 500, facing: 'down', progress: { level: 30, exp: 0 },
    skills: SLOTS8, skillSlots: SLOTS8, equipment: { equipped: { weapon: 'wood_pine', outfit: 'outfit1_hotot', head: '', arms: '', feet: '' }, bag: [], coins: 0 } }));
}, SLOTS8);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8123/');
await page.waitForFunction(() => document.getElementById('loading').classList.contains('hide'), null, { timeout: 30000 });
await page.waitForTimeout(1500);
const rows = [];
let bad = 0;
const ok = (name, cond, detail) => {
  rows.push(`| ${name} | ${cond ? '좋음' : '문제'} | ${detail} |`);
  if (!cond) bad++;
};

// ⑤ 저장된 8칸 → 9칸
const slots = await page.evaluate(() => [...seolhwa.game.scene.getScene('map').skillSlots]);
const known = await page.evaluate((ids) => ids.filter((id) => seolhwa.game.scene.getScene('map').skills.some((k) => k.id === id)), SLOTS8);
ok('저장된 8칸 → 9칸', slots.length === 9 && slots[8] === null && known.every((id, i) => slots[SLOTS8.indexOf(id)] === id), `${slots.map((x) => x || '빈칸').join(' ')}`);
// 방물장수 자리(level 30이라 보임): 5초 지켜봄
const ped0 = await page.evaluate(() => { const v = seolhwa.game.scene.getScene('map').npcViews.find((n) => n.npc.id === 'peddler'); return v && { x: v.sprite.x, y: v.sprite.y }; });
await page.waitForTimeout(5000);
const ped1 = await page.evaluate(() => { const v = seolhwa.game.scene.getScene('map').npcViews.find((n) => n.npc.id === 'peddler'); return v && { x: v.sprite.x, y: v.sprite.y }; });
ok('방물장수 제자리(5초)', ped0 && ped1 && ped0.x === ped1.x && ped0.y === ped1.y, ped0 ? `(${ped0.x},${ped0.y}) → (${ped1.x},${ped1.y})` : '못 찾음');

await page.evaluate(() => {
  const s = seolhwa.game.scene.getScene('map');
  window.__att = 0; window.__sk = []; window.__menu = 0;
  const a = s.attackWithAssist.bind(s); s.attackWithAssist = (m) => { if (!m) window.__att++; return a(m); };
  const u = s.useSkill.bind(s); s.useSkill = (id) => { window.__sk.push(id); return u(id); };
  const show = s.d.skillPanel.show.bind(s.d.skillPanel); s.d.skillPanel.show = () => { window.__menu++; };
  s.d.admin.noDie = true;
  // 빈 9번 칸도 눌린 것을 세게: 시험 동안 9번에 무예 하나
  s.skillSlots[8] = s.skillSlots[0];
  window.__restoreShow = () => { s.d.skillPanel.show = show; };
});
const cdp = await ctx.newCDPSession(page);
for (const layout of ['numpad', 'rows']) {
  await page.evaluate((layout) => { const s = seolhwa.game.scene.getScene('map'); s.d.game.actionPad.layout = layout; s.d.actionPad.apply(s.d.game.actionPad); }, layout);
  await page.waitForTimeout(200);
  const els = await page.evaluate(() => [...document.querySelectorAll('.skill-btn, #btn-attack, #btn-pad-menu')].filter((e) => !e.hidden && e.getClientRects().length).map((e) => {
    const box = e.querySelector('.skill-box') || e;
    const r = box.getBoundingClientRect();
    return { name: e.id || `칸${[...e.parentNode.children].indexOf(e) + 1}`, x: r.x, y: r.y, w: r.width, h: r.height };
  }));
  // ① 보이는 칸 안 2px마다: 그 자리를 누르면 그 단추인지
  const wrong = await page.evaluate((els) => {
    const out = [];
    for (const e of els) {
      for (let y = e.y + 1; y < e.y + e.h - 1; y += 2) for (let x = e.x + 1; x < e.x + e.w - 1; x += 2) {
        const t = document.elementFromPoint(x, y);
        const b = t && t.closest('.skill-btn, #btn-attack, #btn-pad-menu');
        const name = b ? b.id || `칸${[...b.parentNode.children].indexOf(b) + 1}` : '없음';
        // 동그란 공격(예전)은 네모 귀퉁이를 빼고 봄
        if (e.name === 'btn-attack' && e.layout === 'rows' && Math.hypot(x - e.x - e.w / 2, y - e.y - e.h / 2) > e.w / 2 - 1) continue;
        if (name !== e.name) out.push(`${e.name}(${Math.round(x)},${Math.round(y)})→${name}`);
      }
    }
    return out;
  }, els.map((e) => ({ ...e, layout })));
  ok(`${layout}: 보이는 칸 안을 누르면 그 단추`, !wrong.length, wrong.length ? `${wrong.length}곳: ${wrong.slice(0, 3).join(', ')}` : `단추 ${els.length}개 모두`);
  // 단추 사이 거리(보이는 칸끼리 겹치지 않음)
  let overlap = 0;
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const a = els[i]; const b = els[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlap++;
  }
  const right = Math.max(...els.map((e) => e.x + e.w));
  const left = Math.min(...els.map((e) => e.x));
  const top = Math.min(...els.map((e) => e.y));
  ok(`${layout}: 보이는 칸끼리 안 겹침`, !overlap, `겹침 ${overlap} · 차지한 넓이 ${Math.round(right - left)}×${Math.round(390 - top)}px · 오른쪽 끝 틈 ${Math.round(844 - right)}px`);
  // 숫자패드: 칸 사이 틈도 누름 영역(docs/spec/feedback_1024.md 3) — 단추 묶음 안 1px마다 단추가 아닌 곳(맵)이 눌리는지
  if (layout === 'numpad') {
    const holes = await page.evaluate(({ l, t, r, b }) => {
      let n = 0;
      for (let y = t + 0.5; y < b; y += 1) for (let x = l + 0.5; x < r; x += 1) {
        const el = document.elementFromPoint(x, y);
        if (!(el && el.closest('.skill-btn, #btn-attack, #btn-pad-menu'))) n++;
      }
      return n;
    }, { l: left, t: top, r: right, b: Math.max(...els.map((e) => e.y + e.h)) });
    ok(`${layout}: 칸 사이 틈도 누름 영역`, !holes, `단추 묶음 안에서 맵이 눌리는 곳 ${holes}px`);
  }
  // ② 조이스틱을 누른 채 단추마다 한 번씩
  await page.evaluate(() => { window.__att = 0; window.__sk = []; window.__menu = 0; });
  const joy = { x: 120, y: 300 };
  const dx = layout === 'numpad' ? 40 : -40; // 두 번째는 반대로 걸어 벽에 막히지 않게
  const pos0 = await page.evaluate(() => ({ ...seolhwa.game.scene.getScene('map').pos }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: joy.x, y: joy.y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: joy.x + dx, y: joy.y, id: 1 }] });
  for (const e of els) {
    await page.evaluate(() => { const s = seolhwa.game.scene.getScene('map'); s.cooldowns.left = {}; s.skillCast = null; });
    // 칸 가장자리 가까이(안쪽 3px)를 누름
    // 동그란 공격(예전)은 네모 귀퉁이가 동그라미 밖이라 둘레 안쪽(가운데에서 반지름의 85%)
    const round = e.name === 'btn-attack' && layout === 'rows';
    const p = round ? { x: e.x + e.w / 2 + e.w * 0.3, y: e.y + e.h / 2 - e.h * 0.3 } : { x: e.x + e.w - 3, y: e.y + 3 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: joy.x + dx, y: joy.y, id: 1 }, { x: p.x, y: p.y, id: 2 }] });
    await page.waitForTimeout(50);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: p.x, y: p.y, id: 2 }] });
    await page.waitForTimeout(450);
  }
  const pos1 = await page.evaluate(() => ({ ...seolhwa.game.scene.getScene('map').pos }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const r = await page.evaluate(() => ({ att: window.__att, sk: window.__sk.length, menu: window.__menu }));
  const wantSk = els.filter((e) => e.name.startsWith('칸')).length;
  const wantMenu = els.some((e) => e.name === 'btn-pad-menu') ? 1 : 0;
  ok(`${layout}: 조이스틱 누른 채 단추마다`, r.att >= 1 && r.sk === wantSk && r.menu === wantMenu && Math.abs(pos1.x - pos0.x) > 30,
    `공격 ${r.att}번 · 무예 ${r.sk}/${wantSk} · 무예창 ${r.menu}/${wantMenu} · 걸은 거리 ${Math.round(Math.abs(pos1.x - pos0.x))}px`);
  // ③ 기다리는 초 글자(두 자리)가 칸 안에
  const fit = await page.evaluate(() => {
    const s = seolhwa.game.scene.getScene('map');
    for (const id of s.skillSlots) if (id) s.cooldowns.left[id] = 99000;
    s.skillButtons.update(s.skillSlots, () => 99000, true);
    return [...document.querySelectorAll('.skill-btn')].map((b) => {
      const t = b.querySelector('.cd-text');
      const box = b.querySelector('.skill-box').getBoundingClientRect();
      const rg = document.createRange();
      rg.selectNodeContents(t);
      const r = rg.getBoundingClientRect();
      return { text: t.textContent, inside: r.width > 0 && r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom, w: Math.round(r.width), bw: Math.round(box.width) };
    });
  });
  if (OUT) await page.screenshot({ path: `${OUT}/pad_${layout}.png` });
  await page.evaluate(() => { const s = seolhwa.game.scene.getScene('map'); s.cooldowns.left = {}; });
  ok(`${layout}: 기다리는 초 "99"가 칸 안`, fit.every((f) => f.inside), `글자 폭 ${fit[0].w}px / 칸 ${fit[0].bw}px`);
}
// ④ 키
await page.evaluate(() => { window.__att = 0; window.__sk = []; });
for (let n = 1; n <= 9; n++) {
  await page.evaluate(() => { const s = seolhwa.game.scene.getScene('map'); s.cooldowns.left = {}; s.skillCast = null; });
  await page.keyboard.press(`Numpad${n}`);
  await page.waitForTimeout(350);
}
const kp = await page.evaluate(() => window.__sk.length);
await page.evaluate(() => { window.__sk = []; const s = seolhwa.game.scene.getScene('map'); s.cooldowns.left = {}; s.skillCast = null; });
await page.keyboard.press('Digit2');
await page.waitForTimeout(350);
const kd = await page.evaluate(() => window.__sk.length);
await page.waitForTimeout(600);
await page.evaluate(() => { window.__att = 0; });
await page.keyboard.press('NumpadEnter');
await page.waitForTimeout(700);
const ke = await page.evaluate(() => window.__att);
await page.keyboard.press('Space');
await page.waitForTimeout(700);
const ks = await page.evaluate(() => window.__att) - ke;
ok('키: 숫자패드 1~9·Enter, 윗줄 2·스페이스', kp === 9 && kd === 1 && ke >= 1 && ks >= 1, `숫자패드 무예 ${kp}/9 · 윗줄 2 ${kd} · 숫자패드 Enter 공격 ${ke} · 스페이스 공격 ${ks}`);
console.log('| 시험 | 결과 | 자세히 |');
console.log('|---|---|---|');
console.log(rows.join('\n'));
console.log(errors.length ? errors.join('\n') : '오류 없음');
console.log(bad || errors.length ? `문제 ${bad + errors.length}개` : '문제 없음');
await browser.close();
process.exitCode = bad || errors.length ? 1 : 0;
