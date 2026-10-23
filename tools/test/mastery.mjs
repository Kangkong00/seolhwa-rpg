// 무예 숙련 시험(docs/spec/feedback_1024.md 4) — 브라우저 없이 규칙(src/core/mastery.js)과 데이터만으로.
// ① 등급 계산(19번 1등급·20번 2등급·899번 9등급·900번 10등급) ② 덤(데미지·기다림·범위·회복·반격, 패시브 없음)
// ③ 기다림 합쳐 최대 0.5 ④ 세는 몬스터(낮은 구간 안 셈·우두머리 늘·분신 안 셈) ⑤ 한 번에 1 ⑥ 관리자 등급 정하기·저장 값 읽기
// 브라우저에서 실제로 맞혀 세기·저장 → 불러오기는 tools/test/masteryplay.mjs
// 쓰는 법: node tools/test/mastery.mjs
import { readFileSync } from 'node:fs';
import { gradeOf, countForGrade, masteryProgress, masteryBonus, applyMastery, cooldownMulWith, tierOfLevel, countsForMastery, addMasteryUse, setMasteryGrade, normalizeMastery } from '../../src/core/mastery.js';

const root = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root)));
const sk = read('data/skills.json');
const mc = sk.mastery;
const skills = Object.fromEntries(sk.skills.map((s) => [s.id, s]));
const mons = Object.fromEntries(read('data/monsters.json').monsters.map((m) => [m.id, m]));
const rows = [];
const problems = [];
const ok = (name, cond, detail = '') => {
  rows.push(`| ${name} | ${cond ? '좋음' : '문제'} | ${detail} |`);
  if (!cond) problems.push(name);
};
const near = (a, b) => Math.abs(a - b) < 1e-9;

// ① 등급
const g = (n) => gradeOf(n, mc);
ok('등급 계산', g(0) === 1 && g(19) === 1 && g(20) === 2 && g(59) === 2 && g(60) === 3 && g(899) === 9 && g(900) === 10 && g(99999) === 10,
  `0→${g(0)} 19→${g(19)} 20→${g(20)} 59→${g(59)} 60→${g(60)} 899→${g(899)} 900→${g(900)} 99999→${g(99999)}`);
const p = masteryProgress(30, mc);
ok('막대(30번)', p.grade === 2 && p.into === 10 && p.need === 40 && masteryProgress(900, mc).max, `2등급 ${p.into}/${p.need}, 900번 끝`);
ok('10등급 누적', countForGrade(10, mc) === 900, `${countForGrade(10, mc)}번`);

// ② 덤
const sw = skills.sword_wind;
const b1 = masteryBonus(sw, 1, mc);
const b5 = masteryBonus(sw, 5, mc);
const b10 = masteryBonus(sw, 10, mc);
ok('1등급 덤 없음', b1.damageMul === 1 && b1.cooldownCut === 0 && b1.rangeMul === 1, JSON.stringify(b1));
ok('5등급', near(b5.damageMul, 1.2) && near(b5.cooldownCut, 0.08) && near(b5.rangeMul, 1.1), `데미지 ×${b5.damageMul} 기다림 −${b5.cooldownCut} 범위 ×${b5.rangeMul}`);
ok('10등급', near(b10.damageMul, 1.45) && near(b10.cooldownCut, 0.18) && near(b10.rangeMul, 1.2), `데미지 ×${b10.damageMul} 기다림 −${b10.cooldownCut} 범위 ×${b10.rangeMul}`);
const a10 = applyMastery(sw, 10, mc);
ok('검풍 10등급 값', near(a10.damageMul, sw.damageMul * 1.45) && near(a10.distance, sw.distance * 1.2) && a10.cooldownMs === sw.cooldownMs, `damageMul ${sw.damageMul}→${a10.damageMul.toFixed(3)}, distance ${sw.distance}→${a10.distance}`);
const br = applyMastery(skills.breath, 10, mc);
ok('숨 고르기: 회복 +', br.healRatio > skills.breath.healRatio && near(br.healRatio, skills.breath.healRatio * 1.45) && masteryBonus(skills.breath, 10, mc).damageMul === 1, `healRatio ${skills.breath.healRatio}→${br.healRatio.toFixed(3)}`);
const co = applyMastery(skills.counter, 10, mc);
ok('받아치기: 반격 +', near(co.counterMul, skills.counter.counterMul * 1.45), `counterMul ${skills.counter.counterMul}→${co.counterMul.toFixed(2)}`);
const pas = sk.skills.find((s) => s.type === 'passive');
const bp = masteryBonus(pas, 10, mc);
ok('패시브 숙련 없음', bp.damageMul === 1 && bp.cooldownCut === 0 && bp.rangeMul === 1, pas.name);
// ③ 기다림 상한
ok('기다림 최대 0.5', near(cooldownMulWith(0.4, 0.18, mc), 0.5) && near(cooldownMulWith(0.1, 0.18, mc), 0.72), `팔찌·패시브 0.4 + 숙련 0.18 → ×${cooldownMulWith(0.4, 0.18, mc)}, 0.1 + 0.18 → ×${cooldownMulWith(0.1, 0.18, mc).toFixed(2)}`);

// ④ 세는 몬스터
ok('구간', tierOfLevel(1, mc) === 1 && tierOfLevel(10, mc) === 2 && tierOfLevel(24, mc) === 4 && tierOfLevel(40, mc) === 9, `Lv1→1 Lv10→2 Lv24→4 Lv40→9`);
const c = (id, lv, m = {}) => countsForMastery(mons[id], m, lv, mc);
ok('낮은 구간 몬스터 안 셈', !c('rat', 20) && !c('weasel', 20) && c('snake', 20) && c('dog', 20), 'Lv20(구간 4): 들쥐·족제비 안 셈, 물뱀(3)·들개(4) 셈');
ok('우두머리는 늘 셈', c('rat_king', 40) && c('snake_boss', 40), 'Lv40에 곳간 쥐왕·늙은 구렁이');
ok('분신 안 셈', !c('fox', 30, { clone: true }) && c('fox', 30), '여우 분신');
ok('모든 몬스터에 구간', Object.values(mons).every((m) => m.tier >= 1), `${Object.keys(mons).length}종`);

// ⑤ 한 번에 1(addMasteryUse는 부를 때마다 1 — 화면 쪽이 한 번 쓸 때 한 번만 부름: masteryplay.mjs가 확인)
const map = {};
let up = 0;
for (let i = 0; i < 20; i++) if (addMasteryUse(map, 'sword_wind', mc).after > 1 && !up) up = i + 1;
ok('20번째에 2등급', map.sword_wind === 20 && up === 20, `${up}번째`);

// ⑥ 관리자·저장
const m2 = {};
setMasteryGrade(m2, 'whirl', 10, mc);
setMasteryGrade(m2, 'roar', 3, mc);
m2.breath = 40;
setMasteryGrade(m2, 'breath', 1, mc);
ok('등급 정하기', g(m2.whirl) === 10 && g(m2.roar) === 3 && m2.roar === 60 && !('breath' in m2), JSON.stringify(m2));
const nm = normalizeMastery({ a: 5.7, b: -1, c: 'x', d: NaN, e: 12 });
ok('저장 값 읽기', JSON.stringify(nm) === '{"a":5,"e":12}', JSON.stringify(nm));

console.log('| 시험 | 결과 | 자세히 |');
console.log('|---|---|---|');
console.log(rows.join('\n'));
console.log(problems.length ? `문제 ${problems.length}개: ${problems.join(', ')}` : '문제 없음');
process.exitCode = problems.length ? 1 : 0;
