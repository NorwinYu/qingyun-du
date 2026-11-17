// 游戏数据：境界、物品、丹方、任务、NPC、妖兽
export const REALMS = [];
REALMS.push({ name: '凡人', need: 40 });
const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
for (let i = 1; i <= 9; i++) REALMS.push({ name: `炼气${CN[i - 1]}层`, need: 60 + 45 * i });
REALMS.push({ name: '筑基初期', need: 900 }, { name: '筑基中期', need: 1400 }, { name: '筑基后期', need: 2000 }, { name: '金丹初期', need: Infinity });
REALMS[9].gate = 'zhuji'; // 突破到下一境界所需丹药
REALMS[12].gate = 'jindan';
REALMS[9].trib = 'small'; // 突破时降下天劫
REALMS[12].trib = 'big';
export const R_QI = 1, R_WIND = 3, R_ZHUJI = 10, R_JINDAN = 13;
export const realmStats = (i) => ({
  hp: 100 + 28 * i + (i >= R_ZHUJI ? 220 : 0) + (i >= R_JINDAN ? 500 : 0),
  mp: i === 0 ? 0 : 30 + 18 * i + (i >= R_ZHUJI ? 120 : 0),
  atk: 6 + 3 * i + (i >= R_ZHUJI ? 14 : 0),
});

