// 빠른 확인용(Claude Code 시험): 저장을 심어 게임을 열고 오류가 없는지 보고 화면을 찍음.
// 쓰는 법: (저장소 폴더에서) python3 -m http.server 8123 을 켜 둔 뒤
//   node tools/test/smoke.mjs <출력폴더> [맵=village] [레벨=1]
// 다른 시험은 이 파일을 복사해 page.evaluate 부분만 바꿔 씀. 함정은 docs/handover_code.md 5번.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const [out = '.', map = 'village', level = '1'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
// 저장 심기는 첫 로드 때 한 번만(새로고침하면 게임이 닫히며 자동 저장해 덮어쓰므로 addInitScript로)
await ctx.addInitScript(([map, level]) => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.clear();
  localStorage.setItem('seolhwa-rpg:save:v1', JSON.stringify({
    version: 1, map, x: map === 'village' ? 690 : 690, y: map === 'village' ? 470 : 420, facing: 'down',
    progress: { level: Number(level), exp: 0 },
    equipment: { equipped: { weapon: 'wood_pine', outfit: 'outfit1_hotot', head: 'hood_mumyeong', arms: '', feet: '' }, bag: [], coins: 0 },
  }));
}, [map, level]);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));
await page.goto('http://localhost:8123/');
await page.waitForFunction(() => document.getElementById('loading').classList.contains('hide'), null, { timeout: 30000 });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const s = seolhwa.game.scene.getScene('map');
  return { map: s.d.mapId, pos: s.pos, level: s.progress.level, monsters: s.spawner.monsters.length, npcs: s.npcViews.length };
});
console.log(JSON.stringify(info));
await page.screenshot({ path: `${out}/smoke_${map}.png` });
console.log(errors.length ? errors.join('\n') : '오류 없음');
await browser.close();
