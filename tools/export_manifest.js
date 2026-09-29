const fs = require('fs');
const src = fs.readFileSync('src/data.js', 'utf8') + '\n;module.exports={STATIONS,EPILOGUE};';
const m = new module.constructor(); m._compile(src, 'data.js');
const { STATIONS, EPILOGUE } = m.exports;
const out = [];
const push = (key, who, t) => out.push({ key, who, t });
for (const st of STATIONS) {
  st.lines.forEach(L => push(L.v, L.who, L.t));
  (st.ask || []).forEach(a => { push(a.v, 'ke', a.q); a.a.forEach(L => push(L.v, L.who, L.t)); });
  (st.outro || []).forEach(L => push(L.v, L.who, L.t));
}
const yearSpoken = { '嘉庆二年': '嘉庆二年', '咸丰三年': '咸丰三年', '同治四年': '同治四年', '民国': '到了民国', '1974': '一九七四年' };
EPILOGUE.forEach(E => { push(E.vt, 'pang', yearSpoken[E.year] + '。' + E.t); if (E.q) push(E.vq, 'pang', E.q); if (E.after) push(E.va, 'pang', E.after); });
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(out.length, 'lines;', out.reduce((s, x) => s + x.t.length, 0), 'chars');
