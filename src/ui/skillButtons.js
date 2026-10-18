// 공격 버튼 둘레의 무예 칸 4개(PC는 1·2·3·4 키, docs/spec/skills_impact.md 2).
// 칸에 무엇을 넣을지는 무예창(src/ui/skillPanel.js)에서 고름. 빈칸을 누르면 무예창이 열림.
// 기다리는 동안은 어둡게 덮고 남은 초를 보여 줌. 칼이 필요한 무예는 맨손이면 흐리게.
import { SLOT_COUNT } from '../core/skills.js';

export class SkillButtons {
  // skills: data/skills.json skills, onUse(skillId), onEmpty(): 빈칸을 눌렀을 때
  constructor(container, skills, onUse, onEmpty) {
    this.container = container;
    this.byId = Object.fromEntries(skills.map((s) => [s.id, s]));
    this.slots = Array(SLOT_COUNT).fill(null);
    this.buttons = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'skill-btn empty';
      const face = document.createElement('span');
      face.className = 'skill-face';
      const cd = document.createElement('div');
      cd.className = 'cd';
      const t = document.createElement('div');
      t.className = 'cd-text';
      const num = document.createElement('span');
      num.className = 'skill-num';
      num.textContent = String(i + 1);
      b.append(face, cd, t, num);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = this.slots[i];
        if (id) onUse(id);
        else onEmpty();
      });
      container.appendChild(b);
      this.buttons.push({ b, face, cd, t, id: undefined, last: '' });
    }
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.target instanceof HTMLInputElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= SLOT_COUNT && this.slots[n - 1]) onUse(this.slots[n - 1]);
    });
  }

  setVisible(v) {
    this.container.hidden = !v;
  }

  // 칸 얼굴: 아이콘 그림(못 받으면 한자)
  setFace(u, s) {
    u.face.replaceChildren();
    u.b.setAttribute('aria-label', s ? s.name : '빈칸');
    if (!s) {
      u.face.textContent = '+';
      return;
    }
    u.face.textContent = s.icon;
    if (s.image) {
      const img = document.createElement('img');
      img.src = s.image;
      img.alt = '';
      img.draggable = false;
      img.className = 'skill-img';
      img.addEventListener('load', () => { u.face.textContent = ''; u.face.appendChild(img); }, { once: true });
    }
  }

  // slots: 칸마다 무예 id, remaining(id) → 남은 ms, hasBlade: 칼을 들었는지
  update(slots, remaining, hasBlade) {
    this.slots = slots;
    this.buttons.forEach((u, i) => {
      const id = slots[i];
      const s = id ? this.byId[id] : null;
      if (u.id !== id) {
        u.id = id;
        u.last = '';
        this.setFace(u, s);
      }
      const left = s ? remaining(s.id) : 0;
      const sec = left > 0 ? Math.ceil(left / 1000) : 0;
      const ratio = left > 0 ? Math.min(1, left / s.cooldownMs) : 0;
      const noBlade = !!(s && s.needsBlade && !hasBlade);
      const key = `${sec}|${Math.round(ratio * 40)}|${noBlade}`;
      if (key === u.last) return;
      u.last = key;
      u.b.classList.toggle('empty', !s);
      u.b.classList.toggle('locked', noBlade);
      u.b.classList.toggle('cooling', left > 0);
      u.cd.style.height = `${ratio * 100}%`;
      u.t.textContent = sec ? String(sec) : '';
    });
  }
}