// icon: [形状, 主色, 辅色]
export const ITEMS = {
  stone: { name: '灵石', desc: '蕴含灵气的晶石，修士间的硬通货。', icon: ['gem', '#7fe8ff', '#e8ffff'] },
  lingcao: { name: '灵草', desc: '吸纳天地灵气而生的青草，炼丹的基础药材。', icon: ['herb', '#4fb85a', '#b6ffd8'] },
  dewflower: { name: '凝露花', desc: '只在水畔绽放，花心凝着一滴永不干涸的晨露。', icon: ['flower', '#8fc8ff', '#ffffff'] },
  firefruit: { name: '赤炎果', desc: '生于山岩之间，入手温热，火气充盈。', icon: ['fruit', '#ff5a30', '#ffd070'] },
  icelotus: { name: '寒冰莲', desc: '雪线之上的奇花，千年不化。', icon: ['flower', '#bfeaff', '#7fb8ff'] },
  lingzhi: { name: '千年灵芝', desc: '古修洞府中孕育千年的灵物，是炼制筑基丹的主药。', icon: ['shroom', '#c8503a', '#ffd890'] },
  fang: { name: '妖狼牙', desc: '妖狼的獠牙，锋利异常，可作锻材。', icon: ['fang', '#f0ead8', '#b8b0a0'] },
  hide: { name: '野猪皮', desc: '厚实的兽皮，可在药铺换些灵石。', icon: ['hide', '#8a5a3a', '#5a3a24'] },
  core: { name: '妖丹', desc: '妖兽体内凝结的精元，丹药的上佳辅料。', icon: ['pill', '#b060ff', '#f0c8ff'] },
  huichun: { name: '回春丹', desc: '服用后恢复六成气血。', icon: ['pill', '#5fd070', '#d8ffd8'], use: 'hp' },
  ningshen: { name: '凝神丹', desc: '服用后灵力尽复。', icon: ['pill', '#58a8ff', '#d8f0ff'], use: 'mp' },
  juqi: { name: '聚气丹', desc: '服用后增加 120 点修为。', icon: ['pill', '#ffc040', '#fff0c0'], use: 'xp' },
  bingpo: { name: '冰魄丹', desc: '服用后永久增加 20 点气血上限。', icon: ['pill', '#c8f4ff', '#ffffff'], use: 'maxhp' },
  zhuji: { name: '筑基丹', desc: '炼气圆满后服之，可铸就道基。（修为圆满时按 B 突破）', icon: ['pill', '#ff7848', '#ffe0a0'] },
  jindan: { name: '九转金丹', desc: '传说中的仙丹。筑基圆满后服之，可凝结金丹。', icon: ['pill', '#ffd040', '#ffffff'] },
  sword_iron: { name: '铁剑', desc: '村中铁匠打造的凡铁长剑。攻击 +6', icon: ['sword', '#cfd6e0', '#6a4a30'], weapon: 6, model: 'iron' },
  sword_jade: { name: '青锋剑', desc: '以妖狼牙淬炼的灵剑，剑身泛着青芒。攻击 +18', icon: ['sword', '#8ff0d8', '#e0b040'], weapon: 18, model: 'jade' },
  sword_fly: { name: '流云飞剑', desc: '青云宗遗宝，可御之凌空。攻击 +34', icon: ['sword', '#9fe8ff', '#ffe070'], weapon: 34, model: 'fly' },
  manual_fly: { name: '《御剑诀》', desc: '记载御剑飞行之法的玉简。筑基之后方可参悟。', icon: ['scroll', '#e8d8a8', '#6ad0c0'] },
  manual_shield: { name: '《金刚护体诀》', desc: '天机阁秘传。参悟后习得「金光护体」（G）：灵力化为金光，抵御七成伤害。', icon: ['scroll', '#f0d890', '#d8a030'], use: 'learn', skill: 'shield' },
  manual_wanjian: { name: '《万剑归宗》', desc: '炎阳宗镇派剑诀。参悟后习得「万剑归宗」（R）：召万千剑影自天而降。', icon: ['scroll', '#ffb890', '#ff5a30'], use: 'learn', skill: 'wanjian' },
  fire_essence: { name: '地火之精', desc: '地脉深处凝结的火之精华，炼器至宝。', icon: ['gem', '#ff6a2a', '#ffe0a0'] },
  meteor_iron: { name: '天外陨铁', desc: '自九天坠落的星铁，坚不可摧，可铸神兵。', icon: ['ore', '#6a7488', '#c8e0ff'] },
  wolf_core: { name: '妖王内丹', desc: '妖狼王的内丹，蕴含百年妖力。可在万宝楼换取大量灵石。', icon: ['pill', '#d03050', '#ffb0c0'] },
  sword_chixiao: { name: '赤霄剑', desc: '以地火精与天外陨铁铸成的炎阳名剑，剑锋流火。攻击 +58', icon: ['sword', '#ff8a50', '#ffd040'], weapon: 58, model: 'chixiao' },
  robe_cloud: { name: '云纹法衣', desc: '织入避尘符文的法衣。防御 +6，气血 +40', icon: ['robe', '#8ab8e8', '#e8f0ff'], slot: 'armor', eq: { def: 6, hp: 40 } },
  armor_turtle: { name: '玄龟甲', desc: '以兽皮为里、地火为锻的护身宝甲。防御 +18，气血 +160', icon: ['robe', '#4a6a58', '#d8c070'], slot: 'armor', eq: { def: 18, hp: 160 } },
  jade_pendant: { name: '灵犀玉佩', desc: '温润的灵玉，佩之心神澄明。灵力 +60，灵力回复加快', icon: ['charm', '#8ff0c8', '#ffffff'], slot: 'charm', eq: { mp: 60, regen: 0.6 } },
  fire_gourd: { name: '赤炎葫芦', desc: '封着一缕地火的法宝葫芦。攻击 +14，灵力 +30', icon: ['gourd', '#e04a28', '#ffd060'], slot: 'charm', eq: { atk: 14, mp: 30 } },
  // 垂钓所得
  fish_carp: { name: '青鳞鲤', desc: '青云河里最常见的鲤鱼，烤来鲜美。食用恢复三成气血。', icon: ['fish', '#6a9a8a', '#d8f0e0'], use: 'food' },
  fish_silver: { name: '银鳞鱼', desc: '鳞片如银，醉仙楼高价收购。', icon: ['fish', '#c8d4e0', '#ffffff'] },
  fish_koi: { name: '灵纹锦鲤', desc: '吸纳河中灵气的锦鲤，身有金纹。食之增加 120 点修为。', icon: ['fish', '#ff8a3a', '#ffe0a0'], use: 'xp' },
  pearl: { name: '河蚌灵珠', desc: '河蚌孕育的灵珠，温润有光。可在万宝楼换取灵石。', icon: ['pill', '#f0eaff', '#ffffff'] },
  fish_dragon: { name: '金鳞龙鱼', desc: '传说中跃过龙门的异种，百年难遇。食之永久增加 20 点气血上限。', icon: ['fish', '#ffc840', '#fff4c0'], use: 'maxhp' },
  // 宗门宝库
  spore: { name: '灵芝孢子', desc: '千年灵芝的孢子。种于灵田，悉心照料可长成千年灵芝。', icon: ['shroom', '#a8603a', '#ffe0a0'] },
  manual_cloud: { name: '《踏云步》', desc: '青云宗外门身法。参悟后身法永久提升 8%。', icon: ['scroll', '#d8e8f0', '#5ab8e8'], use: 'passive', passive: { spd: 0.08 } },
  manual_yuan: { name: '《归元心经》', desc: '青云宗内门心法。参悟后气血 +80，灵力回复 +50%。', icon: ['scroll', '#e0f0d8', '#5ad08a'], use: 'passive', passive: { hp: 80, regen: 0.5 } },
  manual_taixu: { name: '《太虚剑意》', desc: '青云宗真传剑意。参悟后攻击 +10%，会心 +5%。', icon: ['scroll', '#f0e0d0', '#e85a3a'], use: 'passive', passive: { atkMul: 0.1, crit: 0.05 } },
};

export const RECIPES = [
  { out: 'huichun', n: 2, need: { lingcao: 2, dewflower: 1 } },
  { out: 'ningshen', n: 2, need: { dewflower: 2, firefruit: 1 } },
  { out: 'juqi', n: 1, need: { lingcao: 3, core: 1 } },
  { out: 'bingpo', n: 1, need: { icelotus: 1, core: 1 } },
  { out: 'zhuji', n: 1, need: { lingzhi: 1, core: 3, firefruit: 2 } },
];

// 炼器（地火熔炉）
export const FORGE = [
  { out: 'sword_chixiao', n: 1, need: { fire_essence: 1, meteor_iron: 1, core: 4 } },
  { out: 'armor_turtle', n: 1, need: { hide: 6, core: 3, fire_essence: 1 } },
  { out: 'fire_gourd', n: 1, need: { firefruit: 4, fire_essence: 1, stone: 60 } },
  { out: 'jade_pendant', n: 1, need: { dewflower: 4, meteor_iron: 1, stone: 40 } },
];

