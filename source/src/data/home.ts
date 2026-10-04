// 집 안(강아지 집·고양이 집)과 큰 놀이터 꾸미기: 자리(slot)마다 고를 수 있는 가구·놀이 기구
// - 가구·기구 하나에 재료 1개 (한 번 사면 계속 바꿔 놓을 수 있음). free는 처음부터 있음
// - 위치는 안전 영역(1280x800) 기준, 놀이터는 가로 2560
export type Place = 'doghouse' | 'cathouse' | 'park';

export interface SlotDef { id: string; name: string; x: number; y: number; w: number; h: number; vb: [number, number]; front?: boolean }
export interface Furn { id: string; slot: string; name: string; free?: boolean; park?: boolean }

/** 집 안 자리 (벽 y<560, 바닥 y>=560) */
export const ROOM_SLOTS: SlotDef[] = [
  { id: 'wall', name: '벽지', x: 0, y: 0, w: 0, h: 0, vb: [0, 0] },
  { id: 'window', name: '창문', x: 820, y: 80, w: 260, h: 228, vb: [240, 210] },
  { id: 'frame', name: '액자', x: 230, y: 110, w: 170, h: 160, vb: [160, 150] },
  { id: 'tower', name: '큰 가구', x: 960, y: 300, w: 160, h: 340, vb: [140, 300] },
  { id: 'plant', name: '화분', x: 40, y: 330, w: 120, h: 250, vb: [110, 230] },
  { id: 'lamp', name: '조명', x: 1130, y: 370, w: 130, h: 260, vb: [130, 260] },
  { id: 'rug', name: '깔개', x: 400, y: 600, w: 520, h: 172, vb: [480, 160], front: true },
  { id: 'bed', name: '침대', x: 150, y: 470, w: 400, h: 230, vb: [400, 230], front: true },
  { id: 'bowl', name: '밥그릇', x: 600, y: 650, w: 150, h: 86, vb: [140, 80], front: true },
  { id: 'toy', name: '장난감', x: 800, y: 580, w: 150, h: 128, vb: [140, 120], front: true },
];

/** 큰 놀이터 자리 (가로 2560) */
export const PARK_SLOTS: SlotDef[] = [
  { id: 'slide', name: '미끄럼틀', x: 110, y: 250, w: 420, h: 378, vb: [400, 360] },
  { id: 'swing', name: '그네', x: 600, y: 290, w: 350, h: 340, vb: [340, 330] },
  { id: 'tramp', name: '트램펄린', x: 1010, y: 470, w: 270, h: 166, vb: [260, 160] },
  { id: 'carousel', name: '회전목마', x: 1330, y: 270, w: 370, h: 370, vb: [360, 360] },
  { id: 'pool', name: '물놀이', x: 1760, y: 480, w: 350, h: 165, vb: [340, 160] },
  { id: 'tree', name: '나무 집', x: 2150, y: 150, w: 370, h: 474, vb: [360, 460] },
  { id: 'ball', name: '공 풀장', x: 230, y: 630, w: 330, h: 144, vb: [320, 140], front: true },
  { id: 'sand', name: '모래성', x: 760, y: 640, w: 300, h: 140, vb: [300, 140], front: true },
  { id: 'picnic', name: '돗자리', x: 1360, y: 650, w: 350, h: 124, vb: [340, 120], front: true },
  { id: 'flower', name: '꽃밭', x: 1900, y: 650, w: 350, h: 124, vb: [340, 120], front: true },
];
export const PARK_W = 2560;

