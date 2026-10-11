// 가게 사고팔기(화면과 무관). shop = data/npcs.json의 shop: { buys: [아이템 id], sells: [{ id, price }] }
// 가게는 자기가 사 주는 물건만 삼. 파는 값은 data/items.json sellPrice.
import { addItem, removeItem, countItem } from './equipment.js';

export function shopBuysItem(shop, id) {
  return !!shop && Array.isArray(shop.buys) && shop.buys.includes(id);
}

// 가게에 팔기. 반환: { ok, coins, reason }
export function sellToShop(inv, itemDefs, shop, id, n) {
  const def = itemDefs[id];
  if (!def || !shopBuysItem(shop, id)) return { ok: false, reason: '이 가게에서는 사지 않습니다' };
  n = Math.floor(n);
  if (n <= 0 || countItem(inv, id) < n) return { ok: false, reason: '가진 것이 모자랍니다' };
  removeItem(inv, id, n);
  const coins = (def.sellPrice || 0) * n;
  inv.coins += coins;
  return { ok: true, coins };
}

// 가게에서 사기. 반환: { ok, cost, reason }
export function buyFromShop(inv, itemDefs, shop, id, n) {
  const goods = shop && (shop.sells || []).find((g) => g.id === id);
  if (!goods || !itemDefs[id]) return { ok: false, reason: '팔지 않는 물건입니다' };
  n = Math.floor(n);
  const cost = goods.price * n;
  if (n <= 0) return { ok: false, reason: '' };
  if (inv.coins < cost) return { ok: false, reason: '엽전이 모자랍니다' };
  inv.coins -= cost;
  addItem(inv, itemDefs, id, n);
  return { ok: true, cost };
}
