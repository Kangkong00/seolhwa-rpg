// 왼쪽 위: 레벨, 체력 막대(숫자), 가는 경험치 막대, 엽전(coins.png 아이콘 + 글자), 시험 배율이 켜져 있으면 "시험 ×3".
export class StatusPanel {
  constructor(el) {
    this.level = el.querySelector('.st-level');
    this.coins = el.querySelector('.st-coins-text');
    this.hpFill = el.querySelector('.st-hp-fill');
    this.hpText = el.querySelector('.st-hp-text');
    this.expFill = el.querySelector('.st-exp-fill');
    this.boost = el.querySelector('.st-boost');
    this.last = '';
  }

  // 시험 배율 표시(docs/spec/test_boost.md). boost가 꺼져 있으면 숨김
  setBoost(boost) {
    const on = !!(boost && boost.enabled);
    const key = on ? `×${boost.exp}` : '';
    if (key === this.lastBoost) return;
    this.lastBoost = key;
    this.boost.hidden = !on;
    if (on) this.boost.textContent = `시험 ×${boost.exp}`;
  }

  // need = 다음 레벨까지 필요한 경험치(최고 레벨이면 null)
  set({ level, hp, maxHp, exp, need, coinsText }) {
    const key = `${level}|${hp}|${maxHp}|${exp}|${need}|${coinsText}`;
    if (key === this.last) return;
    this.last = key;
    this.level.textContent = `Lv ${level}`;
    this.coins.textContent = coinsText;
    this.hpFill.style.width = `${Math.max(0, Math.min(1, hp / maxHp)) * 100}%`;
    this.hpText.textContent = `${hp} / ${maxHp}`;
    this.expFill.style.width = `${need ? Math.min(1, exp / need) * 100 : 100}%`;
  }
}
