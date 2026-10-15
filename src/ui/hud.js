// 오른쪽 위 버튼(소리 켜기/끄기, 가방(장비창) 열고 닫기, 격자 보기)과 FPS 표시.

export class Hud {
  constructor({ onBag, onGrid, onSound, onRecall }) {
    this.soundBtn = document.getElementById('btn-sound');
    this.recallBtn = document.getElementById('btn-recall');
    this.recallLabel = this.recallBtn.querySelector('span');
    this.recallKey = '';
    this.bagBtn = document.getElementById('btn-bag');
    this.gridBtn = document.getElementById('btn-grid');
    this.fps = document.getElementById('fps');
    // 버튼을 눌러도 게임 화면 터치로 이어지지 않게
    for (const b of [this.bagBtn, this.gridBtn, this.soundBtn, this.recallBtn]) {
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
    this.bagBtn.addEventListener('click', () => onBag());
    this.recallBtn.addEventListener('click', () => onRecall());
    this.gridBtn.addEventListener('click', () => onGrid());
    this.soundBtn.addEventListener('click', () => onSound());
  }

  // count: 남은 귀환 부적, usable: 지금 쓸 수 있는 곳인지(마을이 아님), casting: 귀환 중
  setRecall(count, usable, casting) {
    const key = `${count}|${usable}|${casting}`;
    if (key === this.recallKey) return;
    this.recallKey = key;
    this.recallLabel.textContent = `귀환 ×${count}`;
    this.recallBtn.classList.toggle('dim', !usable || count <= 0);
    this.recallBtn.classList.toggle('casting', casting);
  }

  setBagOn(on) {
    this.bagBtn.classList.toggle('on', on);
  }

  setSoundOn(on) {
    this.soundBtn.textContent = on ? '소리 켬' : '소리 끔';
    this.soundBtn.classList.toggle('off', !on);
  }

  setGridOn(on) {
    this.gridBtn.classList.toggle('on', on);
    this.fps.classList.toggle('show', on);
  }

  setFps(value) {
    this.fps.textContent = `FPS ${Math.round(value)}`;
  }
}
