// 보이지 않는 이동 격자. 화면 코드를 참조하지 않음 (나중에 서버로 옮김).
// 칸 값: 0 = 갈 수 있음, 1 = 못 감.

export const BLOCKED_CHAR = '#';
export const OPEN_CHAR = '.';

export class Grid {
  constructor(cols, rows, cellSize, cells) {
    this.cols = cols;
    this.rows = rows;
    this.cellSize = cellSize;
    this.cells = cells || new Uint8Array(cols * rows);
  }

  // ['..##..', ...] 형태의 문자열 줄에서 만듦
  static fromRows(rowStrings, cellSize) {
    const rows = rowStrings.length;
    const cols = rows ? rowStrings[0].length : 0;
    const grid = new Grid(cols, rows, cellSize);
    for (let r = 0; r < rows; r++) {
      const line = rowStrings[r];
      for (let c = 0; c < cols; c++) {
        grid.cells[r * cols + c] = line[c] === BLOCKED_CHAR ? 1 : 0;
      }
    }
    return grid;
  }

  toRows() {
    const out = [];
    for (let r = 0; r < this.rows; r++) {
      let line = '';
      for (let c = 0; c < this.cols; c++) {
        line += this.cells[r * this.cols + c] ? BLOCKED_CHAR : OPEN_CHAR;
      }
      out.push(line);
    }
    return out;
  }

  clone() {
    return new Grid(this.cols, this.rows, this.cellSize, new Uint8Array(this.cells));
  }

  inBounds(c, r) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
  }

  // 격자 밖은 막힌 것으로 취급
  isCellBlocked(c, r) {
    if (!this.inBounds(c, r)) return true;
    return this.cells[r * this.cols + c] === 1;
  }

  setCell(c, r, blocked) {
    if (!this.inBounds(c, r)) return false;
    const i = r * this.cols + c;
    const v = blocked ? 1 : 0;
    if (this.cells[i] === v) return false;
    this.cells[i] = v;
    return true;
  }

  cellAt(x, y) {
    return { c: Math.floor(x / this.cellSize), r: Math.floor(y / this.cellSize) };
  }

  isPointBlocked(x, y) {
    const { c, r } = this.cellAt(x, y);
    return this.isCellBlocked(c, r);
  }

  // 상자 [x0, x1) × [y0, y1)가 막힌 칸에 걸치는지
  isBoxBlocked(x0, y0, x1, y1) {
    const s = this.cellSize;
    const c0 = Math.floor(x0 / s);
    const r0 = Math.floor(y0 / s);
    const c1 = Math.floor((x1 - 1e-6) / s);
    const r1 = Math.floor((y1 - 1e-6) / s);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (this.isCellBlocked(c, r)) return true;
      }
    }
    return false;
  }

  // (x, y) 칸과 이어진 갈 수 있는 칸 전부(4방향). 반환: 칸마다 1/0 (Uint8Array, 몬스터가 섬처럼 떨어진 곳에 생기거나 가지 않게)
  connectedFrom(x, y) {
    const mask = new Uint8Array(this.cols * this.rows);
    const { c, r } = this.cellAt(x, y);
    if (!this.inBounds(c, r) || this.isCellBlocked(c, r)) return mask;
    const stack = [r * this.cols + c];
    mask[stack[0]] = 1;
    while (stack.length) {
      const i = stack.pop();
      const cc = i % this.cols;
      const rr = (i - cc) / this.cols;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = cc + dc;
        const nr = rr + dr;
        if (!this.inBounds(nc, nr) || this.isCellBlocked(nc, nr)) continue;
        const j = nr * this.cols + nc;
        if (mask[j]) continue;
        mask[j] = 1;
        stack.push(j);
      }
    }
    return mask;
  }
}
