// 시트(art_sheets.py)로 만들지 않은 꾸미기 아이템의 옷장 아이콘 — 손으로 관리(자동 생성 아님).
// b = 정사각형 그림(art/items/<slot>-<key>) 안에서 물건이 있는 곳(0~1). 아이콘에만 쓰고, 친구 몸에 얹는 옛 방식(겹치기)에는 쓰지 않는다
// — 친구 몸에는 Claude가 검수한 착용 그림(frontwear-*-approved)만 보인다(10-27 사용자 지시).
export const ITEM_ICON_EXTRA: Record<string, { b: [number, number, number, number] }> = {
  // 11-07 선장 모자: 검수 합격한 콩이 착용 층에서 모자만 떼어 아이콘으로
  'hat:captain': { b: [0.02, 0.465, 0.98, 0.98] },
};
