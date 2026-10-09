// 오른쪽 위 시험용 버튼(확대·축소, 옷 바꾸기, 격자 보기)과 FPS 표시.

export class Hud {
  constructor({ onOutfit, onGrid, onZoom }) {
    this.outfitBtn = document.getElementById('btn-outfit');
    this.gridBtn = document.getElementById('btn-grid');
    this.fps = document.getElementById('fps');
    this.zoomOut = document.getElementById('btn-zoom-out');
    this.zoomIn = document.getElementById('btn-zoom-in');
    this.zoomLabel = document.getElementById('zoom-label');
    // 버튼을 눌러도 게임 화면 터치로 이어지지 않게
    for (const b of [this.outfitBtn, this.gridBtn, this.zoomOut, this.zoomIn]) {
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
    this.outfitBtn.addEventListener('click', () => onOutfit());
    this.gridBtn.addEventListener('click', () => onGrid());
    this.zoomOut.addEventListener('click', () => onZoom(-1));
    this.zoomIn.addEventListener('click', () => onZoom(1));
  }

  setOutfitLabel(name) {
    this.outfitBtn.textContent = `옷: ${name}`;
  }

  setZoomLabel(zoom) {
    this.zoomLabel.textContent = `${zoom.toFixed(1)}배`;
  }

  setGridOn(on) {
    this.gridBtn.classList.toggle('on', on);
    this.fps.classList.toggle('show', on);
  }

  setFps(value) {
    this.fps.textContent = `FPS ${Math.round(value)}`;
  }
}