// 灵根：五行 + 变异；grade 决定修炼速度
export const ROOTS = {
  metal: { name: '金', color: '#ffe08a', trail: 0xffe08a, desc: '攻击 +15%' },
  wood: { name: '木', color: '#8fffb0', trail: 0x8fffb0, desc: '气血回复 +60%' },
  water: { name: '水', color: '#8fd8ff', trail: 0x8fd8ff, desc: '灵力上限 +25%' },
  fire: { name: '火', color: '#ff8a4a', trail: 0xff8a4a, desc: '剑气伤害 +30%' },
  earth: { name: '土', color: '#e8c070', trail: 0xe8c070, desc: '防御 +8，气血 +10%' },
  thunder: { name: '雷', color: '#c8b0ff', trail: 0xb8a0ff, desc: '变异灵根 · 剑气 +20%，天劫伤害减半' },
};
export const ROOT_GRADES = [
  { name: '天灵根', xp: 1.6, p: 0.1 }, { name: '地灵根', xp: 1.35, p: 0.3 }, { name: '玄灵根', xp: 1.15, p: 0.4 }, { name: '伪灵根', xp: 1.0, p: 0.2 },
];

// 功法技能：key 为按键，mp 消耗，cd 冷却（秒）
export const SKILLS = {
  qi: { name: '剑气', key: 'Q', mp: 8, cd: 0.6, desc: '凝灵力于剑锋，斩出月牙剑气。' },
  dash: { name: '瞬身', key: 'V', mp: 10, cd: 1.1, desc: '缩地成寸，瞬间位移并无敌片刻。' },
  shield: { name: '金光护体', key: 'G', mp: 30, cd: 18, desc: '金光罩体 6 秒，抵御七成伤害。' },
  wanjian: { name: '万剑归宗', key: 'R', mp: 60, cd: 20, desc: '召唤剑雨覆盖前方，重创群敌。' },
};

export const HERBS = {
  lingcao: { stem: 0x3f9a4a, a: 0x58c060, b: 0x9ff8d8, shape: 'grass' },
  dewflower: { stem: 0x3f8a5a, a: 0x9fd0ff, b: 0xffffff, shape: 'flower' },
  firefruit: { stem: 0x5a4028, a: 0x3f7a34, b: 0xff5028, shape: 'bush' },
  icelotus: { stem: 0x9fd8e8, a: 0xd8f4ff, b: 0x8fc8ff, shape: 'lotus' },
  lingzhi: { stem: 0xe8d8b8, a: 0xa8482a, b: 0xffd890, shape: 'shroom' },
};

// 妖兽：aggro 仇恨范围，passive 不主动攻击，flee 遇人逃跑
export const MOBS = {
  rabbit: { name: '雪兔', hp: 12, atk: 0, speed: 6.5, xp: 3, flee: true, drops: [['stone', 0.25, 1, 1]] },
  chicken: { name: '芦花鸡', hp: 1, atk: 0, speed: 2.2, xp: 0, ambient: true, drops: [] },
  wolf: { name: '妖狼', hp: 42, atk: 9, speed: 6.6, xp: 14, aggro: 15, range: 1.7, cd: 1.5, drops: [['fang', 0.7, 1, 1], ['core', 0.18, 1, 1], ['stone', 1, 2, 5]] },
  boar: { name: '山猪', hp: 75, atk: 13, speed: 5.4, xp: 20, aggro: 9, range: 1.8, cd: 1.9, drops: [['hide', 0.75, 1, 1], ['core', 0.22, 1, 1], ['stone', 1, 3, 6]] },
  wisp: { name: '幽磷灵火', hp: 60, atk: 16, speed: 4.6, xp: 34, aggro: 16, range: 1.6, cd: 1.6, float: true, drops: [['core', 0.6, 1, 1], ['stone', 1, 4, 9]] },
  golem: { name: '镇墓石灵', hp: 640, atk: 30, speed: 3.3, xp: 320, aggro: 22, range: 3.0, cd: 2.6, boss: true, title: '遗 迹 守 卫', drops: [['core', 1, 3, 3], ['stone', 1, 40, 60]] },
  bloodwolf: { name: '血狼', hp: 80, atk: 14, speed: 7.2, xp: 30, aggro: 18, range: 1.8, cd: 1.4, model: 'wolf', pal: 'blood', drops: [['fang', 0.8, 1, 2], ['core', 0.3, 1, 1], ['stone', 1, 4, 8]] },
  wolfking: { name: '妖狼王', hp: 1500, atk: 34, speed: 7.6, xp: 700, aggro: 28, range: 3.2, cd: 2.0, boss: true, model: 'wolf', pal: 'king', scale: 2.5, special: 'wolfking', title: '万 妖 谷 主', drops: [['wolf_core', 1, 1, 1], ['core', 1, 3, 4], ['stone', 1, 80, 120]] },
  firewisp: { name: '火灵', hp: 150, atk: 30, speed: 5, xp: 60, aggro: 18, range: 1.7, cd: 1.5, float: true, model: 'wisp', pal: 'fire', drops: [['fire_essence', 0.12, 1, 1], ['core', 0.5, 1, 1], ['stone', 1, 6, 12]] },
  lavagolem: { name: '熔岩魔君', hp: 3400, atk: 62, speed: 3.6, xp: 1600, aggro: 26, range: 3.6, cd: 2.4, boss: true, model: 'golem', pal: 'lava', scale: 1.7, special: 'lava', title: '赤 焰 魔 君', drops: [['core', 1, 4, 6], ['stone', 1, 150, 200]] },
  trialboss: { name: '镜中剑魔', hp: 620, atk: 19, speed: 8, xp: 420, aggro: 80, range: 2.2, cd: 1.25, boss: true, humanoid: true, special: 'demon', title: '秘 境 之 主', sword: 'chixiao', drops: [['core', 1, 2, 3], ['stone', 1, 60, 100]],
    look: { sex: 'm', hair: 'pony', outfit: 'armor', acc: 'none', glowEye: 1, stubble: 0, col: { skin: 0xc8c0d8, hair: 0xe8e8f0, robe: 0x2a2440, trim: 0xd8b060, sash: 0x8a2a2a, inner: 0x1a1428, pants: 0x1a1428, boots: 0x0e0c14, iris: 0xffd060, lip: 0x6a4a60 } } },
  heartdemon: { name: '心魔', hp: 2600, atk: 52, speed: 8.5, xp: 0, aggro: 60, range: 2.2, cd: 1.1, boss: true, humanoid: true, special: 'demon', title: '心 魔 劫', drops: [] },
};

