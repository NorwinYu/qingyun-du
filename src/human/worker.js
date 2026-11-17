// 在 Worker 中构建人物网格，避免阻塞主线程
import { buildShape } from './build.js';

const pack = (g) => {
  if (!g) return null;
  const attrs = {}, tr = [];
  for (const k in g.attributes) { const a = g.attributes[k]; attrs[k] = { a: a.array, n: a.itemSize }; tr.push(a.array.buffer); }
  const idx = g.index.array; tr.push(idx.buffer);
  return { attrs, idx, tr };
};
self.onmessage = (e) => {
  const { id, look } = e.data;
  try {
    const r = buildShape(look), g = pack(r.geo), h = pack(r.hair);
    self.postMessage({ id, geo: { attrs: g.attrs, idx: g.idx }, hair: h ? { attrs: h.attrs, idx: h.idx } : null }, [...g.tr, ...(h ? h.tr : [])]);
  } catch (err) { self.postMessage({ id, err: String(err && err.stack || err) }); }
};
