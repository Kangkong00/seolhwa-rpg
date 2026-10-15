// 아이템 정보창의 내용(docs/spec/feedback_1015.md 5·6). 그리기는 src/ui/itemInfo.js.
// 능력치는 지금 낀 것과 비교해 ▲(초록)/▼(빨강). 전리품 설명은 가게(buys)·무예 재료(cost)·의뢰(need)에서 자동으로 만듦.
import { weaponAttack, swingSpeedLabel, levelOk } from '../core/stats.js';
import { josa } from '../ui/josa.js';

const SLOT_KIND = { weapon: '무기', outfit: '옷', head: '머리', arms: '팔', feet: '발' };

export function kindLabel(def) {
  if (def.slot) return SLOT_KIND[def.slot] || '장비';
  if (def.use && def.use.returnTo) return '쓰는 것';
  if (def.use) return '먹을거리';
  return '전리품';
}

// 능력치 줄들: [{ text, cmp(+1/-1/0), diff }]
export function itemStats(s, def) {
  const lv = s.progress.level;
  const eq = s.equip.equipped;
  const out = [];
  const cmpLine = (label, value, cur, fmt = (v) => String(v)) => {
    const diff = value - cur;
    out.push({ text: `${label} ${fmt(value)}`, cmp: Math.sign(diff), diff: fmt(Math.abs(diff)) });
  };
  if (def.slot === 'weapon') {
    const w = s.weaponDefs[def.id];
    const atk = weaponAttack(def.id, s.weaponDefs, s.cfg.attack.damage, lv, s.d.economy.levels);
    const cur = weaponAttack(eq.weapon, s.weaponDefs, s.cfg.attack.damage, lv, s.d.economy.levels);
    if (eq.weapon === def.id) out.push({ text: `공격력 ${atk}` });
    else cmpLine('공격력', atk, cur);
    out.push({ text: `휘두르기 ${swingSpeedLabel(w)}` });
  } else if (def.slot === 'feet') {
    const v = (def.stats && def.stats.speed) || 0;
    const curDef = eq.feet && s.itemDefs[eq.feet];
    const cur = (curDef && curDef.stats && curDef.stats.speed) || 0;
    const pct = (x) => `+${Math.round(x * 100)}%`;
    if (eq.feet === def.id) out.push({ text: `걸음 ${pct(v)}` });
    else cmpLine('걸음', v, cur, (x) => (x >= 0 ? pct(x) : `${Math.round(x * 100)}%`));
  } else if (def.slot) {
    const v = (def.stats && def.stats.defense) || 0;
    const curDef = eq[def.slot] && s.itemDefs[eq[def.slot]];
    const cur = (curDef && curDef.stats && curDef.stats.defense) || 0;
    if (eq[def.slot] === def.id) out.push({ text: `방어력 ${v}` });
    else cmpLine('방어력', v, cur);
  } else if (def.use) {
    if (def.use.healFull) out.push({ text: '체력 전부 회복' });
    else if (def.use.heal) out.push({ text: `체력 ${def.use.heal} 회복` });
    if (def.use.returnTo) out.push({ text: '마을 성황당 앞으로 돌아감' });
  }
  return out;
}

// 설명 줄들: desc가 있으면 그것, 전리품은 쓰임을 자동으로
export function itemDesc(s, def) {
  const lines = [];
  if (def.desc) lines.push(def.desc);
  if (!def.slot && !def.use) {
    if (def.anyShop) lines.push('어느 가게에서나 팔 수 있다.');
    else {
      const who = s.d.npcs.npcs.filter((n) => n.shop && (n.shop.buys || []).includes(def.id)).map((n) => n.name);
      if (who.length) lines.push(`${who.join('·')}에게 팔 수 있다.`);
    }
    const skills = s.skills.filter((sk) => sk.cost && sk.cost.items && sk.cost.items[def.id]).map((sk) => sk.name);
    if (skills.length) lines.push(`무예(${skills.join('·')})를 배울 때 쓴다.`);
    const goods = Object.values(s.itemDefs).filter((g) => g.shopPrice && g.shopPrice.items && g.shopPrice.items[def.id]).map((g) => g.name);
    if (goods.length) lines.push(`${josa(goods.join('·'), '을', '를')} 살 때 쓴다.`);
    const quests = Object.values(s.questDefs).filter((q) => q.need && q.need[def.id] && s.quests[q.id] !== 'done');
    if (quests.length) lines.push(`의뢰 「${quests[0].name}」에 쓴다.`);
  }
  return lines;
}

function levelWarn(s, def) {
  if (def.level && !levelOk(def, s.progress.level)) return `레벨 ${def.level}부터`;
  return '';
}

// PC 마우스를 올렸을 때 작은 창 글자
export function tipText(s, def) {
  const st = itemStats(s, def).map((x) => x.text).join(', ');
  const warn = levelWarn(s, def);
  return [def.name, kindLabel(def), st, warn].filter(Boolean).join(' · ');
}

// context: { type: 'bag', index } | { type: 'slot', slot } | { type: 'buy', onBuy, price(글자) } | { type: 'sell', onSell }
export function openItemInfo(s, id, context) {
  const def = s.itemDefs[id];
  if (!def) return;
  const warn = levelWarn(s, def);
  const actions = [];
  if (context.type === 'bag') {
    if (def.slot) actions.push({ label: '끼기', primary: true, disabled: !!warn, onClick: () => { s.itemInfo.hide(); s.equipFromBagIndex(context.index); } });
    else if (def.use) actions.push({ label: '쓰기', primary: true, onClick: () => { s.itemInfo.hide(); s.useBagItem(context.index); } });
  } else if (context.type === 'slot') {
    if (def.slot !== 'outfit') actions.push({ label: '벗기', primary: true, onClick: () => { s.itemInfo.hide(); s.takeOff(context.slot); } });
  } else if (context.type === 'buy') {
    actions.push({ label: '사기', primary: true, onClick: () => { s.itemInfo.hide(); context.onBuy(); } });
  } else if (context.type === 'sell') {
    actions.push({ label: '팔기', primary: true, onClick: () => { s.itemInfo.hide(); context.onSell(); } });
  }
  s.itemInfo.show({
    def,
    kind: context.type === 'slot' ? `${kindLabel(def)} · 끼고 있음` : kindLabel(def),
    stats: itemStats(s, def),
    warn,
    desc: itemDesc(s, def),
    price: context.type === 'buy' && context.price ? `값 ${context.price}` : def.sellPrice ? `파는 값 ${s.coinsText(def.sellPrice)}` : '',
    actions,
  });
}
