// 공격 단추 왼쪽·위의 네모 무예 칸 SLOT_COUNT개(2줄 × 4칸, 위 1~4·아래 5~8, PC는 1~8 키, docs/spec/feedback_1021.md 1).
// 칸에 무엇을 넣을지는 무예창(src/ui/skillPanel.js)에서 고름. 빈칸을 누르면 무예창이 열림.
// 기다리는 동안은 어두운 막이 시계 방향으로 걷히고 가운데 남은 초, 다 차면 테두리가 한 번 반짝. 칼이 필요한 무예는 맨손이면 흐리게.
import { SLOT_COUNT } from '../core/skills.js';
import { vibrate } from './press.js';

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
      // 누르는 영역(단추) 안에 보이는 네모(box)
      const box = document.createElement('span');
      box.className = 'skill-box';
      const face = document.createElement('span');
      face.className = 'skill-face';
      const cd = document.createElement('div');
      cd.className = 'cd';
      const t = document.createElement('div');
      t.className = 'cd-text';
      const num = document.createElement('span');
      num.className = 'skill-num';
      num.textContent = String(i + 1);
      box.append(face, cd, t, num);
      b.append(box);
      box.addEventListener('animationend', () => box.classList.remove('ready'));
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        b.classList.add('pressed');
        vibrate();
        const id = this.slots[i];
        if (id) onUse(id);
        else onEmpty();
      });
      const up = () => b.classList.remove('pressed');
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      container.appendChild(b);
      this.buttons.push({ b, box, face, cd, t, id: undefined, last: '', cooling: false });
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
      const key = `${sec}|${Math.round(ratio * 120)}|${noBlade}`;
      if (key === u.last) return;
      u.last = key;
      u.b.classList.toggle('empty', !s);
      u.b.classList.toggle('locked', noBlade);
      u.b.classList.toggle('cooling', left > 0);
      // 남은 만큼 어두운 막: 위(12시)에서 시계 방향으로 걷힌 곳은 투명
      const done = (1 - ratio) * 360;
      u.cd.style.background = left > 0 ? `conic-gradient(transparent 0deg ${done}deg, rgba(0, 0, 0, 0.62) ${done}deg 360deg)` : 'none';
      u.t.textContent = sec ? String(sec) : '';
      // 다 차면 테두리 한 번 반짝
      if (u.cooling && left <= 0 && s) {
        u.box.classList.remove('ready');
        void u.box.offsetWidth;
        u.box.classList.add('ready');
      }
      u.cooling = left > 0;
    });
  }
}
