// 世界布局：新手村「青云村」与周边地标（单位：米；x 向东，z 向南）
export const VILLAGE_H = 1;
export const WATER_SURF = -0.2;

export const PLATFORM = { x: 78, z: -70, h: 6 }; // 聚灵台
export const RUINS = { x: -250, z: -165 }; // 古修遗迹
export const QINGYUN = { x: 30, z: -360 }; // 青云峰
export const ISLANDS = [
  { x: -60, y: 150, z: -300, r: 22, main: true },
  { x: -18, y: 136, z: -268, r: 9 },
  { x: -112, y: 166, z: -332, r: 12 },
  { x: -92, y: 128, z: -258, r: 7 },
];
export const TOWN = { x: 600, z: 0, h: 4, half: 60 }; // 落霞镇（城墙半宽）
export const VALLEY = { x: -420, z: 300, h: 20, gap: Math.atan2(-300, 420) }; // 万妖谷谷底，gap 为谷口朝向
export const LAIR = { x: -466, z: 348, rot: Math.atan2(46, -48) }; // 妖王洞前（rot：洞口朝向谷心）
export const VOLCANO = { x: 560, z: -600, R: 280, peak: 215, rim: 34 }; // 赤焰火山
export const ARENA = { x: 560, z: -478 }; // 熔岩魔君台
export const TRIB = { x: 2, z: -400 }; // 雷劫台（青云峰顶）

// 地形压平区域：r0 内完全压平到 h，r0~r1 渐变（h 为 null 时取中心自然高度）
export const ZONES = [
  { x: 0, z: 0, r0: 78, r1: 135, h: VILLAGE_H },
  { x: PLATFORM.x, z: PLATFORM.z, r0: 15, r1: 42, h: PLATFORM.h },
  { x: RUINS.x, z: RUINS.z, r0: 18, r1: 44, h: null },
  { x: TOWN.x, z: TOWN.z, r0: 74, r1: 130, h: TOWN.h },
  { x: VALLEY.x, z: VALLEY.z, r0: 74, r1: 120, h: VALLEY.h },
  { x: ARENA.x, z: ARENA.z, r0: 21, r1: 40, h: null },
  { x: TRIB.x, z: TRIB.z, r0: 13, r1: 30, h: null },
];

// 道路线段 [x1, z1, x2, z2, 宽]
export const ROADS = [
  [0, 104, 0, -31, 4.2],
  [-66, 0, 66, 0, 3.6],
  [64, 0, 72, -40, 2.6],
  [72, -40, 78, -55, 2.6],
  [31, 2, 31, 15, 2.4],
  [-36, -2, -37, -22, 2.2],
  [40, -2, 42, -38, 2.2],
  // 青云村 → 落霞镇官道
  [66, 0, 160, 6, 4], [160, 6, 290, -8, 4], [290, -8, 420, 4, 4], [420, 4, 540, 0, 4],
  // 落霞镇北门 → 赤焰山麓
  [600, -60, 592, -200, 3.2], [592, -200, 578, -342, 3.2],
  // 落霞镇南门外
  [600, 60, 604, 110, 3],
  // 石桥南 → 万妖谷口
  [0, 104, -120, 160, 3], [-120, 160, -240, 200, 3], [-240, 200, -332, 220, 3],
];
export const PLAZA = { x: 0, z: 0, r: 10.5 };
// 石板铺地：圆 {x,z,r} 或矩形 {rect:[x0,z0,x1,z1]}
export const PAVES = [
  PLAZA,
  { x: TOWN.x, z: TOWN.z, r: 15 },
  { rect: [TOWN.x - TOWN.half - 2, TOWN.z - 3.2, TOWN.x + TOWN.half + 2, TOWN.z + 3.2] },
  { rect: [TOWN.x - 3.2, TOWN.z - TOWN.half - 2, TOWN.x + 3.2, TOWN.z + TOWN.half + 2] },
];
export const FARMS = [[22, 16, 40, 40], [42, 16, 58, 40]];
export const POND = { x: -46, z: -36, r: 11 };
export const GROVES = {
  bamboo: { x: -106, z: 8, r: 44 },
  peach: { x: PLATFORM.x, z: PLATFORM.z, r: 52 },
};

// 传送阵
export const PORTALS = [
  { id: 'village', name: '青云村', x: 72, z: 12 },
  { id: 'town', name: '落霞镇', x: TOWN.x, z: TOWN.z },
  { id: 'valley', name: '万妖谷口', x: -336, z: 222 },
  { id: 'volcano', name: '赤焰山麓', x: 584, z: -352 },
  { id: 'peak', name: '雷劫台', x: TRIB.x, z: TRIB.z + 8.5 },
];

export function riverZ(x) {
  const ax = Math.abs(x);
  const t = ax <= 80 ? 0 : ax >= 320 ? 1 : (ax - 80) / 240;
  return 52 + 10 * Math.sin(x * 0.013) + 95 * Math.sin(x * 0.0023) * t * t * (3 - 2 * t);
}

// 村内手工摆放的树
export const VILLAGE_TREES = [
  [-12, -22, 'ginkgo'], [14, -24, 'maple'], [-15, 22, 'oak'], [17, 25, 'peach'],
  [-62, -22, 'oak'], [64, -20, 'oak'], [-36, -47, 'willow'], [-58, -30, 'willow'], [-50, -49, 'willow'],
  [-59, -42, 'peach'], [-22, 37, 'willow'], [27, 41, 'willow'], [-42, 34, 'willow'], [48, 46, 'willow'],
  [-14, -50, 'pine'], [14, -50, 'pine'], [-18, -36, 'ginkgo'], [18, -36, 'maple'],
  [-64, 20, 'bamboo'], [-66, 26, 'bamboo'], [-61, 30, 'bamboo'], [-68, 14, 'bamboo'], [-63, 36, 'bamboo'],
  [60, 46, 'oak'], [-30, 22, 'peach'], [8, 24, 'ginkgo'], [-8, -26, 'peach'], [52, -30, 'peach'], [30, -24, 'oak'],
  [66, 22, 'maple'], [-70, -8, 'oak'], [-26, -62, 'pine'], [22, -62, 'pine'], [0, -66, 'pine'], [58, -52, 'peach'],
];
