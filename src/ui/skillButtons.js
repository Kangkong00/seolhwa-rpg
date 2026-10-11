// 공격 버튼 둘레의 작은 무예 버튼 3개(PC는 1·2·3 키).
// 아직 배우지 않은 무예는 흐리게, 기다리는 동안은 어둡게 덮고 남은 초를 보여 줌.
export class SkillButtons {
  // skills: data/skills.json skills, onUse(skillId)
  constructor(container, skills, onUse) {
    this.container = container;
    this.skills = skills;
    this.buttons = skills.map((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'skill-btn locked';
      b.setAttribute('aria-label', s.name);
      b.textContent = s.icon;
      const cd = document.createElement('div');
      cd.className = 'cd';
      const t = document.createElement('div');
      t.className = 'cd-text';
      b.append(cd, t);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onUse(s.id);
      });
      container.appendChild(b);
      return { b, cd, t, last: '' };
    });
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const s = skills.find((k) => k.key === e.key);
      if (s) onUse(s.id);
    });
  }

  setVisible(v) {
    this.container.hidden = !v;
  }

  // learned: 배운 무예 id 목록, remaining(id) → 남은 ms
  update(learned, remaining) {
    this.skills.forEach((s, i) => {
      const u = this.buttons[i];
      const known = learned.includes(s.id);
      const left = known ? remaining(s.id) : 0;
      const sec = left > 0 ? Math.ceil(left / 1000) : 0;
      const ratio = left > 0 ? Math.min(1, left / s.cooldownMs) : 0;
      const key = `${known}|${sec}|${Math.round(ratio * 40)}`;
      if (key === u.last) return;
      u.last = key;
      u.b.classList.toggle('locked', !known);
      u.b.classList.toggle('cooling', left > 0);
      u.cd.style.height = `${ratio * 100}%`;
      u.t.textContent = sec ? String(sec) : '';
    });
  }
}
