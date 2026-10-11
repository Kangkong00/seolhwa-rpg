// 왼쪽 위: 레벨, 체력 막대(숫자), 가는 경험치 막대, 엽전.
export class StatusPanel {
  constructor(el) {
    this.level = el.querySelector('.st-level');
    this.coins = el.querySelector('.st-coins');
    this.hpFill = el.querySelector('.st-hp-fill');
    this.hpText = el.querySelector('.st-hp-text');
    this.expFill = el.querySelector('.st-exp-fill');
    this.last = '';
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