export const FURN: Furn[] = [
  // 집 안
  { id: 'wall:dots', slot: 'wall', name: '분홍 물방울 벽지', free: true },
  { id: 'wall:mint', slot: 'wall', name: '민트 줄무늬 벽지' },
  { id: 'wall:night', slot: 'wall', name: '밤하늘 별 벽지' },
  { id: 'win:pink', slot: 'window', name: '분홍 커튼 창문', free: true },
  { id: 'win:blue', slot: 'window', name: '하늘 커튼 창문' },
  { id: 'win:round', slot: 'window', name: '동그란 창문' },
  { id: 'frame:paw', slot: 'frame', name: '발자국 액자' },
  { id: 'frame:rainbow', slot: 'frame', name: '무지개 액자' },
  { id: 'frame:flower', slot: 'frame', name: '꽃 액자' },
  { id: 'tower:cat', slot: 'tower', name: '캣타워' },
  { id: 'tower:box', slot: 'tower', name: '장난감 상자' },
  { id: 'tower:shelf', slot: 'tower', name: '그림책 책장' },
  { id: 'plant:pot', slot: 'plant', name: '잎 화분' },
  { id: 'plant:cactus', slot: 'plant', name: '선인장' },
  { id: 'plant:sun', slot: 'plant', name: '해바라기' },
  { id: 'lamp:mush', slot: 'lamp', name: '버섯 조명' },
  { id: 'lamp:moon', slot: 'lamp', name: '달 조명' },
  { id: 'lamp:star', slot: 'lamp', name: '별 조명' },
  { id: 'rug:round', slot: 'rug', name: '동그란 깔개' },
  { id: 'rug:heart', slot: 'rug', name: '하트 깔개' },
  { id: 'rug:star', slot: 'rug', name: '별 깔개' },
  { id: 'bed:cushion', slot: 'bed', name: '폭신 방석' },
  { id: 'bed:basket', slot: 'bed', name: '바구니 침대' },
  { id: 'bed:canopy', slot: 'bed', name: '공주 침대' },
  { id: 'bowl:bone', slot: 'bowl', name: '뼈다귀 밥그릇' },
  { id: 'bowl:fish', slot: 'bowl', name: '생선 밥그릇' },
  { id: 'bowl:milk', slot: 'bowl', name: '우유 그릇' },
  { id: 'toy:ball', slot: 'toy', name: '알록달록 공' },
  { id: 'toy:yarn', slot: 'toy', name: '털실 공' },
  { id: 'toy:bear', slot: 'toy', name: '곰 인형' },
  // 큰 놀이터
  { id: 'slide:rainbow', slot: 'slide', name: '무지개 미끄럼틀', park: true },
  { id: 'slide:spiral', slot: 'slide', name: '빙글빙글 미끄럼틀', park: true },
  { id: 'swing:pink', slot: 'swing', name: '분홍 그네', park: true },
  { id: 'swing:tire', slot: 'swing', name: '타이어 그네', park: true },
  { id: 'tramp:round', slot: 'tramp', name: '동그란 트램펄린', park: true },
  { id: 'tramp:star', slot: 'tramp', name: '별 트램펄린', park: true },
  { id: 'carousel:horse', slot: 'carousel', name: '회전목마', park: true },
  { id: 'carousel:cup', slot: 'carousel', name: '빙글빙글 찻잔', park: true },
  { id: 'pool:duck', slot: 'pool', name: '오리 수영장', park: true },
  { id: 'pool:fountain', slot: 'pool', name: '물 분수', park: true },
  { id: 'tree:house', slot: 'tree', name: '나무 위 오두막', park: true },
  { id: 'tree:apple', slot: 'tree', name: '사과나무 그네집', park: true },
  { id: 'ball:pit', slot: 'ball', name: '공 풀장', park: true },
  { id: 'ball:bubble', slot: 'ball', name: '비눗방울 기계', park: true },
  { id: 'sand:castle', slot: 'sand', name: '모래성', park: true },
  { id: 'sand:bucket', slot: 'sand', name: '모래 놀이 통', park: true },
  { id: 'picnic:mat', slot: 'picnic', name: '체크 돗자리', park: true },
  { id: 'picnic:tent', slot: 'picnic', name: '작은 텐트', park: true },
  { id: 'flower:tulip', slot: 'flower', name: '튤립 꽃밭', park: true },
  { id: 'flower:fence', slot: 'flower', name: '나비 울타리', park: true },
];
export const FURN_BY: Record<string, Furn> = Object.fromEntries(FURN.map(f => [f.id, f]));
export const optionsFor = (slot: string, park = false) => FURN.filter(f => f.slot === slot && !!f.park === park);
/** 처음부터 놓여 있는 것 */
export const DEFAULT_DECO: Record<string, string> = { wall: 'wall:dots', window: 'win:pink' };
