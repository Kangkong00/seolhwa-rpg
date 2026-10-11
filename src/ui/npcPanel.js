// 사람(NPC) 창을 그리는 일만 함(무엇을 보여 줄지는 src/scenes/npcMenu.js).
// view: { title, text, actions: [{ label, onClick, disabled, primary }],
//         list: [{ icon(DOM), label, sub, right, onClick, disabled }], empty,
//         count: { max, value, label(n), confirm, onConfirm(n) }, onClose }
export class NpcPanel {
  constructor(el) {
    this.el = el;
    for (const ev of ['pointerdown', 'touchstart']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  }

  get open() {
    return !this.el.hidden;
  }

  setVisible(on) {
    this.el.hidden = !on;
  }

  btn(label, onClick, { disabled = false, primary = false, cls = '' } = {}) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (cls) b.className = cls;
    if (primary) b.classList.add('primary');
    b.disabled = disabled;
    b.addEventListener('click', onClick);
    return b;
  }

  render(view) {
    const parts = [];
    const head = document.createElement('div');
    head.className = 'equip-head';
    const title = document.createElement('div');
    title.className = 'equip-title';
    title.textContent = view.title;
    head.append(title, this.btn('닫기', view.onClose, { cls: 'equip-close' }));
    parts.push(head);
    if (view.text) {
      const t = document.createElement('div');
      t.className = 'npc-text';
      t.textContent = view.text;
      parts.push(t);
    }
    if (view.list) {
      const list = document.createElement('div');
      list.className = 'npc-list';
      if (view.list.length === 0) {
        const e = document.createElement('div');
        e.className = 'npc-empty';
        e.textContent = view.empty || '없습니다';
        list.appendChild(e);
      }
      for (const r of view.list) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'npc-row';
        b.disabled = !!r.disabled;
        if (r.icon) b.appendChild(r.icon);
        const main = document.createElement('div');
        main.className = 'row-main';
        const l = document.createElement('span');
        l.textContent = r.label;
        main.appendChild(l);
        if (r.sub) {
          const s = document.createElement('span');
          s.className = 'row-sub';
          s.textContent = r.sub;
          main.appendChild(s);
        }
        b.appendChild(main);
        if (r.right) {
          const rt = document.createElement('span');
          rt.className = 'row-right';
          rt.textContent = r.right;
          b.appendChild(rt);
        }
        if (r.onClick) b.addEventListener('click', r.onClick);
        list.appendChild(b);
      }
      parts.push(list);
    }
    if (view.count) {
      const c = view.count;
      let n = Math.max(1, Math.min(c.max, c.value || 1));
      const row = document.createElement('div');
      row.className = 'npc-count';
      const num = document.createElement('span');
      num.className = 'num';
      const ok = this.btn('', () => c.onConfirm(n), { primary: true });
      const set = (v) => {
        n = Math.max(1, Math.min(c.max, v));
        num.textContent = `${n}개`;
        ok.textContent = c.label(n);
      };
      row.append(
        this.btn('−10', () => set(n - 10)),
        this.btn('−', () => set(n - 1)),
        num,
        this.btn('+', () => set(n + 1)),
        this.btn('+10', () => set(n + 10)),
      );
      parts.push(row);
      const r2 = document.createElement('div');
      r2.className = 'npc-actions';
      r2.append(ok, this.btn('모두', () => set(c.max)));
      parts.push(r2);
      set(n);
    }
    if (view.actions && view.actions.length) {
      const a = document.createElement('div');
      a.className = 'npc-actions';
      for (const x of view.actions) a.appendChild(this.btn(x.label, x.onClick, x));
      parts.push(a);
    }
    this.el.replaceChildren(...parts);
  }
}
