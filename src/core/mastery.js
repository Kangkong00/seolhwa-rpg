// 무예 숙련(docs/spec/feedback_1024.md 4) — 게임 규칙만, 화면 코드를 참조하지 않음(서버 대비).
// 값은 data/skills.json mastery. 무예마다 "몬스터를 1마리 이상 맞힌 번 수"(횟수)를 세고, 횟수 → 등급 1~maxGrade.
// 다음 등급까지 perGrade × 지금 등급 → 등급 g에 이르는 누적 횟수 = perGrade × g(g−1)/2 (perGrade 20이면 2등급 20, 10등급 900).

// 등급 g에 이르는 누적 횟수
export function countForGrade(g, cfg) {
  const k = Math.max(1, Math.min(cfg.maxGrade, Math.floor(g)));
  return (cfg.perGrade * k * (k - 1)) / 2;
}

// 횟수 → 등급(1~maxGrade)
export function gradeOf(count, cfg) {
  let g = 1;
  while (g < cfg.maxGrade && count >= countForGrade(g + 1, cfg)) g++;
  return g;
}

// 무예창 막대: { grade, into(이번 등급에서 센 횟수), need(다음 등급까지 필요한 횟수, 마지막 등급이면 0), max }
export function masteryProgress(count, cfg) {
  const grade = gradeOf(count, cfg);
  if (grade >= cfg.maxGrade) return { grade, into: 0, need: 0, max: true };
  const from = countForGrade(grade, cfg);
  return { grade, into: count - from, need: countForGrade(grade + 1, cfg) - from, max: false };
}

// 숙련이 있는 무예인지(패시브는 쓰는 동작이 없어 없음)
export function hasMastery(skill) {
  return !!skill && skill.type !== 'passive';
}

// 등급의 덤: { damageMul, healMul, counterMul, cooldownCut, rangeMul }
// 회복 무예(healKinds)는 데미지 대신 회복량, 자세 무예(counterKinds)는 데미지 대신 반격 배율. 범위는 rangeAt 등급마다 더함.
export function masteryBonus(skill, grade, cfg) {
  const out = { damageMul: 1, healMul: 1, counterMul: 1, cooldownCut: 0, rangeMul: 1 };
  if (!hasMastery(skill)) return out;
  const up = Math.max(0, Math.min(cfg.maxGrade, grade) - 1);
  const k = 1 + up * cfg.damagePerGrade;
  if ((cfg.healKinds || []).includes(skill.kind)) out.healMul = 1 + up * cfg.healPerGrade;
  else if ((cfg.counterKinds || []).includes(skill.kind)) out.counterMul = 1 + up * cfg.counterPerGrade;
  else out.damageMul = k;
  out.cooldownCut = up * cfg.cooldownPerGrade;
  for (const [g, add] of Object.entries(cfg.rangeAt || {})) if (grade >= Number(g)) out.rangeMul += add;
  return out;
}

// 무예 정의에 등급의 덤을 곱한 사본(맞는 범위·데미지·회복·반격 값). 기다림은 cooldownMul로 따로
export function applyMastery(skill, grade, cfg) {
  const b = masteryBonus(skill, grade, cfg);
  const out = { ...skill };
  const mul = (keys, m) => { for (const key of keys || []) if (typeof out[key] === 'number') out[key] *= m; };
  mul(cfg.damageKeys, b.damageMul);
  mul(cfg.healKeys, b.healMul);
  mul(cfg.counterKeys, b.counterMul);
  mul(cfg.rangeKeys, b.rangeMul);
  return out;
}

// 무예 기다림 배율: 장비·패시브 cooldownCut + 숙련, 합쳐 최대 cooldownCap(0.5)
export function cooldownMulWith(baseCut, masteryCut, cfg) {
  return 1 - Math.min(cfg.cooldownCap ?? 0.5, baseCut + masteryCut);
}

// 레벨 → 구간 번호(1부터). cfg.tierLevels = 구간마다 시작 레벨
export function tierOfLevel(level, cfg) {
  let t = 1;
  cfg.tierLevels.forEach((lv, i) => { if (level >= lv) t = i + 1; });
  return t;
}

// 이 몬스터를 숙련에 셀지: 분신(보상 없음) 안 셈, 우두머리는 늘 셈, 그 밖에는 내 구간 − countTiersBelow 구간 이상
export function countsForMastery(monsterDef, monster, level, cfg) {
  if (!monsterDef || (monster && monster.clone)) return false;
  if (monsterDef.boss) return true;
  return (monsterDef.tier || 1) >= tierOfLevel(level, cfg) - (cfg.countTiersBelow ?? 1);
}

// 한 번 쓴 무예를 셈(맞힌 몬스터가 있을 때 한 번만 부름). 반환 { before, after } 등급
export function addMasteryUse(map, id, cfg) {
  const before = gradeOf(map[id] || 0, cfg);
  map[id] = (map[id] || 0) + 1;
  return { before, after: gradeOf(map[id], cfg) };
}

// 관리자: 등급을 바로 정함(그 등급의 처음 횟수로)
export function setMasteryGrade(map, id, grade, cfg) {
  const n = countForGrade(grade, cfg);
  if (n > 0) map[id] = n;
  else delete map[id]; // 1등급 = 횟수 0(저장에도 남기지 않음)
}

// 저장에서 읽기: 숫자만, 0 이상 정수
export function normalizeMastery(saved) {
  const out = {};
  if (saved && typeof saved === 'object') for (const [k, v] of Object.entries(saved)) if (Number.isFinite(v) && v > 0) out[k] = Math.floor(v);
  return out;
}
