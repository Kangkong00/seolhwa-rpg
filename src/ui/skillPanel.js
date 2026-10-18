// 무예창(docs/spec/skills_impact.md 2): 위에 무예 칸 4개, 아래에 이 직업 무예 목록.
// 배운 무예를 눌러 고른 뒤 칸을 누르면 그 칸에 넣음(다른 칸에 있으면 맞바꿈). 고른 것 없이 찬 칸을 누르면 뺌.
// 배우지 않은 무예는 흐리게 + "레벨 N · 늙은 군관". 칸은 저장됨(scene.skillSlots).
// 위쪽 '무예' 단추로 열고 닫음, PC는 K. getScene() = 지금 MapScene
import { placeInSlot, clearSlot } from '../core/skills.js';
import { charIcon } from './itemIcon.js';
import { josa } from './josa.js';

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

export class SkillPanel {
  constructor(root, getScene) {
    this.root = root;
    this.getScene = getScene;
    this.open = false;
    this.picked = null;
    this.box = el('div', 'ad-box sk-box');
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
    this.picked = null;
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
    this.render();
  }

  render() {
    if (!this.open) return;
    const s = this.s;
    const byId = Object.fromEntries(s.skills.map((k) => [k.id, k]));
    this.box.replaceChildren();
    const head = el('div', 'ad-head');
    head.appendChild(el('div', 'ad-title', '무예'));
    head.appendChild(el('div', 'ad-tabs'));
    const closeBtn = el('button', '', '닫기');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', () => this.close());
    head.appendChild(closeBtn);
    this.box.appendChild(head);

    // 칸 4개
    const slots = el('div', 'sk-slots');
    s.skillSlots.forEach((id, i) => {
      const sk = id && byId[id];
      const b = el('button', `sk-slot${this.picked ? ' target' : ''}`);
      b.type = 'button';
      b.appendChild(el('span', 'sk-num', String(i + 1)));
      if (sk) {
        b.appendChild(skillIcon(sk));
        b.appendChild(el('span', 'sk-slot-name', sk.name));
      } else {
        b.appendChild(el('span', 'sk-slot-name', '빈칸'));
      }
      b.addEventListener('click', () => {
        if (this.picked) {
          const name = byId[this.picked].name;
          placeInSlot(s.skillSlots, i, this.picked);
          this.picked = null;
          this.changed(`${josa(name, '을', '를')} ${i + 1}번 칸에 넣었습니다`);
        } else if (sk) {
          clearSlot(s.skillSlots, i);
          this.changed(`${josa(sk.name, '을', '를')} 칸에서 뺐습니다`);
        }
      });
      slots.appendChild(b);
    });
    this.box.appendChild(slots);
    this.box.appendChild(el('div', 'ad-help', this.picked
      ? `${josa(byId[this.picked].name, '을', '를')} 넣을 칸을 누르세요`
      : '배운 무예를 누른 뒤 칸을 누르면 넣습니다. 찬 칸을 누르면 뺍니다.'));

    // 무예 목록(이 직업 것, 레벨 순)
    const body = el('div', 'ad-body');
    const job = s.skills[0] && s.skills[0].job;
    const list = s.skills.filter((k) => !job || k.job === job)
      .slice()
      .sort((a, b) => ((a.requires && a.requires.level) || 1) - ((b.requires && b.requires.level) || 1));
    for (const sk of list) {
      const known = s.learned.includes(sk.id);
      const lv = (sk.requires && sk.requires.level) || 1;
      const row = el('button', `npc-row sk-row${this.picked === sk.id ? ' picked' : ''}`);
      row.type = 'button';
      row.disabled = !known;
      row.appendChild(skillIcon(sk));
      const main = el('div', 'row-main');
      main.appendChild(el('span', '', `${sk.name}${sk.needsBlade ? ' · 칼' : ''}`));
      main.appendChild(el('span', 'row-sub', known ? `${sk.desc} · 기다림 ${Math.round(sk.cooldownMs / 1000)}초` : `레벨 ${lv} · 우물가 늙은 군관에게 배움`));
      row.appendChild(main);
      const at = s.skillSlots.indexOf(sk.id);
      row.appendChild(el('span', 'row-right', known ? (at >= 0 ? `${at + 1}번 칸` : '') : `Lv ${lv}`));
      row.addEventListener('click', () => {
        this.picked = this.picked === sk.id ? null : sk.id;
        this.message = '';
        this.render();
      });
      body.appendChild(row);
    }
    this.box.appendChild(body);
    if (this.message) this.box.appendChild(el('div', 'ad-msg', this.message));
  }
}
