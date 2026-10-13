/** 메뉴(서비스) 직렬화 — 프리랜서가 가격을 붙여 파는 항목. */
export function toApiMenu(m: {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price_cents: number;
  active: boolean;
  sort_order: number;
}) {
  return {
    id: m.id,
    name: m.name,
    category: m.category,
    description: m.description,
    priceCents: m.price_cents,
    active: m.active,
    sortOrder: m.sort_order,
  };
}
