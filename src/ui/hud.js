// 오른쪽 위 시험용 버튼(무기 바꾸기, 옷 바꾸기, 격자 보기)과 FPS 표시.

export class Hud {
  constructor({ onOutfit, onGrid, onWeapon }) {
    this.weaponBtn = document.getElementById('btn-weapon');
    this.outfitBtn = document.getElementById('btn-outfit');
    this.gridBtn = document.getElementById('btn-grid');
    this.fps = document.getElementById('fps');
    // 버튼을 눌러도 게임 화면 터치로 이어지지 않게
    for (const b of [this.outfitBtn, this.gridBtn, this.weaponBtn]) {
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
    this.outfitBtn.addEventListener('click', () => onOutfit());
    this.gridBtn.addEventListener('click', () => onGrid());
    this.weaponBtn.addEventListener('click', () => onWeapon());
  }

  setOutfitLabel(name) {
    this.outfitBtn.textContent = `옷: ${name}`;
  }

  setWeaponLabel(name) {
    this.weaponBtn.textContent = `무기: ${name}`;
  }

  setGridOn(on) {
    this.gridBtn.classList.toggle('on', on);
    this.fps.classList.toggle('show', on);
  }

  setFps(value) {
    this.fps.textContent = `FPS ${Math.round(value)}`;
  }
}