export const NPCS = {
  chief: { name: '村长 · 李青山', look: { sex: 'm', age: 'old', hair: 'elder', beard: 'long', outfit: 'daopao', col: { skin: 0xe8c8a0, hair: 0xd8d8d8, robe: 0x5a3a78, trim: 0xd8b060, sash: 0x2a2030, pants: 0x3a3040, boots: 0x201820 }, idle: 'behind' },
    idle: ['青云山上曾有仙宗，如今只余几座浮空的残峰。', '修行之道，贵在持之以恒。', '夜里山野间妖兽凶猛，量力而行。'] },
  elder: { name: '守台人 · 云鹤', look: { sex: 'm', age: 'old', hair: 'elder', beard: 'long', outfit: 'daopao', col: { skin: 0xe8c8a0, hair: 0xf0f0f0, robe: 0xe8eef4, trim: 0x6ad0c0, sash: 0x4a7a8a, pants: 0xd0d8e0, boots: 0x404850 } },
    idle: ['聚灵台下有一道灵脉，在此打坐，事半功倍。', '天地有灵，静心方能感应。', '老朽守此台已一甲子了。'] },
  herbalist: { name: '药师 · 苏婉', look: { sex: 'f', hair: 'long', outfit: 'dress', col: { skin: 0xf4d8b8, hair: 0x2a1a14, robe: 0x4a9a6a, trim: 0xf0f0e0, sash: 0xd8b060, pants: 0xe0e0d0, boots: 0x5a4030, inner: 0xf4f0e0 }, idle: 'clasp' },
    idle: ['河边常有凝露花，山岩间能寻到赤炎果。', '炼丹炉就在铺子旁边，药材齐了便可自己开炉。', '雪线之上的寒冰莲，可炼冰魄丹。'], shop: 'herbalist' },
  smith: { name: '铁匠 · 王大锤', look: { sex: 'm', hair: 'crop', beard: 'short', outfit: 'tunic', build: 'stout', acc: 'none', col: { skin: 0xd8a878, hair: 0x1a1210, robe: 0x6a3a2a, trim: 0x2a2020, sash: 0x8a8f9a, pants: 0x3a3030, boots: 0x201810 }, scale: 1.08, idle: 'akimbo' },
    idle: ['好剑要千锤百炼，修行也是这个理。', '凡铁终究是凡铁，得有灵材才能打出灵剑。', '嘿，炉火正旺！'] },
  hunter: { name: '猎户 · 赵虎', look: { sex: 'm', hair: 'crop', outfit: 'tunic', hat: true, col: { skin: 0xd8b088, hair: 0x2a1a10, robe: 0x5a6a3a, trim: 0x8a6a40, sash: 0x3a2a1a, pants: 0x4a4030, boots: 0x2a2018 }, idle: 'akimbo' },
    idle: ['过了桥往南是大片林子，妖狼就在里头。', '西边竹海深处有座古修遗迹，寻常人可不敢靠近。', '山猪皮糙肉厚，别跟它硬碰。'] },
  tianji: { name: '天机阁主 · 玄机子', look: { sex: 'm', age: 'old', hair: 'elder', beard: 'long', outfit: 'daopao', col: { skin: 0xe8c8a0, hair: 0xb8b8c0, robe: 0x2a3458, trim: 0xd8b060, sash: 0x8a6a30, pants: 0x2a2a3a, boots: 0x18181f } },
    idle: ['天机不可尽泄，但可略窥一二。', '星象有变，西南妖气、北方火光，皆是劫数。', '修行者，逆天而行。'] },
  guard: { name: '镇守 · 秦烈', look: { sex: 'm', hair: 'crop', outfit: 'armor', acc: 'none', col: { skin: 0xd8a878, hair: 0x1a1210, robe: 0x7a2a22, trim: 0x2a2a2a, sash: 0x5a5a60, pants: 0x2a2626, boots: 0x18120e }, scale: 1.1, idle: 'guard' },
    idle: ['落霞镇有我在，妖物休想进城。', '城门入夜不关，修士往来，热闹得很。', '小心镇外的山猪，它们最近凶得很。'] },
  merchant: { name: '万宝楼掌柜 · 钱多多', look: { sex: 'm', hair: 'bun', beard: 'short', outfit: 'robe', build: 'stout', col: { skin: 0xf0d0b0, hair: 0x2a1a14, robe: 0xb88a2a, trim: 0x8a2a1a, sash: 0x5a3018, pants: 0x4a3a28, boots: 0x2a1a10 }, scale: 1.05, idle: 'clasp' },
    idle: ['客官，万宝楼童叟无欺！', '妖王内丹？那可是稀罕物，我出高价！', '灵石在手，天下我有。'], shop: 'merchant' },
  tamer: { name: '灵兽阁主 · 白芷', look: { sex: 'f', hair: 'loose', outfit: 'dress', col: { skin: 0xf4d8b8, hair: 0xe8e8f0, robe: 0xe8f0e8, trim: 0x5ab88a, sash: 0x3a7a5a, pants: 0xd8e0d8, boots: 0x4a5a4a }, idle: 'clasp' },
    idle: ['灵兽通人性，你待它真心，它便以命相护。', '九尾灵狐？那可是上古灵种……', '阁中的仙鹤，是我从小养大的。'] },
  storyteller: { name: '说书人 · 柳先生', look: { sex: 'm', age: 'old', hair: 'crop', beard: 'short', outfit: 'robe', col: { skin: 0xe0b890, hair: 0x8a8a8a, robe: 0x4a5a6a, trim: 0xd8d0b0, sash: 0x2a3440, pants: 0x3a3a40, boots: 0x201820 } },
    idle: ['话说三百年前，赤焰火山地火冲天，一尊魔君破封而出——', '那青云宗剑修一剑西来，天地失色！', '欲知后事如何，且听下回分解！'] },
  yanji: { name: '炎阳遗孤 · 炎姬', look: { sex: 'f', hair: 'pony', outfit: 'dress', col: { skin: 0xf6dcc4, hair: 0x5a0e0a, robe: 0xc8321e, trim: 0xffc040, sash: 0x3a0e0a, pants: 0x7a1a12, boots: 0x2a0a08, inner: 0xffe0b0 }, idle: 'akimbo' },
    idle: ['三百年了……炎阳宗的火，不能在我手里熄灭。', '地火熔炉还暖着，你可以用它炼器。', '火山之下，是魔君的残念。'] },
};
export const VILLAGER_LOOKS = [
  { sex: 'm', hair: 'bun', outfit: 'tunic', acc: 'none', col: { skin: 0xf0d0b0, hair: 0x2a1a14, robe: 0xb85a4a, trim: 0xf0e0c0, sash: 0x5a3020, pants: 0x4a4038, boots: 0x2a2018 } },
  { sex: 'm', hair: 'crop', outfit: 'tunic', hat: true, col: { skin: 0xe8c8a0, hair: 0x3a2a1a, robe: 0x4a6a9a, trim: 0xd8d8d8, sash: 0x2a3a5a, pants: 0x3a3a40, boots: 0x201820 } },
  { sex: 'f', hair: 'long', outfit: 'dress', col: { skin: 0xf4d8b8, hair: 0x1a1210, robe: 0xd89ab0, trim: 0xffffff, sash: 0xb85a7a, pants: 0xe8d8d8, boots: 0x6a4040 } },
  { sex: 'm', age: 'old', hair: 'crop', beard: 'short', outfit: 'robe', col: { skin: 0xe0b890, hair: 0x9a9a9a, robe: 0x7a6a4a, trim: 0x3a3020, sash: 0x3a3020, pants: 0x4a4030, boots: 0x2a2018 }, idle: 'behind' },
  { sex: 'f', age: 'child', hair: 'twin', outfit: 'tunic', col: { skin: 0xf0d0b0, hair: 0x2a1a14, robe: 0x6a9a8a, trim: 0xe8e8d0, sash: 0x3a5a4a, pants: 0x3a4038, boots: 0x2a2018 } },
  { sex: 'f', hair: 'pony', outfit: 'dress', col: { skin: 0xe8c8a0, hair: 0x1a1210, robe: 0x8a5aa0, trim: 0xe0c070, sash: 0x4a2a5a, pants: 0x3a3040, boots: 0x201820 } },
];
export const VILLAGER_LINES = [
  '今年的稻子长得真好。', '听说青云峰顶上能看见浮空的仙山！', '村口那棵古树，比村子的年纪还大。', '客栈的灵茶可是一绝。',
  '晚上别往林子里跑，有妖兽。', '我也想修仙……可惜没有灵根。', '藏经塔顶的灯，夜里十里外都看得见。', '河里的鱼最近特别肥。',
];

