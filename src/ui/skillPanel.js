// 무예창 = 트리(docs/spec/feedback_1022.md 5). 세로 줄 4개(검술·풍술·기공·심법) + 맨 아래 칠성검무, 무예끼리 선으로 이음.
// 칸 상태 3가지: 배움(밝게) / 지금 배울 수 있음(테두리 반짝) / 못 배움(흐림 + "레벨 N" 또는 "앞 무예 필요").
// 칸을 누르면 오른쪽 정보창: 이름·가지·레벨·값·기다림·지금 내 공격력으로 계산한 데미지·범위·설명·[무예 칸에 넣기].
// 넣기를 누르면 무예 칸 8개가 나오고, 칸을 누르면 그 칸에 넣음(다른 칸에 있으면 맞바꿈). 찬 칸은 [빼기].
// 배우기는 우물가 늙은 군관에게서(여기서는 보기만). 위쪽 '무예' 단추로 열고 닫음, PC는 K. getScene() = 지금 MapScene
import { placeInSlot, clearSlot, canLearn } from '../core/skills.js';
import { charIcon } from './itemIcon.js';
import { josa } from './josa.js';
import { formatNum } from './format.js';

function el(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

// 무예 아이콘(그림이 오면 그림, 아직 없으면 한자)
function skillIcon(sk) {
  const box = charIcon(sk.icon);
  if (sk.image) {
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    img.addEventListener('load', () => box.replaceWith(img), { once: true });
    img.src = sk.image;
  }
  return box;
}

const lv = (sk) => (sk.requires && sk.requires.level) || 1;

// 지금 내 공격력으로 계산한 데미지 글자(회심 빼고, 패시브 공격력 배율 포함)
export function skillDamageText(s, sk) {
  if (sk.type === 'passive') return '';
  const base = s.skillBase() * s.stats().attackMul;
  const n = (mul) => formatNum(Math.round(base * mul));
  switch (sk.kind) {
    case 'heal':
      return `체력 ${Math.round(sk.healRatio * 100)}% + ${sk.hotMs / 1000}초 동안 ${Math.round((sk.hotRatio || 0) * 100)}%`;
    case 'chain':
      return `약 ${n(sk.damageMul)} × ${sk.hits - 1}번 + ${n(sk.lastDamageMul || sk.damageMul)}`;
    case 'spin':
      return `약 ${n(sk.damageMul)} × ${Math.floor(sk.spinMs / sk.tickMs)}번 (둘레 모두)`;
    case 'multi':
      return `약 ${n(sk.damageMul)} × 최대 ${sk.maxTargets}마리`;
    case 'ultimate':
      return `별 약 ${n(sk.damageMul)} × 7 + 끝 약 ${n(sk.finalDamageMul)}`;
    case 'stance':
      return `받아치면 약 ${n(sk.counterMul * s.cfg.impact.crit.damageMul)} (반드시 회심)`;
    case 'shout':
      return `약 ${n(sk.damageMul)} + 멈칫 ${sk.stunMs / 1000}초 (둘레 모두)`;
    case 'dash':
    case 'line':
    case 'projectile':
      return `약 ${n(sk.damageMul)} (지나는 길 모두)`;
    default:
      return `약 ${n(sk.damageMul || 1)}`;
  }
}

function rangeText(sk) {
  if (sk.kind === 'ultimate') return `별 7곳 반경 ${sk.starRadius} · 끝 반경 ${sk.finalRadius}`;
  if (sk.length) return `앞 ${sk.length} × 폭 ${sk.width}`;
  if (sk.distance) return `앞 ${sk.distance}${sk.width ? ` × 폭 ${sk.width}` : ''}`;
  if (sk.radius) return `반경 ${sk.radius}`;
  return '';
}

export class SkillPanel {
  constructor(root, getScene) {
    this.root = root;
    this.getScene = getScene;
    this.open = false;
    this.sel = null; // 고른 무예 id
    this.placing = false; // 무예 칸 고르는 중
    this.box = el('div', 'ad-box sk-box sk-tree-box');
    root.appendChild(this.box);
    root.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (e.target === root) this.close();
    });
  }

  get s() {
    return this.getScene();
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  show() {
    const s = this.s;
    if (!s || !s.pos) return;
    if (s.gridOn) s.setGridMode(false);
    if (s.equipPanel.open) s.setBagOpen(false);
    if (s.npcPanel.open) s.setNpcOpen(false);
    if (s.adminPanel && s.adminPanel.open) s.adminPanel.close();
    this.open = true;
    this.placing = false;
    this.message = '';
    this.root.hidden = false;
    s.setControlsVisible(false);
    s.hud.setSkillsOn(true);
    this.render();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.root.hidden = true;
    const s = this.s;
    if (s && s.hud) {
      s.hud.setSkillsOn(false);
      if (!s.gridOn && !s.npcPanel.open && !s.equipPanel.open) s.setControlsVisible(true);
    }
  }

  changed(msg) {
    const s = this.s;
    s.refreshSkills();
    s.save();
    this.message = msg;
    this.placing = false;
    this.render();
  }

  // 칸 상태: learned / can(지금 배울 수 있음) / locked(+ 까닭 한 줄)
  stateOf(sk) {
    const s = this.s;
    if (s.learned.includes(sk.id)) return { st: 'learned', why: '' };
    const c = canLearn(sk, s.progress, s.equip, s.learned, s.itemDefs, s.treeOpts());
    if (c.ok) return { st: 'can', why: '배울 수 있음' };
    if (s.progress.level < lv(sk)) return { st: 'locked', why: `레벨 ${lv(sk)}` };
    if (c.needSkills && c.needSkills.length) return { st: 'locked', why: '앞 무예 필요' };
    return { st: 'can-cost', why: '값 모자람' };
  }

  node(sk) {
    const s = this.s;
    const { st, why } = this.stateOf(sk);
    const b = el('button', `sk-node ${st}${this.sel === sk.id ? ' sel' : ''}${sk.type === 'passive' ? ' passive' : ''}`);
    b.type = 'button';
    b.appendChild(skillIcon(sk));
    b.appendChild(el('span', 'sk-node-name', sk.name));
    const at = s.skillSlots.indexOf(sk.id);
    if (at >= 0) b.appendChild(el('span', 'sk-node-slot', String(at + 1)));
    if (why && st !== 'learned') b.appendChild(el('span', 'sk-node-why', why));
    b.addEventListener('click', () => {
      this.sel = sk.id;
      this.placing = false;
      this.message = '';
      this.render();
    });
    return b;
  }

  render() {
    if (!this.open) return;
    const s = this.s;
    const byId = Object.fromEntries(s.skills.map((k) => [k.id, k]));
    const job = s.skills[0] && s.skills[0].job;
    const mine = s.skills.filter((k) => !job || k.job === job);
    const branches = (s.d.skills.branches || []).filter((b) => b.id !== 'final');
    this.box.replaceChildren();
    const head = el('div', 'ad-head');
    head.appendChild(el('div', 'ad-title', '무예'));
    head.appendChild(el('div', 'sk-head-help', '배우기는 우물가 늙은 군관에게서'));
    const closeBtn = el('button', '', '닫기');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', () => this.close());
    head.appendChild(closeBtn);
    this.box.appendChild(head);

    const main = el('div', 'sk-main');
    // 왼쪽: 트리(세로로 넘김)
    const tree = el('div', 'sk-tree ad-body');
    const cols = el('div', 'sk-cols');
    for (const br of branches) {
      const col = el('div', 'sk-col');
      col.appendChild(el('div', 'sk-col-title', br.name));
      const list = mine.filter((k) => k.branch === br.id).sort((a, b) => lv(a) - lv(b));
      list.forEach((sk, i) => {
        if (i) col.appendChild(el('div', `sk-link${s.learned.includes(list[i - 1].id) ? ' on' : ''}`));
        col.appendChild(this.node(sk));
      });
      cols.appendChild(col);
    }
    tree.appendChild(cols);
    // 맨 아래: 끝(칠성검무) — 검술·풍술 끝에서 이어지는 선
    const finals = mine.filter((k) => k.branch === 'final');
    if (finals.length) {
      const join = el('div', 'sk-join');
      const req = finals[0].requiresSkill || [];
      join.classList.toggle('on', req.length && req.every((id) => s.learned.includes(id)));
      tree.appendChild(join);
      const row = el('div', 'sk-final');
      for (const sk of finals) row.appendChild(this.node(sk));
      tree.appendChild(row);
    }
    main.appendChild(tree);
    // 오른쪽: 정보창
    main.appendChild(this.info(byId[this.sel]));
    this.box.appendChild(main);
    if (this.message) this.box.appendChild(el('div', 'ad-msg', this.message));
  }

  info(sk) {
    const s = this.s;
    const box = el('div', 'sk-info');
    if (!sk) {
      box.appendChild(el('div', 'sk-info-help', '무예를 누르면 여기에 자세히 나옵니다. 배운 액티브 무예는 무예 칸(공격 단추 위 8칸)에 넣어 씁니다.'));
      box.appendChild(this.slotRow(null));
      return box;
    }
    const brName = ((s.d.skills.branches || []).find((b) => b.id === sk.branch) || {}).name || '';
    const top = el('div', 'sk-info-top');
    top.appendChild(skillIcon(sk));
    const t = el('div');
    t.appendChild(el('div', 'sk-info-name', sk.name));
    t.appendChild(el('div', 'sk-info-sub', `${brName}${sk.type === 'passive' ? ' · 패시브(늘 켜짐)' : ''} · 레벨 ${lv(sk)}`));
    top.appendChild(t);
    box.appendChild(top);
    const lines = [];
    const cost = sk.cost || {};
    const items = Object.entries(cost.items || {}).map(([id, n]) => `${(s.itemDefs[id] && s.itemDefs[id].name) || id} ${n}`);
    lines.push(`값 ${s.coinsText(cost.coins || 0)}${items.length ? ` + ${items.join(', ')}` : ''}`);
    if (sk.type !== 'passive') lines.push(`기다림 ${Math.round((sk.cooldownMs * s.stats().cooldownMul) / 100) / 10}초`);
    const dmg = skillDamageText(s, sk);
    if (dmg) lines.push(`데미지 ${dmg}`);
    const range = rangeText(sk);
    if (range) lines.push(`범위 ${range}`);
    const need = (sk.requiresSkill || []).map((id) => {
      const k = s.skills.find((x) => x.id === id);
      return `${k ? k.name : id}${s.learned.includes(id) ? ' ✓' : ''}`;
    });
    if (need.length) lines.push(`앞 무예 ${need.join(' + ')}`);
    for (const l of lines) box.appendChild(el('div', 'sk-info-line', l));
    box.appendChild(el('div', 'sk-info-desc', sk.desc));
    const { st, why } = this.stateOf(sk);
    if (st !== 'learned') box.appendChild(el('div', 'sk-info-why', st === 'can' ? '늙은 군관에게 배울 수 있습니다' : why));
    if (st === 'learned' && sk.type !== 'passive') {
      const at = s.skillSlots.indexOf(sk.id);
      const put = el('button', 'primary', at >= 0 ? `${at + 1}번 칸 · 다른 칸으로` : '무예 칸에 넣기');
      put.type = 'button';
      put.addEventListener('click', () => {
        this.placing = !this.placing;
        this.render();
      });
      const acts = el('div', 'sk-info-acts');
      acts.appendChild(put);
      if (at >= 0) {
        const out = el('button', '', '빼기');
        out.type = 'button';
        out.addEventListener('click', () => {
          clearSlot(s.skillSlots, at);
          this.changed(`${josa(sk.name, '을', '를')} 칸에서 뺐습니다`);
        });
        acts.appendChild(out);
      }
      box.appendChild(acts);
      if (this.placing) box.appendChild(this.slotRow(sk));
    }
    return box;
  }

  // 무예 칸 8개(위 1~4, 아래 5~8). sk가 있으면 누른 칸에 넣음
  slotRow(sk) {
    const s = this.s;
    const byId = Object.fromEntries(s.skills.map((k) => [k.id, k]));
    const wrap = el('div', 'sk-slots');
    s.skillSlots.forEach((id, i) => {
      const k = id && byId[id];
      const b = el('button', `sk-slot${sk ? ' target' : ''}`);
      b.type = 'button';
      b.appendChild(el('span', 'sk-num', String(i + 1)));
      if (k) b.appendChild(skillIcon(k));
      else b.appendChild(el('span', 'sk-slot-name', '빈칸'));
      b.disabled = !sk && !k;
      b.addEventListener('click', () => {
        if (sk) {
          placeInSlot(s.skillSlots, i, sk.id);
          this.changed(`${josa(sk.name, '을', '를')} ${i + 1}번 칸에 넣었습니다`);
        } else if (k) {
          this.sel = k.id;
          this.render();
        }
      });
      wrap.appendChild(b);
    });
    return wrap;
  }
}
