// 격자 편집 도구 상자 (붓 크기, 파일로 내보내기, 원래대로, 닫기).

export class EditorPanel {
  constructor({ onExport, onReset, onClose }) {
    this.el = document.getElementById('editor-panel');
    this.brushBtn = document.getElementById('ed-brush');
    this.brushSize = 1;
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.brushBtn.addEventListener('click', () => {
      this.brushSize = this.brushSize === 1 ? 3 : 1;
      this.brushBtn.textContent = `붓 ${this.brushSize}칸`;
    });
    document.getElementById('ed-export').addEventListener('click', () => onExport());
    document.getElementById('ed-reset').addEventListener('click', () => {
      if (window.confirm('편집한 격자를 지우고 원래 파일 상태로 돌릴까요?')) onReset();
    });
    document.getElementById('ed-close').addEventListener('click', () => onClose());
  }

  setVisible(visible) {
    this.el.hidden = !visible;
  }
}

// 텍스트를 파일로 저장 (PC는 다운로드, 아이폰은 공유 시트가 뜰 수 있음)
export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
