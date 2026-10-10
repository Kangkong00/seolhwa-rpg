// 격자 보기: 못 가는 칸(빨강), 가림 조각 테두리(파랑), 가림 기준선 baseY(노랑),
// 맵 이동 지점(초록), 몬스터 구역(보라).

export class GridOverlay {
  constructor(scene) {
    this.g = scene.add.graphics().setDepth(1e7);
    this.g.setVisible(false);
  }

  setVisible(v) {
    this.g.setVisible(v);
  }

  draw(grid, map) {
    const { occluders, portals, spawnZones } = map;
    const g = this.g;
    const s = grid.cellSize;
    g.clear();

    // 가는 선 격자
    g.lineStyle(1, 0xffffff, 0.12);
    for (let c = 0; c <= grid.cols; c++) g.lineBetween(c * s, 0, c * s, grid.rows * s);
    for (let r = 0; r <= grid.rows; r++) g.lineBetween(0, r * s, grid.cols * s, r * s);

    // 막힌 칸: 가로로 이어진 칸은 한 번에 그림
    g.fillStyle(0xff2020, 0.38);
    for (let r = 0; r < grid.rows; r++) {
      let start = -1;
      for (let c = 0; c <= grid.cols; c++) {
        const b = c < grid.cols && grid.isCellBlocked(c, r);
        if (b && start < 0) start = c;
        if (!b && start >= 0) {
          g.fillRect(start * s, r * s, (c - start) * s, s);
          start = -1;
        }
      }
    }

    for (const o of occluders) {
      g.lineStyle(1.5, 0x3399ff, 0.9);
      if (o.shape === 'ellipse') g.strokeEllipse(o.x + o.w / 2, o.y + o.h / 2, o.w, o.h);
      else if (o.shape === 'poly') g.strokePoints(o.points.map(([x, y]) => ({ x, y })), true);
      else g.strokeRect(o.x, o.y, o.w, o.h);
      // 노란 선: baseY (가로 길이 = 가려지는 범위 hideX)
      const [hx0, hx1] = o.hideX || [o.x, o.x + o.w];
      g.lineStyle(1.5, 0xffdd00, 0.9);
      g.lineBetween(hx0, o.baseY, hx1, o.baseY);
    }

    g.lineStyle(2, 0x33ff66, 1);
    g.fillStyle(0x33ff66, 0.3);
    for (const p of portals) {
      g.fillRect(p.x, p.y, p.w, p.h);
      g.strokeRect(p.x, p.y, p.w, p.h);
    }
    g.lineStyle(1.5, 0xcc66ff, 0.9);
    for (const z of spawnZones) g.strokeRect(z.x, z.y, z.w, z.h);
  }
}
