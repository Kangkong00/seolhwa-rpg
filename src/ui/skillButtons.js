// 네모 무예 칸 SLOT_COUNT개(PC는 1~9 키·숫자패드 1~9). 자리는 src/ui/actionPad.js(숫자패드 모양 또는 예전 4칸 줄, docs/spec/feedback_1023.md 6).
// 칸에 무엇을 넣을지는 무예창(src/ui/skillPanel.js)에서 고름. 빈칸을 누르면 무예창이 열림.
// 기다리는 동안은 어두운 막이 시계 방향으로 걷히고 가운데 남은 초, 다 차면 테두리가 한 번 반짝. 칼이 필요한 무예는 맨손이면 흐리게.
import { SLOT_COUNT } from '../core/skills.js';
import { vibrate } from './press.js';

// 다음 click 하나를 삼킴(0.6초 안): 칸을 누른 뒤 그 아래로 바뀐 화면에 click이 떨어지지 않게
function swallowNextClick() {
  const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
  window.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 600);
}

export class SkillButtons {
  // skills: data/skills.json skills, onUse(skillId), onEmpty(): 빈칸을 눌렀을 때
  // onLongPress(i): 칸을 길게 누름 → 그 칸을 고른 채 무예창(docs/spec/feedback_1031.md 2)
  constructor(container, skills, onUse, onEmpty, onLongPress = null) {
    this.container = container;
    this.visible = true;
    this.placeHandler = null; // 무예창 「칸에 넣기」 중: 칸을 누르면 그 칸에 넣음
    this.longMs = 550;
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
      let downAt = -1;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        b.classList.add('pressed');
        vibrate();
        if (this.placeHandler) {
          // 넣고 나면 숫자패드가 내려가 그 아래 무예창 단추에 이 누름의 click이 떨어짐 → 잠깐 click을 삼킴
          swallowNextClick();
          this.placeHandler(i);
          return;
        }
        const id = this.slots[i];
        if (id) onUse(id);
        else onEmpty();
        downAt = e.timeStamp;
      });
      const up = () => { b.classList.remove('pressed'); downAt = -1; };
      // 길게 누르면(뗄 때 누른 시간이 longMs 넘음) 그 칸을 고른 채 무예창. 무예는 누르는 순간 이미 나감(늦추지 않음).
      // 시간은 입력 이벤트의 timeStamp로 잼 — 화면이 바빠 이벤트가 늦게 처리돼도 짧은 누름이 길게 잡히지 않음.
      // 뗀 자리(이제 무예창 단추)에 떨어질 click은 삼킴
      b.addEventListener('pointerup', (e) => {
        const held = downAt >= 0 ? e.timeStamp - downAt : 0;
        up();
        if (onLongPress && !this.placeHandler && held >= this.longMs) {
          swallowNextClick();
          onLongPress(i);
        }
      });
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      container.appendChild(b);
      this.buttons.push({ b, box, face, cd, t, id: undefined, last: '', cooling: false });
    }
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.target instanceof HTMLInputElement) return;
      // 윗줄 숫자(e.key) 또는 숫자패드(e.code — Num Lock이 꺼져 있어도)
      const pad = /^Numpad([1-9])$/.exec(e.code);
      const n = pad ? Number(pad[1]) : Number(e.key);
      if (n >= 1 && n <= SLOT_COUNT && this.slots[n - 1]) onUse(this.slots[n - 1]);
    });
  }

  setVisible(v) {
    this.visible = v;
    this.container.hidden = !v && !this.placeHandler;
  }

  // 무예창 「칸에 넣기」 중(fn) / 끝(null): 창 위로 올라와 금빛으로 깜빡이고, 누르면 fn(칸 번호)
  setPlacing(fn) {
    this.placeHandler = fn || null;
    this.container.classList.toggle('placing', !!fn);
    this.container.hidden = !this.visible && !fn;
  }

  // 무예 숙련 테두리(docs/spec/feedback_1031.md 3): rank(id) → 0 기본·1 은빛·2 금빛
  setRank(rank) {
    this.rank = rank;
    for (const u of this.buttons) u.last = '';
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
      const rank = s && this.rank ? this.rank(s.id) : 0;
      const key = `${sec}|${Math.round(ratio * 120)}|${noBlade}|${rank}`;
      if (key === u.last) return;
      u.last = key;
      u.b.classList.toggle('empty', !s);
      u.b.classList.toggle('rank-silver', rank === 1);
      u.b.classList.toggle('rank-gold', rank === 2);
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
