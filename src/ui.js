// 界面：HUD、对话、背包、炼丹、小地图、菜单
import { ITEMS, RECIPES, FORGE, REALMS, ROOTS, SKILLS, R_QI, R_WIND, R_ZHUJI } from './data.js';
import { K, forestDensity } from './height.js';
import { QUALITY, SLOT_NAME, gearLines } from './loot.js';
import { gearPower } from './game.js';
import { PORTALS, TOWN, VALLEY, VOLCANO, TRIB, RUINS, PLATFORM, ISLANDS, QINGYUN, GROVES } from './layout.js';

const shade = (h, k) => { const n = parseInt(h.slice(1), 16); return `rgb(${(((n >> 16) & 255) * k) | 0},${(((n >> 8) & 255) * k) | 0},${((n & 255) * k) | 0})`; };
const poly = (c, pts) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); };
const rad = (c, hx, hy, x, y, r, hi, base) => { const g = c.createRadialGradient(hx, hy, 2, x, y, r); g.addColorStop(0, hi); g.addColorStop(0.5, base); g.addColorStop(1, shade(base, 0.5)); c.fillStyle = g; };
const lg = (c, x0, y0, x1, y1, a, b) => { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; };
const fs = (c) => { c.fill(); c.stroke(); };
const ICONS = {
  pill(c, a, b) { rad(c, 25, 23, 32, 32, 22, b, a); c.beginPath(); c.arc(32, 32, 20, 0, 7); fs(c); },
  gem(c, a, b) { lg(c, 12, 10, 52, 54, b, shade(a, 0.7)); poly(c, [[32, 7], [53, 26], [32, 57], [11, 26]]); fs(c); c.fillStyle = b; c.globalAlpha = 0.5; poly(c, [[32, 7], [41, 26], [32, 57], [23, 26]]); c.fill(); c.globalAlpha = 1; },
  herb(c, a, b) { for (const r of [-0.55, 0.55, 0]) { c.save(); c.translate(32, 56); c.rotate(r); lg(c, 0, -46, 0, 0, b, shade(a, 0.8)); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-11, -24, 0, -46); c.quadraticCurveTo(11, -24, 0, 0); fs(c); c.restore(); } },
  flower(c, a, b) { for (let i = 0; i < 6; i++) { c.save(); c.translate(32, 32); c.rotate(i * 1.0472); lg(c, 0, -26, 0, 0, a, shade(a, 0.75)); c.beginPath(); c.ellipse(0, -15, 7.5, 12, 0, 0, 7); fs(c); c.restore(); } c.fillStyle = b; c.beginPath(); c.arc(32, 32, 6.5, 0, 7); fs(c); },
  fruit(c, a, b) { rad(c, 25, 28, 32, 37, 21, b, a); c.beginPath(); c.arc(32, 37, 19, 0, 7); fs(c); c.fillStyle = '#4fb85a'; c.beginPath(); c.ellipse(39, 14, 10, 4.5, -0.6, 0, 7); fs(c); },
  shroom(c, a, b) { c.fillStyle = '#f0e2c4'; c.beginPath(); c.roundRect(26, 30, 12, 25, 5); fs(c); rad(c, 26, 18, 32, 31, 25, b, a); c.beginPath(); c.ellipse(32, 32, 23, 19, 0, Math.PI, 0); c.closePath(); fs(c); c.fillStyle = b; for (const [x, y, r] of [[21, 25, 3], [36, 20, 4], [45, 27, 2.5]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } },
  fang(c, a, b) { lg(c, 14, 12, 50, 54, a, b); c.beginPath(); c.moveTo(13, 11); c.quadraticCurveTo(42, 10, 51, 55); c.quadraticCurveTo(22, 42, 13, 11); fs(c); },
  hide(c, a, b) { lg(c, 0, 8, 0, 56, a, shade(a, 0.7)); poly(c, [[10, 10], [24, 16], [40, 16], [54, 10], [48, 28], [54, 54], [38, 46], [26, 46], [10, 54], [16, 28]]); fs(c); c.fillStyle = b; c.beginPath(); c.ellipse(32, 31, 9, 7, 0, 0, 7); c.fill(); },
  sword(c, a, b) { c.save(); c.translate(31, 33); c.rotate(Math.PI / 4); lg(c, -5, 0, 5, 0, '#ffffff', a); poly(c, [[0, -34], [5, -25], [5, 10], [-5, 10], [-5, -25]]); fs(c); c.fillStyle = b; c.beginPath(); c.roundRect(-12, 10, 24, 5, 2); fs(c); c.beginPath(); c.roundRect(-3, 15, 6, 15, 2); fs(c); c.restore(); },
  ore(c, a, b) { lg(c, 10, 12, 54, 54, shade(a, 1.3), shade(a, 0.6)); poly(c, [[14, 30], [24, 12], [44, 10], [55, 28], [48, 50], [22, 54]]); fs(c); c.strokeStyle = b; c.lineWidth = 2; for (const [x0, y0, x1, y1] of [[24, 22, 34, 34], [34, 34, 46, 26], [34, 34, 30, 46]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); } c.fillStyle = b; c.beginPath(); c.arc(34, 34, 3.5, 0, 7); c.fill(); },
  robe(c, a, b) { lg(c, 0, 8, 0, 58, shade(a, 1.15), shade(a, 0.7)); poly(c, [[24, 8], [40, 8], [58, 22], [50, 30], [46, 26], [48, 58], [16, 58], [18, 26], [14, 30], [6, 22]]); fs(c); c.strokeStyle = b; c.lineWidth = 3; c.beginPath(); c.moveTo(24, 8); c.lineTo(32, 26); c.lineTo(40, 8); c.stroke(); c.beginPath(); c.moveTo(18, 38); c.lineTo(46, 38); c.stroke(); },
  charm(c, a, b) { c.strokeStyle = '#d8b060'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(32, 4); c.lineTo(32, 14); c.stroke(); c.strokeStyle = 'rgba(20,14,26,0.9)'; rad(c, 26, 26, 32, 34, 22, b, a); c.beginPath(); c.arc(32, 34, 19, 0, 7); fs(c); c.fillStyle = shade(a, 0.6); c.beginPath(); c.arc(32, 34, 6, 0, 7); fs(c); c.fillStyle = '#c83a2a'; c.fillRect(29, 53, 6, 9); },
  gourd(c, a, b) { rad(c, 26, 40, 32, 42, 18, b, a); c.beginPath(); c.arc(32, 42, 16, 0, 7); fs(c); rad(c, 28, 20, 32, 22, 11, b, a); c.beginPath(); c.arc(32, 22, 10, 0, 7); fs(c); c.fillStyle = '#d8b060'; c.fillRect(27, 30, 10, 3); c.fillStyle = '#6a4a30'; c.beginPath(); c.roundRect(29, 5, 6, 8, 2); fs(c); },
  fish(c, a, b) { c.save(); c.translate(32, 33); c.rotate(-0.35); lg(c, 0, -14, 0, 14, b, shade(a, 0.75)); c.beginPath(); c.moveTo(-24, 0); c.quadraticCurveTo(-4, -17, 16, -2); c.lineTo(27, -11); c.lineTo(25, 0); c.lineTo(27, 11); c.lineTo(16, 2); c.quadraticCurveTo(-4, 17, -24, 0); c.closePath(); fs(c); c.fillStyle = '#1a1420'; c.beginPath(); c.arc(-15, -2, 2.4, 0, 7); c.fill(); c.strokeStyle = shade(a, 0.55); c.lineWidth = 1.5; for (const x of [-6, 0, 6]) { c.beginPath(); c.arc(x, 0, 7, -0.9, 0.9); c.stroke(); } c.restore(); },
  scroll(c, a, b) { c.fillStyle = a; c.beginPath(); c.roundRect(14, 12, 36, 40, 3); fs(c); c.fillStyle = b; for (let i = 0; i < 4; i++) c.fillRect(22 + i * 6.5, 20, 2.5, 24); c.fillStyle = shade(a, 0.6); for (const y of [8, 49]) { c.beginPath(); c.roundRect(10, y, 44, 7, 3.5); fs(c); } },
};
const iconCache = {};
export function itemIcon(id) {
  if (iconCache[id]) return iconCache[id];
  const [shape, c1, c2] = ITEMS[id].icon, cv = document.createElement('canvas'), c = cv.getContext('2d');
  cv.width = cv.height = 64;
  c.lineWidth = 2.5; c.lineJoin = 'round'; c.strokeStyle = 'rgba(20,14,26,0.9)';
  ICONS[shape](c, c1, c2);
  return (iconCache[id] = cv.toDataURL());
}

