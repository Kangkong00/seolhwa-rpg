// 아이템 정보창(docs/spec/feedback_1015.md 5): 큰 아이콘·이름·종류·능력치(▲▼)·설명·파는 값·단추.
// 무엇을 보여 줄지는 src/scenes/itemInfoView.js가 정하고, 여기서는 그리기만.
// 바깥을 누르면 닫힘. PC는 마우스를 올리면 작은 창(tip).
import { itemIcon } from './itemIcon.js';

export class ItemInfo {
  constructor(el, tipEl) {
    this.el = el;
    this.box = el.querySelector('.ii-box');
    this.tip = tipEl;
    for (const ev of ['pointerdown', 'touchstart']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    // 바깥(어두운 바탕)을 누르면 닫힘
    el.addEventListener('click', (e) => {
      if (e.target === el) this.hide();
    });
  }

  get open() {
    return !this.el.hidden;
  }

  hide() {
    this.el.hidden = true;
  }

  // view: { def, kind, stats: [{ text, cmp }], warn, desc, price, actions: [{ label, onClick, disabled, primary }] }
  show(view) {
    const box = this.box;
    box.replaceChildren();
    const top = document.createElement('div');
    top.className = 'ii-top';
    top.appendChild(itemIcon(view.def));
    const t = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'ii-name';
    name.textContent = view.def.name;
    const kind = document.createElement('div');
    kind.className = 'ii-kind';
    kind.textContent = view.kind;
    t.append(name, kind);
    top.appendChild(t);
    box.appendChild(top);
    if (view.stats && view.stats.length) {
      const st = document.createElement('div');
      st.className = 'ii-stats';
      for (const s of view.stats) {
        const line = document.createElement('div');
        line.textContent = s.text;
        if (s.cmp) {
          const arrow = document.createElement('span');
          arrow.className = s.cmp > 0 ? 'up' : 'down';
          arrow.textContent = s.cmp > 0 ? ` ▲${s.diff}` : ` ▼${s.diff}`;
          line.appendChild(arrow);
        }
        st.appendChild(line);
      }
      box.appendChild(st);
    }
    if (view.warn) {
      const w = document.createElement('div');
      w.className = 'ii-warn';
      w.textContent = view.warn;
      box.appendChild(w);
    }
    for (const line of view.desc || []) {
      const d = document.createElement('div');
      d.className = 'ii-desc';
      d.textContent = line;
      box.appendChild(d);
    }
    if (view.price) {
      const p = document.createElement('div');
      p.className = 'ii-price';
      p.textContent = view.price;
      box.appendChild(p);
    }
    const acts = document.createElement('div');
    acts.className = 'ii-actions';
    for (const a of [...(view.actions || []), { label: '닫기', onClick: () => this.hide() }]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = a.label;
      b.disabled = !!a.disabled;
      if (a.primary) b.classList.add('primary');
      b.addEventListener('click', a.onClick);
      acts.appendChild(b);
    }
    box.appendChild(acts);
    this.el.hidden = false;
  }

  // PC: 마우스를 올리면 작은 창. el에 마우스가 들어오면 text()를 보여 줌
  hover(el, text) {
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.tip.textContent = text();
      this.tip.hidden = false;
      const r = el.getBoundingClientRect();
      this.tip.style.left = `${Math.min(window.innerWidth - 230, r.right + 6)}px`;
      this.tip.style.top = `${Math.max(4, r.top)}px`;
    });
    el.addEventListener('pointerleave', () => {
      this.tip.hidden = true;
    });
    el.addEventListener('click', () => {
      this.tip.hidden = true;
    });
  }
}
