const fs = require('fs');
const src = fs.readFileSync('src/data.js', 'utf8') + '\n;module.exports={STATIONS,EPILOGUE};';
const m = new module.constructor(); m._compile(src, 'data.js');
const { STATIONS, EPILOGUE } = m.exports;
const out = [];
for (const st of STATIONS) {
  const rows = [];
  st.lines.forEach(L => rows.push({ k: L.v, who: L.who, t: L.t, q: !!L.q, part: '正文' }));
  (st.ask || []).forEach((a, i) => { rows.push({ k: a.v, who: 'ke', t: a.q, q: false, part: `提问${i + 1}` }); a.a.forEach(L => rows.push({ k: L.v, who: L.who, t: L.t, q: !!L.q, part: `回答${i + 1}` })); });
  (st.outro || []).forEach(L => rows.push({ k: L.v, who: L.who, t: L.t, q: !!L.q, part: '收尾' }));
  out.push({ name: st.name, rows });
}
const yearSpoken = { '嘉庆二年': '嘉庆二年', '咸丰三年': '咸丰三年', '同治四年': '同治四年', '民国': '到了民国', '1974': '一九七四年' };
out.push({ name: '尾声', rows: EPILOGUE.flatMap(E => [{ k: E.vt, who: 'pang', t: yearSpoken[E.year] + '。' + E.t, q: false, part: E.ad }, ...(E.q ? [{ k: E.vq, who: 'pang', t: E.q, q: true, part: E.ad }] : []), ...(E.after ? [{ k: E.va, who: 'pang', t: E.after, q: false, part: E.ad }] : [])]) });
fs.writeFileSync('script_rows.json', JSON.stringify(out, null, 1));
console.log(out.reduce((s, x) => s + x.rows.length, 0));