const CSS = `
#ui{position:fixed;inset:0;pointer-events:none;font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;color:#f4ecd8;font-size:14px;user-select:none;-webkit-user-select:none}
#ui *{box-sizing:border-box}
.px{background:rgba(16,15,26,.74);border:1px solid rgba(216,176,96,.75);border-radius:8px;box-shadow:0 6px 22px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.04);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.sh{text-shadow:0 1px 3px rgba(0,0,0,.95),0 0 2px rgba(0,0,0,.8),0 0 8px rgba(0,0,0,.45)}
#hud{position:absolute;inset:0;transition:opacity .4s}
#stats{position:absolute;left:16px;top:16px;width:268px;padding:10px 12px}
#stats .rl{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
#realm{font-size:18px;font-weight:700;color:#ffe9a0;letter-spacing:2px}
#atk{font-size:12px;color:#c8c0a8}
.bar{position:relative;height:14px;background:#1a1420;border:2px solid #000;margin-top:5px}
.bar i{display:block;height:100%;width:50%;transition:width .2s;background-image:linear-gradient(rgba(255,255,255,.28) 0 35%,transparent 35% 100%)}
.bar b{position:absolute;inset:0;font-size:10px;line-height:10px;text-align:center;font-weight:600;text-shadow:1px 1px 0 #000}
.bar.hp i{background-color:#d8423a}.bar.mp i{background-color:#3a8ae0}.bar.xp i{background-color:#e0b040}
.bar.xp{height:10px}.bar.xp b{line-height:6px;font-size:9px}
#brk{margin-top:7px;font-size:13px;color:#ffe070;text-align:center;animation:blink 1s steps(2) infinite;display:none}
#state{margin-top:6px;font-size:12px;color:#8fe8d0;text-align:center;display:none}
@keyframes blink{50%{opacity:.35}}
#mapbox{position:absolute;right:16px;top:16px;width:176px;padding:4px}
#mapwin{position:relative;width:164px;height:164px;overflow:hidden;background:#123}
#mm{position:absolute;left:50%;top:50%;width:184.5px;height:184.5px;margin:-92.25px}
#mmo{position:absolute;inset:0;width:164px;height:164px}
#loc{text-align:center;font-size:13px;padding:4px 0 1px;color:#ffe9a0}
#tracker{position:absolute;right:16px;top:232px;width:230px;font-size:13px;line-height:1.5}
#tracker h4{margin:8px 0 2px;font-size:14px;color:#ffd866}
#tracker div{color:#e8e0cc;padding-left:14px;position:relative}
#tracker div:before{content:'';position:absolute;left:2px;top:7px;width:6px;height:6px;background:#888;border:1px solid #000}
#tracker div.ok{color:#8fe8a0}#tracker div.ok:before{background:#5fd070}
#tracker p{margin:2px 0 0;color:#ffe9a0;font-size:12px}
#hotbar{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);display:flex;gap:8px}
.slot{position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#ffe9a0}
.slot img{width:36px;height:36px}
.slot kbd{position:absolute;left:2px;top:1px;font:600 10px monospace;color:#fff;text-shadow:1px 1px 0 #000}
.slot em{position:absolute;right:3px;bottom:1px;font:600 11px monospace;font-style:normal;color:#fff;text-shadow:1px 1px 0 #000}
.slot.off{filter:grayscale(1) brightness(.5)}
.slot.on{border-color:#7ff0d0;box-shadow:0 0 0 2px #1a1420,0 0 12px #7ff0d0}
.slot u{position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);height:0}
#prompt{position:absolute;left:50%;bottom:150px;transform:translateX(-50%);padding:6px 14px;font-size:15px;display:none;white-space:nowrap}
#prompt kbd{display:inline-block;background:#ffe9a0;color:#1a1420;font:700 13px monospace;padding:1px 6px;margin-right:8px;border:1px solid #000}
#toasts{position:absolute;left:16px;bottom:96px;display:flex;flex-direction:column;gap:5px;align-items:flex-start}
.toast{display:flex;align-items:center;gap:8px;padding:4px 10px 4px 6px;font-size:13px;animation:tin .25s steps(4);transition:opacity .5s}
.toast img{width:24px;height:24px}
@keyframes tin{from{transform:translateX(-30px);opacity:0}}
#banner{position:absolute;left:0;right:0;top:20%;text-align:center;opacity:0;transition:opacity .6s;}
#banner h1{margin:0;font-size:52px;letter-spacing:14px;color:#ffe9a0;text-shadow:3px 3px 0 #000,0 0 24px rgba(255,200,80,.8);font-weight:800}
#banner p{margin:10px 0 0;font-size:18px;letter-spacing:4px}
#target{position:absolute;left:50%;top:22px;transform:translateX(-50%);width:320px;text-align:center;display:none}
#target span{font-size:14px}
#target .bar{height:12px}
#target.boss{width:520px}#target.boss span{font-size:18px;color:#ff9a8a;letter-spacing:4px}
#dmg span{position:absolute;font-weight:800;font-size:20px;animation:dm .8s ease-out forwards;white-space:nowrap}
@keyframes dm{from{transform:translate(-50%,0) scale(1.4)}to{transform:translate(-50%,-70px) scale(1);opacity:0}}
#cross{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;background:rgba(255,255,255,.75);box-shadow:0 0 0 1px rgba(0,0,0,.6)}
#bt{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(120,200,255,0) 45%,rgba(40,110,200,.42) 100%);mix-blend-mode:screen;transition:opacity .25s}
#call{position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);font-size:44px;font-weight:900;letter-spacing:14px;pointer-events:none;opacity:0;text-shadow:3px 3px 0 #1a1420,0 0 26px currentColor;white-space:nowrap}
#call.on{animation:callA .9s ease-out forwards}
@keyframes callA{0%{opacity:0;transform:translate(-50%,-50%) scale(1.6)}15%{opacity:1;transform:translate(-50%,-50%) scale(1)}70%{opacity:1}100%{opacity:0;transform:translate(-50%,-60%) scale(1)}}
#fishbar{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);width:420px;padding:10px 14px;display:none;text-align:center;font-size:13px}
#fishbar .tr{position:relative;height:22px;background:#1a1420;border:2px solid #000;margin:8px 0 6px}
#fishbar .zn{position:absolute;top:0;bottom:0;background:linear-gradient(#7ff0b0,#3aa870);opacity:.85}
#fishbar .pt{position:absolute;top:-5px;bottom:-5px;width:4px;margin-left:-2px;background:#ffe9a0;box-shadow:0 0 6px #ffd860}
#fishbar .pg{height:6px;background:#1a1420;border:1px solid #000}#fishbar .pg i{display:block;height:100%;background:#5ab8ff;transition:width .15s}
#trialhud{position:absolute;left:50%;top:64px;transform:translateX(-50%);padding:5px 16px;font-size:14px;color:#ffe9a0;letter-spacing:2px;display:none;white-space:nowrap}
#boon{width:min(760px,96vw);text-align:center}
#boon .cards{display:flex;gap:14px;justify-content:center;margin-top:12px}
#boon .card{flex:1;max-width:220px;padding:18px 12px;background:#221c30;border:2px solid #6a5a88;cursor:pointer;pointer-events:auto;transition:transform .12s}
#boon .card:hover{transform:translateY(-4px);border-color:#ffd860;background:#2e2640}
#boon .card h3{margin:4px 0 10px;color:#ffd866;font-size:19px;letter-spacing:3px}#boon .card p{margin:0;font-size:13px;line-height:1.6;color:#d8d0bc}
#boon .card kbd{display:inline-block;margin-top:12px;font-size:12px;color:#a8a090}
#board{width:min(680px,94vw);max-height:86vh;overflow-y:auto}#board .btn.sel{background:#d8b060;color:#1a1420}#board .bnt .btn{padding:4px 12px;font-size:13px;white-space:nowrap}
.bnt{display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid #3a3448;font-size:13px}.bnt .n{flex:1;line-height:1.5}.bnt b{color:#ffe9a0}.bnt .rw{color:#8fe8a0;font-size:12px}
.shopi{display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid #3a3448;font-size:13px}.shopi .n{flex:1}.shopi .lk{color:#ff8a7a;font-size:12px}
#bagtabs{display:flex;gap:6px;margin:-4px 0 10px}#bagtabs .btn.sel{background:#d8b060;color:#1a1420}
.cell.q0{border-color:#8a8a8a}.cell.q1{border-color:#4ab85a}.cell.q2{border-color:#3a88e8}.cell.q3{border-color:#a050e8}.cell.q4{border-color:#ff9020;box-shadow:0 0 8px #ff9020 inset}
.cell .eqm{position:absolute;left:2px;top:0;font-size:10px;color:#7ff0d0;font-style:normal}
#hurt{position:absolute;inset:0;box-shadow:inset 0 0 140px 40px rgba(200,20,10,.75);opacity:0;transition:opacity .35s}
#fade{position:absolute;inset:0;background:#000;opacity:0;transition:opacity .8s;pointer-events:none}
.modal{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:auto;display:none;padding:16px 18px}
.modal h2{margin:0 0 12px;font-size:20px;letter-spacing:6px;color:#ffe9a0;text-align:center}
.modal .x{position:absolute;right:10px;top:8px;cursor:pointer;font-size:18px;color:#c8c0a8}
#dialog{position:absolute;left:50%;bottom:36px;transform:translateX(-50%);width:min(760px,92vw);padding:14px 18px 12px;pointer-events:auto;display:none;cursor:pointer}
#dname{font-size:16px;color:#ffd866;font-weight:700;margin-bottom:6px;letter-spacing:2px}
#dtext{font-size:16px;line-height:1.7;min-height:82px}
#dnext{text-align:right;font-size:12px;color:#c8c0a8}
#dch{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.btn{display:inline-block;padding:6px 14px;background:#2a2438;border:2px solid #d8b060;box-shadow:0 0 0 2px #1a1420;color:#ffe9a0;cursor:pointer;font-size:14px;pointer-events:auto;font-family:inherit}
.btn:hover{background:#d8b060;color:#1a1420}
.btn.dis{filter:grayscale(1);opacity:.5;cursor:default}
#bag{width:min(680px,94vw)}
#bagbody{display:flex;gap:14px}
#grid{display:grid;grid-template-columns:repeat(6,54px);grid-auto-rows:54px;gap:6px;min-height:234px;align-content:start}
.cell{position:relative;background:#1a1420;border:2px solid #4a4258;display:flex;align-items:center;justify-content:center;cursor:pointer}
.cell img{width:36px;height:36px}.cell em{position:absolute;right:3px;bottom:0;font:600 11px monospace;font-style:normal;text-shadow:1px 1px 0 #000}
.cell.sel{border-color:#ffe070}.cell.eq{border-color:#7ff0d0}
#info{flex:1;min-width:0;font-size:13px;line-height:1.6}
#info h3{margin:0 0 6px;font-size:17px;color:#ffd866}
#char{margin-top:12px;padding-top:10px;border-top:2px solid #4a4258;font-size:13px;line-height:1.7;display:grid;grid-template-columns:1fr 1fr;gap:0 16px}
#alch{width:min(620px,94vw)}
.rec{display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid #3a3448}
.rec img{width:36px;height:36px}.rec .n{width:92px;font-weight:700;color:#ffe9a0}.rec .m{flex:1;font-size:12px;line-height:1.5}
.rec .m span{margin-right:10px;white-space:nowrap}.rec .m .no{color:#ff8a7a}.rec .m .ok{color:#8fe8a0}
#menu{width:min(460px,92vw)}
#menu .row{display:flex;justify-content:space-between;align-items:center;margin:9px 0;gap:10px}
#menu .opts{display:flex;gap:6px}
#menu .btn.sel{background:#d8b060;color:#1a1420}
#help{font-size:12px;line-height:1.75;color:#d8d0bc;margin-top:10px;padding-top:10px;border-top:2px solid #4a4258;columns:2}
#creator{position:absolute;right:5vw;top:50%;transform:translateY(-50%);width:360px;display:none;pointer-events:auto;padding:16px 20px}
#creator h2{margin:0 0 10px;text-align:center;letter-spacing:10px;color:#ffe9a0;font-size:22px}
#creator .cr{margin:9px 0}#creator .cr b{display:block;font-size:13px;color:#d8c890;margin-bottom:5px;letter-spacing:2px}
#creator .cr .opts{display:flex;flex-wrap:wrap;gap:6px}
#creator .btn{padding:5px 10px;font-size:13px}#creator .btn.sel{background:#d8b060;color:#1a1420}
#creator .sw{display:inline-flex;align-items:center;gap:6px}#creator .sw i{width:14px;height:14px;border:1px solid #1a1420;display:inline-block}
#creator .go{display:flex;justify-content:space-between;margin-top:16px}#creator .go .btn{font-size:16px;padding:7px 22px}
#creator p{font-size:12px;color:#a8a090;text-align:center;margin:10px 0 0}
#title{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:auto;background:radial-gradient(ellipse at center,rgba(8,8,20,.15) 0,rgba(8,8,20,.72) 100%)}
#title h1{margin:0;font-size:92px;letter-spacing:26px;padding-left:26px;color:#ffe9a0;font-weight:900;text-shadow:5px 5px 0 #1a1420,0 0 40px rgba(255,190,70,.7)}
#title h3{margin:8px 0 46px;font-size:20px;letter-spacing:12px;font-weight:400}
#title .btn{font-size:20px;padding:10px 46px;margin:7px;letter-spacing:6px;min-width:280px;text-align:center}
#chapter{position:absolute;left:0;right:0;top:30%;text-align:center;opacity:0;transition:opacity 1.2s;pointer-events:none}
#chapter:before{content:'';position:absolute;left:50%;top:50%;width:min(900px,96vw);height:190px;transform:translate(-50%,-50%);background:radial-gradient(ellipse at center,rgba(0,0,0,.62) 0,rgba(0,0,0,.35) 45%,transparent 72%)}
#chapter h1{position:relative;margin:0;font-size:64px;letter-spacing:22px;padding-left:22px;color:#f6ecd0;font-weight:900;font-family:"STKaiti","KaiTi","Kaiti SC","PingFang SC",serif;text-shadow:0 0 30px rgba(255,210,120,.55),2px 2px 0 #000}
#chapter p{position:relative;margin:14px 0 0;font-size:19px;letter-spacing:8px;color:#e8d8a8;text-shadow:1px 1px 2px #000}
#chapter i{position:relative;display:block;margin:12px auto 0;width:0;height:2px;background:linear-gradient(90deg,transparent,#d8b060,transparent);transition:width 1.6s}
#chapter.on i{width:420px}
.slot.sk{font-size:20px}.slot.sk small{position:absolute;left:0;right:0;bottom:2px;font-size:9px;font-weight:400;text-align:center;color:#d8d0bc}
#forge{width:min(640px,94vw)}
#map{width:min(980px,96vw)}
#mapbody{display:flex;gap:14px;align-items:flex-start}
#wmap{width:min(620px,60vw,74vh);aspect-ratio:1;border:2px solid #4a4258;background:#123;image-rendering:auto;cursor:default}
#plist{flex:1;display:flex;flex-direction:column;gap:7px;font-size:13px}
#plist .btn{text-align:center}
#plist p{margin:0 0 4px;color:#c8c0a8;line-height:1.6}
#title p{position:absolute;bottom:20px;font-size:13px;color:#d8d0bc;letter-spacing:1px;text-align:center;line-height:1.8}
`;
const HTML = `
<div id="hud" style="opacity:0">
 <div id="hurt"></div>
 <div id="stats" class="px"><div class="rl"><span id="realm"></span><span id="atk"></span></div>
  <div class="bar hp"><i></i><b></b></div><div class="bar mp"><i></i><b></b></div><div class="bar xp"><i></i><b></b></div>
  <div id="brk">修为圆满 · 按 B 突破</div><div id="state"></div></div>
 <div id="mapbox" class="px"><div id="mapwin"><canvas id="mm" width="144" height="144"></canvas><canvas id="mmo" width="164" height="164"></canvas></div><div id="loc"></div></div>
 <div id="tracker" class="sh"></div>
 <div id="target" class="sh"><span></span><div class="bar hp"><i></i></div></div>
 <div id="cross"></div>
 <div id="prompt" class="px"></div>
 <div id="toasts"></div>
 <div id="hotbar"></div>
 <div id="dmg" class="sh"></div>
 <div id="banner"><h1></h1><p class="sh"></p></div>
 <div id="chapter"><h1></h1><i></i><p></p></div>
</div>
<div id="dialog" class="px"><div id="dname"></div><div id="dtext"></div><div id="dch"></div><div id="dnext">点击 / E / 空格 继续 ▼</div></div>
<div id="bag" class="modal px"><span class="x">✕</span><h2>行囊</h2><div id="bagtabs"><span class="btn sel" data-t="items">物品</span><span class="btn" data-t="gear">灵宝</span></div><div id="bagbody"><div id="grid"></div><div id="info"></div></div><div id="char"></div></div>
<div id="alch" class="modal px"><span class="x">✕</span><h2>炼丹炉</h2><div id="recs"></div></div>
<div id="forge" class="modal px"><span class="x">✕</span><h2>地火熔炉</h2><div id="frecs"></div></div>
<div id="map" class="modal px"><span class="x">✕</span><h2>山河舆图</h2><div id="mapbody"><canvas id="wmap" width="512" height="512"></canvas><div id="plist"></div></div></div>
<div id="menu" class="modal px"><span class="x">✕</span><h2>青云问道</h2>
 <div class="row"><span>画质</span><div class="opts" data-opt="quality"><span class="btn" data-v="0">流畅</span><span class="btn" data-v="1">均衡</span><span class="btn" data-v="2">极致</span></div></div>
 <div class="row"><span>音量</span><input id="vol" type="range" min="0" max="100" style="flex:1;pointer-events:auto"></div>
 <div class="row"><span class="btn" id="m-save">保存进度</span><span class="btn" id="m-home">回村（脱离卡死）</span><span class="btn" id="m-reset">重新开始</span></div>
 <div class="row" style="justify-content:center"><span class="btn" id="m-go" style="padding:8px 60px">继续修行</span></div>
 <div id="help">WASD 移动 · Shift 疾行<br>空格 跳跃 · 空中再按二段跳（炼气三层）<br>下落时按住空格 轻功滑翔<br>鼠标 视角 · 滚轮 缩放<br>左键 三段连斩（连点）<br>右键 格挡（敌人出手瞬间按下即弹反）<br>Q 剑气 · V 瞬身（贴身闪避触发子弹时间）<br>敌人头顶出现「破绽」时 左键处决<br>G 金光护体 · R 万剑归宗<br>E 交互/采集/对话/传送<br>村中悬赏榜 · 每日刷新<br>码头垂钓 · 灵田种植 · 灵环御剑<br>C 打坐修炼 · B 突破境界<br>F 御剑飞行（筑基后）<br>飞行中 空格升 / X 降 / Shift 加速<br>1 2 3 服用丹药<br>Tab 行囊 · M 舆图 · Esc 菜单</div>
</div>
<div id="trialhud" class="px"></div>
<div id="fishbar" class="px"><div id="fbt">鱼儿咬钩！</div><div class="tr"><div class="zn"></div><div class="pt"></div></div><div class="pg"><i></i></div><div style="margin-top:6px;color:#c8c0a8">指针落在绿区时按 空格 / 左键 收线 · WASD 收竿离开</div></div>
<div id="boon" class="modal px"><h2>机 缘 · 三 选 一</h2><div style="font-size:13px;color:#c8c0a8">本次秘境内生效</div><div class="cards"></div></div>
<div id="board" class="modal px"><span class="x">✕</span><h2 id="bdt">悬赏榜</h2><div id="bdb"></div></div>
<div id="fade"></div><div id="bt"></div><div id="call"></div>
<div id="creator" class="px"><h2>入 道</h2><div id="cr-rows"></div><div class="go"><span class="btn" id="cr-back">返回</span><span class="btn" id="cr-go">踏入仙途</span></div><p>拖动画面可旋转人物</p></div>
<div id="title"><h1>青云问道</h1><h3 class="sh">御 剑 乘 风 · 开 放 世 界</h3><span class="btn" id="t-new">踏入仙途</span><span class="btn" id="t-cont" style="display:none">继续修行</span>
 <p class="sh">WASD 移动 · 鼠标视角 · 左键连斩 · Q 剑气 · V 瞬身 · E 交互 · C 打坐 · B 突破 · Tab 行囊 · M 舆图 · Esc 菜单<br>点击画面锁定鼠标</p></div>
`;
const MAPCOL = { [K.GRASS]: [86, 150, 72], [K.SAND]: [214, 198, 142], [K.ROCK]: [136, 136, 134], [K.SNOW]: [238, 242, 248], [K.PATH]: [186, 156, 108], [K.PAVE]: [164, 164, 172], [K.FARM]: [150, 118, 62], [K.BED]: [58, 120, 192], [K.ASH]: [92, 78, 72] };
const SHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const $ = (s) => document.querySelector(s);

