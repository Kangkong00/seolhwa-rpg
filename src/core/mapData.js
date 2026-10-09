// 맵 데이터 파일(data/maps/*.json) 읽기·쓰기. 화면 코드를 참조하지 않음.
import { Grid } from './grid.js';

export function parseMap(json) {
  const grid = Grid.fromRows(json.blocked, json.cellSize);
  return {
    image: json.image,
    width: json.width,
    height: json.height,
    cellSize: json.cellSize,
    spawn: { ...json.spawn },
    occluders: json.occluders.map((o) => ({ ...o })),
    grid,
  };
}

// 시험용: 맵을 세로로만 scaleY배 늘림. 격자·가림 조각·시작 위치도 같은 배율로 따라 늘어남.
// 격자는 칸 크기(cellSize)를 그대로 두고 줄 수를 늘려, 새 줄마다 원래 격자에서 같은 높이의 줄을 가져옴.
export function scaleMapY(map, scaleY) {
  if (!scaleY || scaleY === 1) return map;
  const src = map.grid;
  const rows = Math.round(src.rows * scaleY);
  const grid = new Grid(src.cols, rows, src.cellSize);
  for (let r = 0; r < rows; r++) {
    const sr = Math.min(src.rows - 1, Math.floor((r + 0.5) / scaleY));
    grid.cells.set(src.cells.subarray(sr * src.cols, (sr + 1) * src.cols), r * src.cols);
  }
  return {
    ...map,
    height: map.height * scaleY,
    spawn: { x: map.spawn.x, y: map.spawn.y * scaleY },
    occluders: map.occluders.map((o) => ({
      ...o,
      y: o.y * scaleY,
      h: o.h * scaleY,
      baseY: o.baseY * scaleY,
      ...(o.points ? { points: o.points.map(([x, y]) => [x, y * scaleY]) } : {}),
    })),
    grid,
  };
}

// 원래 파일 모양(한 줄에 격자 한 줄)을 유지해서 내보냄. 사람이 읽고 고치기 쉽게.
export function serializeMap(originalJson, grid) {
  const out = { ...originalJson, blocked: grid.toRows() };
  const lines = ['{'];
  const keys = Object.keys(out);
  keys.forEach((k, i) => {
    const comma = i < keys.length - 1 ? ',' : '';
    const v = out[k];
    if (Array.isArray(v)) {
      lines.push(`  ${JSON.stringify(k)}: [`);
      v.forEach((item, j) => {
        lines.push(`    ${JSON.stringify(item)}${j < v.length - 1 ? ',' : ''}`);
      });
      lines.push(`  ]${comma}`);
    } else {
      lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)}${comma}`);
    }
  });
  lines.push('}');
  return lines.join('\n') + '\n';
}
