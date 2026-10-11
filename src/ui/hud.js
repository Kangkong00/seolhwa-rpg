// 오른쪽 위 버튼(소리 켜기/끄기, 가방(장비창) 열고 닫기, 격자 보기)과 FPS 표시.

export class Hud {
  constructor({ onBag, onGrid, onSound }) {
    this.soundBtn = document.getElementById('btn-sound');
    this.bagBtn = document.getElementById('btn-bag');
    this.gridBtn = document.getElementById('btn-grid');
    this.fps = document.getElementById('fps');
    // 버튼을 눌러도 게임 화면 터치로 이어지지 않게
    for (const b of [this.bagBtn, this.gridBtn, this.soundBtn]) {
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
    this.bagBtn.addEventListener('click', () => onBag());
    this.gridBtn.addEventListener('click', () => onGrid());
    this.soundBtn.addEventListener('click', () => onSound());
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