export class UI {
  constructor(game, input) {
    this.game = game; this.input = input; this.modal = null; this.cool = 0; this.started = false; this.cache = {};
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.root = $('#ui'); this.root.innerHTML = HTML;
    this.mm = $('#mm').getContext('2d'); this.mmo = $('#mmo').getContext('2d');
    this.mapC = { x: 1e9, z: 1e9 }; this.img = this.mm.createImageData(144, 144);
    this.sel = null; this.handlers = {}; this.dlg = null; this.lockMenuT = 0;
    this.slots = [
      { k: '左键', ch: '斩' }, { k: 'Q', ch: '气', sk: 'qi' }, { k: 'V', ch: '瞬', sk: 'dash' }, { k: 'G', ch: '护', sk: 'shield' }, { k: 'R', ch: '剑', sk: 'wanjian' },
      { k: '1', item: 'huichun' }, { k: '2', item: 'ningshen' }, { k: '3', item: 'juqi' }, { k: 'C', ch: '坐', flag: 'meditate' }, { k: 'F', ch: '御', flag: 'fly' },
    ];
    $('#hotbar').innerHTML = this.slots.map((s, i) => `<div class="slot px${s.sk ? ' sk' : ''}" id="s${i}"><kbd>${s.k}</kbd>${s.item ? `<img src="${itemIcon(s.item)}"><em></em>` : s.ch}${s.sk ? `<small>${SKILLS[s.sk].name}</small>` : ''}<u></u></div>`).join('');
    for (const m of ['bag', 'alch', 'forge', 'map', 'menu', 'board']) $(`#${m} .x`).onclick = () => this.close();
    $('#dialog').onclick = (e) => { if (!e.target.classList.contains('btn')) this.advance(); };
    addEventListener('keydown', (e) => this.key(e));
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.started && !this.modal) { this.open('menu'); this.lockMenuT = performance.now(); }
    });
    for (const g of document.querySelectorAll('#menu .opts')) g.onclick = (e) => { const v = e.target.dataset.v; if (v !== undefined) { this.fire('opt', g.dataset.opt, Number(v)); } };
    $('#vol').oninput = (e) => this.fire('opt', 'volume', e.target.value / 100);
    $('#m-save').onclick = () => this.fire('save');
    $('#m-home').onclick = () => { this.close(); this.fire('home'); };
    $('#m-reset').onclick = () => { if (confirm('确定要删除存档、重新开始吗？')) this.fire('reset'); };
    $('#m-go').onclick = () => this.close();
    $('#t-new').onclick = () => this.fire('create');
    $('#cr-back').onclick = () => { this.creating = false; $('#creator').style.display = 'none'; $('#title').style.display = 'flex'; };
    $('#cr-go').onclick = () => { this.creating = false; $('#creator').style.display = 'none'; this.fire('start', false, this.crSel); };
    $('#t-cont').onclick = () => this.fire('start', true);
    game.on('inv', () => { this.dirtyBag = true; });
    this.bagTab = 'items';
    for (const b of document.querySelectorAll('#bagtabs .btn')) b.onclick = () => { this.bagTab = b.dataset.t; for (const x of document.querySelectorAll('#bagtabs .btn')) x.classList.toggle('sel', x === b); this.fire('sfx', 'ui'); this.renderBag(); };
  }
  on(ev, fn) { this.handlers[ev] = fn; }
  fire(ev, ...a) { if (this.handlers[ev]) this.handlers[ev](...a); }
  showTitle(hasSave) { $('#title').style.display = 'flex'; $('#t-cont').style.display = hasSave ? '' : 'none'; if (hasSave) $('#t-new').textContent = '重入轮回'; }
  // 开局捏人：opt 为 player.js 中的 CREATOR，sel 为当前选择
  openCreator(opt, sel) {
    this.creating = true; this.crOpt = opt; this.crSel = { ...sel };
    $('#title').style.display = 'none'; $('#creator').style.display = 'block';
    this.renderCreator();
  }
  renderCreator() {
    const O = this.crOpt, S = this.crSel, hex = (c) => '#' + c.toString(16).padStart(6, '0');
    const row = (k, name, items) => `<div class="cr"><b>${name}</b><div class="opts">${items.map(([v, label, sw]) => `<span class="btn${S[k] === v ? ' sel' : ''}${sw != null ? ' sw' : ''}" data-k="${k}" data-v="${v}">${sw != null ? `<i style="background:${hex(sw)}"></i>` : ''}${label}</span>`).join('')}</div></div>`;
    $('#cr-rows').innerHTML = row('sex', '性 别', O.sex) + row('hair', '发 型', O.hair[S.sex]) + row('outfit', '衣 着', O.outfit)
      + row('pal', '衣 色', O.pal.map(([n, c], i) => [i, n, c.robe])) + row('hairCol', '发 色', O.hairCol.map(([n, c], i) => [i, n, c])) + row('skin', '肤 色', O.skin.map(([n, c], i) => [i, n, c]));
    for (const b of document.querySelectorAll('#cr-rows .btn')) b.onclick = () => {
      const k = b.dataset.k, v = b.dataset.v;
      S[k] = k === 'sex' || k === 'hair' || k === 'outfit' ? v : Number(v);
      if (k === 'sex') { S.hair = O.hair[v][0][0]; S.outfit = v === 'f' ? 'dress' : 'robe'; }
      this.renderCreator(); this.fire('look', { ...S });
    };
  }
  begin() { $('#title').style.display = 'none'; $('#hud').style.opacity = 1; this.started = true; this.cool = performance.now(); }
  setOpts(o) {
    for (const g of document.querySelectorAll('#menu .opts')) for (const b of g.children) b.classList.toggle('sel', Number(b.dataset.v) === o[g.dataset.opt]);
    $('#vol').value = Math.round(o.volume * 100);
  }
  key(e) {
    if (!this.started) return;
    const c = e.code;
    if (this.modal === 'dialog') { if (c === 'KeyE' || c === 'Space' || c === 'Enter') { this.advance(); e.preventDefault(); } else if (c === 'Escape') this.close(); return; }
    if (this.modal === 'boon' && this.boonKeys && /^Digit[123]$/.test(c)) { this.boonKeys(+c[5] - 1); return; }
    if (c === 'Escape') { if (this.modal) { if (performance.now() - this.lockMenuT > 350) this.close(); } else this.open('menu'); return; }
    if (c === 'KeyM' && this.modal === 'map') { this.close(); return; }
    if (c === 'Tab' || c === 'KeyI') { e.preventDefault(); if (this.modal === 'bag') this.close(); else if (!this.modal) this.open('bag'); return; }
    if (this.modal && this.modal !== 'menu' && c === 'KeyE' && performance.now() - this.openT > 250) this.close();
  }
  open(m, o = {}) {
    if (this.modal) this.close(true);
    this.modal = m; this.openT = performance.now();
    this.input.release();
    if (m === 'bag') { this.renderBag(); $('#bag').style.display = 'block'; }
    else if (m === 'alch') { this.renderAlch(false); $('#alch').style.display = 'block'; }
    else if (m === 'forge') { this.renderAlch(true); $('#forge').style.display = 'block'; }
    else if (m === 'map') { this.mapOpt = o; this.renderMap(); $('#map').style.display = 'block'; }
    else if (m === 'menu') $('#menu').style.display = 'block';
    else if (m === 'dialog') $('#dialog').style.display = 'block';
    else if (m === 'boon') $('#boon').style.display = 'block';
    else if (m === 'board') { this.boardRender = o.render; o.render(); $('#board').style.display = 'block'; }
    this.fire('sfx', 'ui');
  }
  close(quiet) {
    if (!this.modal) return;
    if (this.modal === 'boon' && !quiet && this.boonCb) return;
    const el = { bag: '#bag', alch: '#alch', forge: '#forge', map: '#map', menu: '#menu', dialog: '#dialog', boon: '#boon', board: '#board' }[this.modal];
    $(el).style.display = 'none';
    const was = this.modal;
    this.modal = null; this.cool = performance.now();
    if (was === 'dialog' && this.dlg && this.dlg.onClose && !quiet) this.dlg.onClose();
    this.dlg = was === 'dialog' ? null : this.dlg;
  }
  // ---- 对话
  dialog(d, onClose) {
    this.dlg = { ...d, i: 0, n: 0, onClose };
    this.open('dialog');
    $('#dname').textContent = d.name;
    this.page();
  }
  page() {
    const d = this.dlg;
    d.n = 0; d.text = d.pages[d.i];
    $('#dtext').textContent = '';
    $('#dch').innerHTML = '';
    $('#dnext').style.visibility = 'visible';
  }
  advance() {
    const d = this.dlg;
    if (!d) return;
    if (d.n < d.text.length) { d.n = d.text.length; $('#dtext').textContent = d.text; this.lastPage(); return; }
    if (d.i < d.pages.length - 1) { d.i++; this.page(); return; }
    this.close();
  }
  lastPage() {
    const d = this.dlg;
    if (d.i !== d.pages.length - 1 || !d.choices || !d.choices.length || $('#dch').children.length) return;
    const box = $('#dch');
    d.choices.forEach((c) => { const b = document.createElement('span'); b.className = 'btn'; b.textContent = c.label; b.onclick = (e) => { e.stopPropagation(); this.fire('sfx', c.fn() ? 'coin' : 'ui'); }; box.appendChild(b); });
    const b = document.createElement('span'); b.className = 'btn'; b.textContent = '告辞'; b.onclick = (e) => { e.stopPropagation(); this.close(); }; box.appendChild(b);
    $('#dnext').style.visibility = 'hidden';
  }
  // ---- 背包
  trialHud(t) { const e = $('#trialhud'); if (!t) { e.style.display = 'none'; return; } e.style.display = 'block'; if (e.textContent !== t) e.textContent = t; }
  // 垂钓收线条：o 为 null 时隐藏；{ title, z0, w, p, prog }
  fishBar(o) {
    const e = $('#fishbar');
    if (!o) { if (this._fb) { e.style.display = 'none'; this._fb = false; } return; }
    if (!this._fb) { e.style.display = 'block'; this._fb = true; }
    if (this._fbt !== o.title) { this._fbt = o.title; $('#fbt').textContent = o.title; }
    const z = e.querySelector('.zn'); z.style.left = o.z0 * 100 + '%'; z.style.width = o.w * 100 + '%';
    e.querySelector('.pt').style.left = o.p * 100 + '%';
    e.querySelector('.pg i').style.width = Math.max(0, Math.min(1, o.prog)) * 100 + '%';
  }
  // 三选一增益：必须选择一项才能关闭
  boon(list, cb) {
    const box = $('#boon .cards');
    box.innerHTML = list.map((b, i) => `<div class="card" data-i="${i}"><h3>${b.name}</h3><p>${b.desc}</p><kbd>点击 / 按 ${i + 1}</kbd></div>`).join('');
    const pickIt = (i) => { if (!this.boonCb) return; const f = this.boonCb; this.boonCb = null; this.boonKeys = null; this.close(true); f(list[i]); };
    for (const c of box.children) c.onclick = () => pickIt(+c.dataset.i);
    this.boonCb = cb; this.boonKeys = pickIt;
    this.open('boon');
  }
  // 悬赏榜 / 声望商店等面板：render 写入 #bdb
  board(title, render) { $('#bdt').textContent = title; this.open('board', { render: () => render($('#bdb')) }); }
  // 战斗提示（完美闪避、弹反、处决）
  callout(text, color) { const c = $('#call'); c.textContent = text; c.style.color = color; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); }
  bulletTime(k) { $('#bt').style.opacity = k; }
  renderGear() {
    const g = this.game, list = g.s.gear.slice().sort((a, b) => b.q - a.q || gearPower(b) - gearPower(a)), E = g.s.gearEq;
    if (!list.some((x) => x.uid === this.gsel)) this.gsel = list[0] ? list[0].uid : null;
    const grid = $('#grid'), isE = (x) => E[x.slot] === x.uid;
    grid.innerHTML = list.map((x) => `<div class="cell q${x.q}${x.uid === this.gsel ? ' sel' : ''}" data-u="${x.uid}"><img src="${itemIcon(x.icon)}">${isE(x) ? '<i class="eqm">装</i>' : ''}</div>`).join('') + Array.from({ length: Math.max(0, 24 - list.length) }, () => '<div class="cell" style="cursor:default"></div>').join('');
    for (const c of grid.children) if (c.dataset.u) c.onclick = () => { this.gsel = c.dataset.u; this.fire('sfx', 'ui'); this.renderBag(); };
    const info = $('#info'), x = list.find((y) => y.uid === this.gsel);
    if (x) {
      const Q = QUALITY[x.q], cur = g.gearOf(x.slot);
      info.innerHTML = `<h3 style="color:${Q.color}">${x.name} <small style="font-weight:400">${Q.name} · ${SLOT_NAME[x.slot]}</small></h3><div>${gearLines(x).join('<br>')}</div>
        ${cur && cur !== x ? `<div style="margin-top:8px;font-size:12px;color:#a8a090">当前：${cur.name}（${gearLines(cur).join('，')}）</div>` : ''}
        <div style="margin-top:12px;display:flex;gap:8px"><span class="btn" id="geq">${isE(x) ? '卸下' : '装备'}</span><span class="btn" id="gsv">分解（${Q.salvage} 灵石）</span></div>`;
      $('#geq').onclick = () => { if (isE(x)) g.unequipGear(x.slot); else g.equipGear(x.uid); this.fire('sfx', 'pick'); this.renderBag(); };
      $('#gsv').onclick = () => { g.salvage(x.uid); this.fire('sfx', 'coin'); this.renderBag(); };
    } else info.innerHTML = '<div style="color:#c8c0a8">尚无灵宝。<br>击败精英妖兽、首领或闯秘境可得。<br><span style="color:#e4e4e4">凡品</span> · <span style="color:#6ee87a">良品</span> · <span style="color:#5aa8ff">上品</span> · <span style="color:#c27aff">极品</span> · <span style="color:#ffa63a">仙品</span></div>';
  }
  renderBag() {
    if (this.bagTab === 'gear') { this.renderGear(); this.renderChar(); return; }
    const g = this.game, inv = g.s.inv, ids = Object.keys(inv), eq = g.s.equip;
    if (!ids.includes(this.sel)) this.sel = ids[0] || null;
    const grid = $('#grid'), isEq = (id) => id === g.s.weapon || id === eq.armor || id === eq.charm;
    grid.innerHTML = ids.map((id) => `<div class="cell${id === this.sel ? ' sel' : ''}${isEq(id) ? ' eq' : ''}" data-id="${id}"><img src="${itemIcon(id)}"><em>${inv[id] > 1 ? inv[id] : ''}</em></div>`).join('') + Array.from({ length: Math.max(0, 24 - ids.length) }, () => '<div class="cell" style="cursor:default"></div>').join('');
    for (const c of grid.children) if (c.dataset.id) c.onclick = () => { this.sel = c.dataset.id; this.fire('sfx', 'ui'); this.renderBag(); };
    const info = $('#info');
    if (this.sel) {
      const it = ITEMS[this.sel];
      const lab = it.weapon ? (g.s.weapon === this.sel ? '已装备' : '装备') : it.slot ? (eq[it.slot] === this.sel ? '已佩戴' : '佩戴') : it.use === 'learn' ? (g.flag('skill_' + it.skill) ? '已参悟' : '参悟') : it.use === 'passive' ? (g.flag('pas_' + this.sel) ? '已参悟' : '参悟') : it.use === 'food' ? '食用' : '服用';
      info.innerHTML = `<h3>${it.name} <small style="color:#c8c0a8;font-weight:400">× ${inv[this.sel]}</small></h3><div>${it.desc}</div>${it.use || it.weapon || it.slot ? `<div style="margin-top:12px"><span class="btn" id="use">${lab}</span></div>` : ''}`;
      const u = $('#use');
      if (u) u.onclick = () => { if (g.useItem(this.sel)) this.fire('sfx', 'pick'); this.renderBag(); };
    } else info.innerHTML = '<div style="color:#c8c0a8">行囊空空如也。<br>去野外采些灵草吧。</div>';
    this.renderChar();
  }
  renderChar() {
    const g = this.game, eq = g.s.equip, r = g.s.realm, root = g.s.root;
    const gn = (sl, fb) => { const x = g.gearOf(sl); return x ? `<span style="color:${QUALITY[x.q].color}">${x.name}</span>` : fb; };
    const skills = [g.flag('meditate') && '引气诀', ...['qi', 'dash', 'shield', 'wanjian'].filter((k) => g.hasSkill(k)).map((k) => `${SKILLS[k].name}(${SKILLS[k].key})`), r >= R_WIND && '御风·轻功', g.flag('alchemy') && '炼丹术', g.flag('forge') && '炼器术', g.flag('fly') && r >= R_ZHUJI && '御剑飞行', ...g.passives.map((id) => ITEMS[id].name)].filter(Boolean);
    $('#char').innerHTML = `<div>境界：<b style="color:#ffe9a0">${g.realm.name}</b></div><div>修为：${g.realm.need === Infinity ? '—' : `${Math.floor(g.s.xp)} / ${g.realm.need}`}</div>
    <div>灵根：${root ? `<b style="color:${ROOTS[root.el].color}">${g.rootName()}</b>` : '<span style="color:#a8a090">未测</span>'}</div><div style="font-size:12px;color:#b8b0a0">${root ? `${ROOTS[root.el].desc} · 修炼 ×${g.xpMult}` : '去青云村测灵石测试'}</div>
    <div>气血：${Math.ceil(g.s.hp)} / ${g.maxHp}</div><div>灵力：${Math.floor(g.s.mp)} / ${g.maxMp}</div><div>攻击：${g.atk}</div><div>防御：${g.def}</div>
    <div>法衣：${gn('armor', eq.armor ? ITEMS[eq.armor].name : '—')}</div><div>法宝：${gn('charm', eq.charm ? ITEMS[eq.charm].name : '—')}</div>
    <div>佩剑：${gn('weapon', g.s.weapon ? ITEMS[g.s.weapon].name : '—')}</div><div>会心：${Math.round((0.12 + g.eq('crit')) * 100)}%</div><div>斩妖：${g.s.kills}</div><div>宗门：${this.rankName ? this.rankName() : '—'}</div><div>灵宠：${g.flag('fox') ? '九尾灵狐 · 雪团' : '—'}</div>
    <div style="grid-column:1/3;color:#8fe8d0">功法：${skills.join(' · ') || '尚未习得'}</div>`;
    this.dirtyBag = false;
  }
  renderAlch(forge) {
    const g = this.game, box = $(forge ? '#frecs' : '#recs'), list = forge ? FORGE : RECIPES;
    if (!forge && !g.flag('alchemy')) { box.innerHTML = '<div style="padding:20px;text-align:center;line-height:2">炉火未燃。<br>你还不懂炼丹之法——去药铺找药师苏婉请教吧。</div>'; return; }
    if (forge && !g.flag('forge')) { box.innerHTML = '<div style="padding:20px;text-align:center;line-height:2">熔炉的地火被魔君的封印死死压着。<br>唯有击败熔岩魔君，地火方能为你所用。</div>'; return; }
    box.innerHTML = list.map((r, i) => {
      const ok = Object.keys(r.need).every((k) => g.count(k) >= r.need[k]);
      return `<div class="rec"><img src="${itemIcon(r.out)}"><div class="n">${ITEMS[r.out].name}${r.n > 1 ? ' ×' + r.n : ''}</div><div class="m">${Object.keys(r.need).map((k) => `<span class="${g.count(k) >= r.need[k] ? 'ok' : 'no'}">${ITEMS[k].name} ${g.count(k)}/${r.need[k]}</span>`).join('')}<br><span style="color:#b8b0a0">${ITEMS[r.out].desc}</span></div><span class="btn${ok ? '' : ' dis'}" data-i="${i}">${forge ? '锻造' : '炼制'}</span></div>`;
    }).join('');
    for (const b of box.querySelectorAll('.btn')) b.onclick = () => { if (b.classList.contains('dis')) return; if (g.craft(Number(b.dataset.i), forge)) { this.fire('sfx', 'craft'); this.fire('crafted'); } this.renderAlch(forge); };
  }
  // ---- 大地图
  renderMap() {
    const cv = $('#wmap'), c = cv.getContext('2d'), N = 512, X0 = -760, Z0 = -960, S = 1720 / N, w = this.world, g = this.game;
    if (!this.wimg) {
      const img = c.createImageData(N, N), d = img.data;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = X0 + i * S, z = Z0 + j * S, h = w.groundY(x, z);
        let col, sh = 1;
        if (h < 0) { col = MAPCOL[K.BED]; sh = Math.max(0.55, 1 + h * 0.09); }
        else { const kd = w.kindAt(x, z); col = MAPCOL[kd]; sh = Math.min(1.4, Math.max(0.55, 1 + (h - w.groundY(x - S, z - S)) * 0.06)) * (0.85 + Math.min(0.35, h * 0.003)); if (kd === K.GRASS) sh *= 1 - forestDensity(x, z) * 0.32; }
        const o = (j * N + i) * 4;
        d[o] = col[0] * sh; d[o + 1] = col[1] * sh; d[o + 2] = col[2] * sh; d[o + 3] = 255;
      }
      this.wimg = img;
    }
    c.putImageData(this.wimg, 0, 0);
    const P = (x, z) => [(x - X0) / S, (z - Z0) / S];
    c.font = 'bold 15px "PingFang SC","Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.lineJoin = 'round';
    const label = (t, x, z, col = '#ffe9a0', sz = 15) => { const [a, b] = P(x, z); c.font = `bold ${sz}px "PingFang SC","Microsoft YaHei",sans-serif`; c.lineWidth = 4; c.strokeStyle = 'rgba(10,8,16,.85)'; c.strokeText(t, a, b); c.fillStyle = col; c.fillText(t, a, b); };
    label('青云村', 0, -14); label('落霞镇', TOWN.x, TOWN.z - 70); label('万妖谷', VALLEY.x, VALLEY.z - 20, '#ff9a8a'); label('赤焰火山', VOLCANO.x, VOLCANO.z - 40, '#ffb070');
    label('雷劫台', TRIB.x - 40, TRIB.z - 10, '#c8d8ff', 13); label('古修遗迹', RUINS.x, RUINS.z - 22, '#e8e0cc', 13); label('聚灵台', PLATFORM.x + 34, PLATFORM.z, '#b8ffe0', 12);
    label('浮空仙山', ISLANDS[0].x - 30, ISLANDS[0].z - 26, '#d8f0ff', 13); label('青云峰', QINGYUN.x + 60, QINGYUN.z + 30, '#e8e0cc', 13); label('翠竹海', GROVES.bamboo.x, GROVES.bamboo.z + 10, '#b8f0a0', 12);
    for (const p of PORTALS) {
      const [a, b] = P(p.x, p.z), on = g.s.portals[p.id];
      c.beginPath(); c.arc(a, b, 7, 0, 7); c.fillStyle = on ? '#7fe0ff' : '#4a5260'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#0a0a14'; c.stroke();
      c.beginPath(); c.arc(a, b, 3, 0, 7); c.fillStyle = on ? '#ffffff' : '#8a90a0'; c.fill();
    }
    const q = g.questTarget();
    if (q) { const [a, b] = P(q.x, q.z); c.save(); c.translate(a, b); c.rotate(Math.PI / 4); c.fillStyle = '#000'; c.fillRect(-7, -7, 14, 14); c.fillStyle = '#ffd23a'; c.fillRect(-5, -5, 10, 10); c.restore(); }
    if (this.me) { const [a, b] = P(this.me.x, this.me.z); c.save(); c.translate(a, b); c.rotate(-this.me.yaw); c.fillStyle = '#000'; c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 8); c.lineTo(0, 4); c.lineTo(-8, 8); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -8); c.lineTo(5.5, 6); c.lineTo(0, 2.5); c.lineTo(-5.5, 6); c.closePath(); c.fill(); c.restore(); }
    const tp = this.mapOpt && this.mapOpt.teleport, box = $('#plist');
    box.innerHTML = `<p>${tp ? '选择要前往的传送阵：' : '传送阵（站上已点亮的传送阵按 E 即可传送）'}</p>` + PORTALS.map((p) => {
      const on = g.s.portals[p.id], here = p.id === tp;
      return `<span class="btn${!tp || !on || here ? ' dis' : ''}" data-id="${p.id}">${on ? '◈' : '◇'} ${p.name}${here ? '（此处）' : on ? '' : '（未点亮）'}</span>`;
    }).join('') + '<p style="margin-top:8px;font-size:12px">◆ 金色菱形：当前任务目标<br>白色箭头：你的位置</p>';
    for (const b of box.querySelectorAll('.btn')) b.onclick = () => { if (b.classList.contains('dis')) return; this.close(); this.fire('teleport', b.dataset.id); };
  }
  chapter(title, sub, ms = 4600) {
    const e = $('#chapter');
    e.querySelector('h1').textContent = title; e.querySelector('p').textContent = sub || '';
    e.style.opacity = 1; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on');
    this.chUntil = performance.now() + ms + 600; $('#banner').style.opacity = 0;
    clearTimeout(this.ct); this.ct = setTimeout(() => { e.style.opacity = 0; e.classList.remove('on'); }, ms);
    this.fire('sfx', 'chapter');
  }  // ---- HUD
  set(id, key, val, fn) { if (this.cache[key] !== val) { this.cache[key] = val; fn(val); } }
  update(dt, info) {
    const g = this.game, s = g.s;
    if (this.modal === 'dialog' && this.dlg && this.dlg.n < this.dlg.text.length) {
      const d = this.dlg, n0 = Math.floor(d.n);
      d.n = Math.min(d.text.length, d.n + dt * 42);
      if (Math.floor(d.n) !== n0) { $('#dtext').textContent = d.text.slice(0, Math.floor(d.n)); if (n0 % 3 === 0) this.fire('sfx', 'talk'); }
      if (d.n >= d.text.length) this.lastPage();
    }
    if (this.modal === 'bag' && this.dirtyBag) this.renderBag();
    if (this.modal === 'forge' && this.dirtyBag) { this.renderAlch(true); this.dirtyBag = false; }
    if (!this.started) return;
    const bar = (cls, v, max, txt) => {
      this.set(0, cls + 'w', max ? Math.round((v / max) * 200) / 2 : 0, (x) => { $(`#stats .${cls} i`).style.width = x + '%'; });
      this.set(0, cls + 't', txt, (x) => { $(`#stats .${cls} b`).textContent = x; });
    };
    bar('hp', s.hp, g.maxHp, `气血 ${Math.ceil(s.hp)}/${g.maxHp}`);
    bar('mp', s.mp, g.maxMp, g.maxMp ? `灵力 ${Math.floor(s.mp)}/${g.maxMp}` : '灵力 · 未引气');
    const need = g.realm.need;
    bar('xp', need === Infinity ? 1 : s.xp, need === Infinity ? 1 : need, need === Infinity ? '大道无涯' : `修为 ${Math.floor(s.xp)}/${need}`);
    this.set(0, 'realm', g.realm.name, (x) => { $('#realm').textContent = x; });
    this.set(0, 'atk', g.atk, (x) => { $('#atk').textContent = '攻击 ' + x; });
    this.set(0, 'brk', g.canBreak() && need !== Infinity, (x) => { $('#brk').style.display = x ? 'block' : 'none'; });
    this.set(0, 'state', info.state || '', (x) => { const e = $('#state'); e.style.display = x ? 'block' : 'none'; e.textContent = x; });
    this.set(0, 'prompt', this.modal ? '' : info.prompt || '', (x) => { const e = $('#prompt'); e.style.display = x ? 'block' : 'none'; e.innerHTML = x ? `<kbd>E</kbd>${x}` : ''; });
    this.set(0, 'loc', `${info.place} · ${SHI[Math.floor(((s.hour + 1) % 24) / 2)]}时`, (x) => { $('#loc').textContent = x; });
    this.slots.forEach((sl, i) => {
      const off = sl.item ? !g.count(sl.item) : sl.sk ? !g.hasSkill(sl.sk) : sl.flag ? !g.flag(sl.flag) || (sl.flag === 'fly' && s.realm < R_ZHUJI) : false;
      const on = (sl.ch === '坐' && info.meditating) || (sl.ch === '御' && info.flying) || (sl.sk === 'shield' && info.shield);
      this.set(0, 'so' + i, (off ? 1 : 0) + (on ? 2 : 0), () => { const e = $('#s' + i); e.classList.toggle('off', off); e.classList.toggle('on', on); });
      if (sl.item) this.set(0, 'sc' + i, g.count(sl.item), (x) => { $(`#s${i} em`).textContent = x || ''; });
      if (sl.sk && info.cds) this.set(0, 'cd' + i, Math.round(info.cds[sl.sk] * 20), (x) => { $(`#s${i} u`).style.height = x * 5 + '%'; });
    });
    if (this.tgt && (this.tgt.t -= dt) <= 0) { this.tgt = null; $('#target').style.display = 'none'; }
  }
  tracker() {
    const g = this.game;
    $('#tracker').innerHTML = g.active().slice(0, 3).map((q) => {
      const st = g.s.quests[q.id], rdy = g.ready(q, st);
      return `<h4>◆ ${q.name}</h4>` + q.obj.map((o, i) => `<div class="${g.objDone(q, st, i) ? 'ok' : ''}">${g.objText(q, st, i)}</div>`).join('') + (rdy && !q.obj.some((o) => o.t === 'talk') ? '<p>→ 回去复命</p>' : '');
    }).join('') + (this.trackExtra ? this.trackExtra() : '');
  }
  prompt() {}
  toast(text, item) {
    const box = $('#toasts'), e = document.createElement('div');
    e.className = 'toast px'; e.innerHTML = (item ? `<img src="${itemIcon(item)}">` : '') + `<span>${text}</span>`;
    box.appendChild(e);
    while (box.children.length > 6) box.firstChild.remove();
    setTimeout(() => { e.style.opacity = 0; setTimeout(() => e.remove(), 500); }, 3200);
  }
  banner(title, sub, ms = 3200) {
    const wait = (this.chUntil || 0) - performance.now();
    if (wait > 0) { setTimeout(() => this.banner(title, sub, ms), wait + 300); return; }
    const b = $('#banner');
    b.querySelector('h1').textContent = title; b.querySelector('p').textContent = sub || '';
    b.style.opacity = 1;
    clearTimeout(this.bt); this.bt = setTimeout(() => { b.style.opacity = 0; }, ms);
  }
  damage(text, x, y, color) {
    const e = document.createElement('span');
    e.textContent = text; e.style.left = x + 'px'; e.style.top = y + 'px'; e.style.color = color;
    $('#dmg').appendChild(e);
    setTimeout(() => e.remove(), 820);
  }
  target(name, hp, max, boss) {
    const t = $('#target');
    t.style.display = 'block'; t.classList.toggle('boss', !!boss);
    t.querySelector('span').textContent = name; t.querySelector('i').style.width = Math.max(0, (hp / max) * 100) + '%';
    this.tgt = { t: boss ? 12 : 5 };
  }
  clearTarget() { this.tgt = null; $('#target').style.display = 'none'; }
  hurt() { const h = $('#hurt'); h.style.transition = 'none'; h.style.opacity = 1; requestAnimationFrame(() => { h.style.transition = 'opacity .5s'; h.style.opacity = 0; }); }
  fade(on) { $('#fade').style.opacity = on ? 1 : 0; }
  hud(on) { if (this.started) $('#hud').style.opacity = on ? 1 : 0; }

  // ---- 小地图
  drawMap(world, px, pz) {
    const N = 144, S = 2.5, d = this.img.data;
    if (!this.mask) {
      // 村内建筑遮罩（一次性计算）
      this.mask = new Uint8Array(113 * 113);
      for (let j = 0; j < 113; j++) for (let i = 0; i < 113; i++) {
        const x = i * S - 140, z = j * S - 140;
        if (world.col.topAt(x, z, 0.7, 1e9, true) > world.groundY(x, z) + 1.4) this.mask[j * 113 + i] = 1;
      }
    }
    const x0 = Math.round(px / S) * S - (N / 2) * S, z0 = Math.round(pz / S) * S - (N / 2) * S;
    this.mapC.x = x0 + (N / 2) * S; this.mapC.z = z0 + (N / 2) * S;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = x0 + i * S, z = z0 + j * S, ix = Math.floor(x), iz = Math.floor(z);
      const h = world.groundY(x, z);
      let c, sh = 1;
      if (h < 0) { c = MAPCOL[K.BED]; sh = Math.max(0.55, 1 + h * 0.09); }
      else {
        c = MAPCOL[world.kindAt(x, z)];
        sh = Math.min(1.35, Math.max(0.6, 1 + (h - world.groundY(x - 2, z - 2)) * 0.11)) * (0.92 + Math.min(0.2, h * 0.002));
        if (Math.abs(x) < 140 && Math.abs(z) < 140 && this.mask[Math.round((z + 140) / S) * 113 + Math.round((x + 140) / S)]) { c = [88, 80, 96]; sh = 1; }
      }
      const o = (j * N + i) * 4;
      d[o] = c[0] * sh; d[o + 1] = c[1] * sh; d[o + 2] = c[2] * sh; d[o + 3] = 255;
    }
    this.mm.putImageData(this.img, 0, 0);
  }
  // marks: [{x,z,c,s}]；quest: {x,z}|null
  updateMap(world, px, pz, yaw, marks, quest) {
    this.me = { x: px, z: pz, yaw };
    if (Math.abs(px - this.mapC.x) > 14 || Math.abs(pz - this.mapC.z) > 14) this.drawMap(world, px, pz);
    const k = 164 / 320;
    $('#mm').style.transform = `translate(${(this.mapC.x - px) * k}px,${(this.mapC.z - pz) * k}px)`;
    const c = this.mmo;
    c.clearRect(0, 0, 164, 164);
    for (const m of marks) {
      const x = 82 + (m.x - px) * k, y = 82 + (m.z - pz) * k;
      if (x < 2 || y < 2 || x > 162 || y > 162) continue;
      c.fillStyle = '#000'; c.fillRect(Math.round(x) - m.s - 1, Math.round(y) - m.s - 1, m.s * 2 + 2, m.s * 2 + 2);
      c.fillStyle = m.c; c.fillRect(Math.round(x) - m.s, Math.round(y) - m.s, m.s * 2, m.s * 2);
    }
    if (quest) {
      let dx = (quest.x - px) * k, dy = (quest.z - pz) * k;
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      if (m > 76) { dx *= 76 / m; dy *= 76 / m; }
      c.save(); c.translate(82 + dx, 82 + dy); c.rotate(Math.PI / 4);
      c.fillStyle = '#000'; c.fillRect(-6, -6, 12, 12); c.fillStyle = '#ffd23a'; c.fillRect(-4, -4, 8, 8); c.restore();
    }
    c.save(); c.translate(82, 82); c.rotate(-yaw);
    c.fillStyle = '#000'; c.beginPath(); c.moveTo(0, -9); c.lineTo(7, 7); c.lineTo(0, 3); c.lineTo(-7, 7); c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -6); c.lineTo(4.5, 5); c.lineTo(0, 2); c.lineTo(-4.5, 5); c.closePath(); c.fill();
    c.restore();
    c.fillStyle = '#ffe9a0'; c.font = 'bold 11px sans-serif'; c.fillText('北', 76, 12);
  }
}
