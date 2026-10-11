// 엽전 표시(화면과 무관). 1냥 = 10전 = 100푼(data/economy.json money).
// smallLimit 미만은 "35푼", 그 이상은 "1냥 2전 5푼"(0인 단위는 뺌).
export function formatCoins(pun, money = { jeon: 10, nyang: 100, smallLimit: 100 }) {
  const v = Math.max(0, Math.floor(pun || 0));
  if (v < money.smallLimit) return `${v}푼`;
  const nyang = Math.floor(v / money.nyang);
  const jeon = Math.floor((v % money.nyang) / money.jeon);
  const p = v % money.jeon;
  const parts = [];
  if (nyang) parts.push(`${nyang}냥`);
  if (jeon) parts.push(`${jeon}전`);
  if (p) parts.push(`${p}푼`);
  return parts.join(' ');
}