export const TOWN_LINES = [
  '万宝楼的掌柜，连妖兽的骨头都收。', '醉仙楼的桃花酿，喝一口能做三天好梦。', '听说天机阁主能算出人的前世今生。', '北边的火山最近总在冒烟，怪吓人的。',
  '灵兽阁的仙鹤会送信，比驿马快多了。', '镇中心的传送阵，据说是上古修士留下的。', '昨夜有流星落在城外，好亮！', '有修士从万妖谷逃回来，说那儿的狼王有房子那么大。',
];
// 古修残魂（奇遇）所述往事
export const LORE = [
  '吾乃青云宗第七代弟子……三百年前那一战，师尊以身化剑，才将魔君镇入地火……',
  '炎阳宗的师姐说，封印每三百年便会松动一次……算算日子，也该到了……',
  '心魔劫……最难的从来不是天雷，而是你自己……',
  '万妖谷本是灵兽栖息之地，自从那头狼吞了谷中灵脉，便成了妖窟……',
  '御剑之术，在心不在剑。心若不定，剑亦难飞……',
];

// 任务。obj: talk/kill/have/realm/chest/craft/flag；at 为地图目标点（见 Game.locs）；ch 为章节标题
export const QUESTS = [
  { id: 'intro', name: '初入青云', auto: true, giver: 'hunter', turnIn: 'chief', ch: '第一章 · 青云初醒',
    desc: '你在青云村外醒来，只记得要去寻仙问道。先去村北大殿拜见村长吧。',
    obj: [{ t: 'talk', npc: 'chief', text: '拜见村长李青山（沿主路向北）' }],
    done: '年轻人，根骨不错。青云村虽小，却坐落在灵脉之上。这柄铁剑你且拿去防身，再传你一篇《引气诀》——静心打坐，便可吸纳天地灵气。',
    reward: { items: { sword_iron: 1, huichun: 2 }, flags: ['meditate'], xp: 20 } },
  { id: 'root', name: '灵根初测', pre: ['intro'], giver: 'chief', turnIn: 'chief',
    offer: '修仙先看灵根。大殿前西侧那块测灵石，是青云宗留下的旧物。把手按上去试试（按 E）——它会告诉你，你与哪一道天地灵气最为亲近。',
    desc: '在大殿前的测灵石上测试灵根。',
    obj: [{ t: 'flag', flag: 'root', text: '在大殿前的测灵石测试灵根', at: 'rootStone' }],
    progress: '测灵石就在大殿前，台阶西侧，会发光的那块。',
    done: '果然有灵根！灵根既显，便是天意。往后修行顺着它的性子走，事半功倍。去聚灵台打坐吧。',
    reward: { items: { juqi: 1, stone: 5 }, xp: 30 } },
  { id: 'qi', name: '引气入体', pre: ['intro'], giver: 'chief', turnIn: 'elder',
    offer: '村子东北的桃林深处有一座聚灵台，那里灵气最盛。去台上打坐（按 C），待你引气入体、踏入炼气境，再去见守台的云鹤道长。',
    desc: '在聚灵台上打坐修炼，修为圆满后按 B 突破，直到踏入炼气一层。',
    obj: [{ t: 'realm', n: 1, text: '修炼至炼气一层（聚灵台打坐更快）', at: 'platform' }, { t: 'talk', npc: 'elder', text: '与聚灵台的云鹤道长交谈' }],
    progress: '去吧，聚灵台就在东北方的桃林里，沿着石灯走。',
    done: '不错，灵气已在你经脉中流转。既入炼气，便可将灵力凝于剑锋——这一式「剑气」你记好了（按 Q 释放）。到炼气二层，还可学会「瞬身」（V）。',
    reward: { items: { juqi: 2, stone: 10 }, xp: 40 } },
  { id: 'herb', name: '悬壶济世', pre: ['intro'], giver: 'herbalist', turnIn: 'herbalist',
    offer: '小友来得正好。铺子里的药材见底了，能帮我采 4 株灵草、2 朵凝露花吗？灵草遍地都是，凝露花去村南石桥两侧的河岸找，村西北凉亭旁的池塘边也有。会发光的就是。',
    desc: '为药师苏婉采集药材。发光的植物可按 E 采集。',
    obj: [{ t: 'have', item: 'lingcao', n: 4 }, { t: 'have', item: 'dewflower', n: 2 }],
    progress: '灵草 4 株，凝露花 2 朵。去村南石桥两侧河岸，或村西北凉亭旁的池塘边找凝露花。',
    done: '多谢！这几枚回春丹你收着。旁边的炼丹炉你可以随意使用，丹方我也一并教给你。',
    reward: { items: { huichun: 3, stone: 12 }, flags: ['alchemy'], xp: 40 }, take: true },
  { id: 'wolf', name: '林中妖狼', pre: ['intro'], giver: 'hunter', turnIn: 'hunter',
    offer: '最近妖狼闹得凶，都敢到河边来了。你既拿了剑，可愿替村子除掉 5 头？过了桥，林子里到处都是。',
    desc: '到河对岸的树林中猎杀妖狼。',
    obj: [{ t: 'kill', kind: 'wolf', n: 5 }],
    progress: '妖狼成群，小心别被围住。打不过就吃丹药。',
    done: '好身手！这些灵石是村里凑的谢礼。妖狼牙留着，王铁匠用得上。',
    reward: { items: { stone: 30, juqi: 1 }, xp: 80 } },
  { id: 'sword', name: '青锋出鞘', pre: ['wolf'], giver: 'smith', turnIn: 'smith',
    offer: '听说你宰了不少妖狼？带 4 颗妖狼牙和 30 灵石来，我给你打一柄真正的灵剑！',
    desc: '把妖狼牙和灵石交给铁匠，打造青锋剑。',
    obj: [{ t: 'have', item: 'fang', n: 4 }, { t: 'have', item: 'stone', n: 30 }],
    progress: '4 颗妖狼牙，30 灵石，一样不能少。',
    done: '成了！瞧这剑身上的青芒——青锋剑，拿好！',
    reward: { items: { sword_jade: 1 }, xp: 60 }, take: true },
  { id: 'ruins', name: '古修遗迹', pre: ['qi'], realm: 4, giver: 'chief', turnIn: 'chief', ch: '第二章 · 遗迹石灵',
    offer: '你的修为已有小成。村子西边、竹海尽头有一处古修遗迹，里面的石灵近来躁动不安。去击败它，遗迹中的遗匣或许藏着筑基的机缘。',
    desc: '前往西边的古修遗迹，击败镇墓石灵并开启遗匣。',
    obj: [{ t: 'kill', kind: 'golem', n: 1 }, { t: 'chest', id: 'ruins', text: '开启古修遗匣', at: 'ruins' }],
    progress: '遗迹在村子正西偏北，穿过竹海便是。石灵出手很慢，看准了再躲。',
    done: '千年灵芝、《御剑诀》……果然是前辈遗泽！灵芝是炼筑基丹的主药，你先收好。另外，东边落霞镇的天机阁主前些日子捎信给我——你来得正好。',
    reward: { items: { core: 2, stone: 60 }, xp: 200 } },
  { id: 'letter', name: '落霞来信', pre: ['ruins'], giver: 'chief', turnIn: 'tianji', ch: '第三章 · 落霞风云',
    offer: '沿村东官道一路向东，便是落霞镇。镇上天机阁的玄机子是我故交，他说万妖谷那边不太平。你如今修为已成气候，替我走一趟吧。镇中心有座传送阵，记得把它点亮——往后来去便快了。',
    desc: '沿官道东行至落霞镇，拜见天机阁主玄机子。',
    obj: [{ t: 'talk', npc: 'tianji', text: '前往落霞镇天机阁（镇东北）拜见玄机子' }],
    progress: '官道就在村东，一直走便是落霞镇。',
    done: '李老头的信我收到了。你就是那个在遗迹里斩了石灵的后生？好，好。天机阁观星三月，只看见一件事——万妖谷中，妖气冲天。',
    reward: { items: { stone: 40, ningshen: 2 }, xp: 120 } },
  { id: 'valley', name: '万妖谷', pre: ['letter'], giver: 'tianji', turnIn: 'tianji', ch: '第四章 · 万妖谷',
    offer: '万妖谷在青云村西南，过了石桥沿小路一直往西南走便是。谷中妖狼王吞食同类，修为暴涨，还掳走了一只九尾灵狐的幼崽——那是上古灵脉孕育的灵物。斩了妖狼王，救出灵狐！',
    desc: '深入万妖谷，击败妖狼王，打开妖王洞前的囚笼救出灵狐。',
    obj: [{ t: 'kill', kind: 'wolfking', n: 1 }, { t: 'flag', flag: 'fox', text: '打开妖王洞前的囚笼，救出灵狐', at: 'cage' }],
    progress: '妖狼王会召唤血狼群，还会扑击——看到地上的红圈就闪开（V 瞬身）！',
    done: '灵狐认你为主了？哈哈，这是你的造化。这卷《金刚护体诀》和灵犀玉佩赠你。回青云村去吧，云鹤道长会助你筑基。',
    reward: { items: { manual_shield: 1, jade_pendant: 1, stone: 80 }, xp: 400 } },
  { id: 'zhuji', name: '铸就道基', pre: ['valley'], giver: 'elder', turnIn: 'elder', ch: '第五章 · 铸就道基',
    offer: '筑基，是凡与仙的分水岭。先在丹炉炼出筑基丹，再将修为练到炼气九层圆满，然后服丹突破——届时会有小天劫降下，挺住！',
    desc: '炼制筑基丹，修炼至炼气九层圆满后突破筑基。',
    obj: [{ t: 'craft', item: 'zhuji', text: '炼制筑基丹', at: 'alchemy' }, { t: 'realm', n: 10, text: '突破至筑基初期（渡小天劫）' }],
    progress: '筑基丹需千年灵芝 1、妖丹 3、赤炎果 2。赤炎果长在山岩上。',
    done: '好！道基已成。这柄流云飞剑是青云宗旧物，今日传你。按 F 即可御剑凌空——天地之大，尽可去得。',
    reward: { items: { sword_fly: 1 }, flags: ['fly'], xp: 100 } },
  { id: 'volcano', name: '炎阳遗恨', pre: ['zhuji'], giver: 'elder', turnIn: 'yanji', ch: '第六章 · 炎阳遗恨',
    offer: '你也该知道青云宗是怎么没的了。三百年前，熔岩魔君自赤焰火山的地火中破封而出，青云与炎阳两宗合力将它重新镇压，炎阳宗满门殉道……如今封印松动了。去落霞镇北的赤焰火山，那里还有炎阳宗最后的传人。',
    desc: '御剑飞往落霞镇北的赤焰火山，寻找炎阳宗遗孤。',
    obj: [{ t: 'talk', npc: 'yanji', text: '在赤焰火山半腰的封魔台找到炎阳遗孤' }],
    progress: '赤焰火山在落霞镇正北，冒烟的那座。',
    done: '你身上……有青云宗的剑意。我是炎阳宗最后一人，炎姬。三百年来我以残魂守着这座封印——可它撑不了多久了。',
    reward: { xp: 200 } },
  { id: 'lavalord', name: '熔岩魔君', pre: ['volcano'], giver: 'yanji', turnIn: 'yanji',
    offer: '魔君的残躯就封在这座台下，它随时会破封。它会召唤天火陨石——看见地上的红圈就躲开！击败它，我便能借它的地火之精，重铸封印。',
    desc: '在封魔台击败熔岩魔君。',
    obj: [{ t: 'kill', kind: 'lavagolem', n: 1 }],
    progress: '小心陨石和地裂。金光护体（G）能挡下大半伤害。',
    done: '封印重铸了……谢谢你。这卷《万剑归宗》是炎阳宗的镇派剑诀，交给你。我身后的地火熔炉，你随时可以用来炼器。',
    reward: { items: { fire_essence: 3, meteor_iron: 1, manual_wanjian: 1, stone: 150 }, flags: ['forge'], xp: 900 } },
  { id: 'forge', name: '赤霄出世', pre: ['lavalord'], giver: 'yanji', turnIn: 'yanji',
    offer: '以地火之精、天外陨铁和妖丹，可在熔炉中炼出一柄赤霄剑——炎阳宗昔年的名剑。陨铁若不够，留意天降流星。',
    desc: '在地火熔炉炼制赤霄剑。',
    obj: [{ t: 'craft', item: 'sword_chixiao', text: '在地火熔炉炼制赤霄剑', at: 'forge' }],
    progress: '赤霄剑：地火之精 1、天外陨铁 1、妖丹 4。',
    done: '剑鸣如凤……三百年了，赤霄终于又有了主人。',
    reward: { items: { stone: 60 }, xp: 300 } },
  { id: 'island', name: '浮空仙山', pre: ['lavalord'], giver: 'elder', turnIn: 'elder', ch: '第七章 · 九霄雷劫',
    offer: '魔君已除，你的道基也稳了。看见北边天上那几座浮岛了吗？那是青云宗的山门遗址。御剑上去，主峰金顶亭中有一只宝匣——里面是青云宗留给后人的九转金丹。',
    desc: '御剑飞上北方青云峰上空的浮空仙山，开启仙山宝匣。',
    obj: [{ t: 'chest', id: 'island', text: '开启仙山宝匣', at: 'island' }],
    progress: '浮空仙山在正北偏西的高空，飞得再高些。',
    done: '九转金丹……青云宗的道统，终究是等到了传人。可金丹之劫，非同小可。',
    reward: { items: { stone: 200 }, xp: 500 } },
  { id: 'trib', name: '九霄雷劫', pre: ['island'], giver: 'elder', turnIn: 'elder',
    offer: '金丹之劫，九道天雷，外加一劫心魔。去青云峰顶的雷劫台——那是天地间唯一能承受金丹雷劫的地方。筑基圆满后在台上按 B 突破，天雷便会落下。挺过雷劫，斩了心魔，你便是真正的金丹真人。',
    desc: '筑基后期圆满后，在青云峰顶雷劫台突破，渡过九霄雷劫与心魔劫。',
    obj: [{ t: 'realm', n: 13, text: '在雷劫台渡劫，凝结金丹', at: 'trib' }],
    progress: '雷劫台在青云峰顶，村子正北。传送阵可直达。',
    done: '九霄雷动，金丹自成……从今往后，你便是青云宗的传人。这方天地，任你遨游。',
    reward: { items: { stone: 300 }, flags: ['ending'] } },
  // ---- 支线
  { id: 'guard', name: '镇南妖患', pre: ['letter'], giver: 'guard', turnIn: 'guard',
    offer: '你是天机阁的客人？正好。镇南的山猪都成了精，糟蹋了不少庄稼，替我除掉 4 头，镇上自有重谢。',
    desc: '为落霞镇镇守秦烈清剿山猪。',
    obj: [{ t: 'kill', kind: 'boar', n: 4, at: 'boar' }],
    progress: '出南门就是，山猪皮厚，多用剑气。',
    done: '干得漂亮！这件云纹法衣是镇上织坊的手艺，穿上它，寻常妖物伤不了你。',
    reward: { items: { robe_cloud: 1, stone: 30 }, xp: 150 } },
  { id: 'tamer', name: '灵兽契约', pre: ['valley'], giver: 'tamer', turnIn: 'tamer',
    offer: '你身边这只灵狐……是九尾一脉！带三颗妖丹来，我替你们结下灵兽契约，它便能在你危急时以灵息护你。',
    desc: '把 3 颗妖丹交给灵兽阁主白芷，与灵狐结契。',
    obj: [{ t: 'have', item: 'core', n: 3 }],
    progress: '三颗妖丹，妖兽身上都有。',
    done: '契约已成。从此它与你心意相通——你气血危急时，它会吐出灵息为你疗伤。',
    reward: { flags: ['petheal'], xp: 150 }, take: true },
];
export const CHESTS = {
  ruins: { items: { lingzhi: 1, manual_fly: 1, stone: 40, juqi: 2 } },
  island: { items: { jindan: 1, stone: 120, bingpo: 2 } },
};
export const SHOPS = {
  herbalist: [['huichun', 8], ['ningshen', 10], ['juqi', 30]],
  merchant: [['huichun', 8], ['ningshen', 10], ['juqi', 28], ['bingpo', 90], ['robe_cloud', 60], ['jade_pendant', 140], ['meteor_iron', 160]],
};
export const SELL = { hide: 6, fang: 4, core: 15, wolf_core: 300, fish_carp: 4, fish_silver: 9, pearl: 35, fish_dragon: 160 };
