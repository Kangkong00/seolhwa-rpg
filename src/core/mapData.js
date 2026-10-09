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
