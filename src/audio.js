// ============ 声音：程序合成的古琴、箫与园中环境声（原创，无版权素材） ============
const Sound = (() => {
  let ctx = null, master, mMaster, music, amb, verb, vbus, on = true, started = false;
  // 配音：缓存、延迟起声、淡出
  const vCache = new Map(); let vCur = null, vTimer = null, vToken = 0, voiceOn = true, duck = 0;
  function vLoad(key) {
    if (!vCache.has(key)) vCache.set(key, fetch(`voice/${key}.mp3`).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(b => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej))).catch(() => null));
    return vCache.get(key);
  }
  function setDuck(v) { duck = v; if (music) music.gain.setTargetAtTime(v ? 0.26 : 0.85, ctx.currentTime, v ? 0.15 : 0.9); if (amb) amb.gain.setTargetAtTime(v ? 0.4 : 0.7, ctx.currentTime, v ? 0.2 : 0.9); }
  function vStop(fade) {
    if (!vCur) return; const c = vCur; vCur = null;
    const t = ctx.currentTime; c.g.gain.cancelScheduledValues(t); c.g.gain.setValueAtTime(c.g.gain.value, t); c.g.gain.linearRampToValueAtTime(0.0001, t + fade);
    c.src.onended = null; try { c.src.stop(t + fade + 0.05); } catch (e) { }
  }
  let mode = 'gong', density = 1, nextPhrase = 0, timer = null, waterG, windG, birdRate = 1, ending = false;
  // 五声音阶（D 宫）：D E F# A B
  const PENTA = [50, 52, 54, 57, 59];
  const MODES = { gong: 0, shang: 1, zhi: 3, yu: 4 }; // 调式主音在音阶中的位置
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  function scaleNote(deg) { // deg 可为任意整数，按五声音阶展开
    const o = Math.floor(deg / 5), i = ((deg % 5) + 5) % 5; return PENTA[i] + 12 * o;
  }
  function noiseBuf(sec) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate); const d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = last * 0.97 + w * 0.03; d[i] = w * 0.5 + last * 3; } return b;
  }
  function impulse(sec, decay) {
    const len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.connect(master);
    verb = ctx.createConvolver(); verb.buffer = impulse(3.4, 2.6); const vg = ctx.createGain(); vg.gain.value = 0.42; verb.connect(vg); vg.connect(comp);
    mMaster = ctx.createGain(); mMaster.gain.value = on ? 1 : 0; mMaster.connect(comp); mMaster.connect(verb);
    music = ctx.createGain(); music.gain.value = 0.85; music.connect(mMaster);
    amb = ctx.createGain(); amb.gain.value = 0.7; amb.connect(mMaster);
    vbus = ctx.createGain(); vbus.gain.value = 1.0; vbus.connect(master);
    const vs = ctx.createGain(); vs.gain.value = 0.12; vbus.connect(vs); vs.connect(verb);
    const nb = noiseBuf(4);
    // 风过竹林
    const wind = ctx.createBufferSource(); wind.buffer = nb; wind.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 900; wf.Q.value = 0.5;
    windG = ctx.createGain(); windG.gain.value = 0.015; wind.connect(wf); wf.connect(windG); windG.connect(amb); wind.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08; const lg = ctx.createGain(); lg.gain.value = 0.012; lfo.connect(lg); lg.connect(windG.gain); lfo.start();
    // 流水
    const water = ctx.createBufferSource(); water.buffer = nb; water.loop = true; water.playbackRate.value = 0.8;
    const wlp = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 520;
    const whp = ctx.createBiquadFilter(); whp.type = 'highpass'; whp.frequency.value = 120;
    waterG = ctx.createGain(); waterG.gain.value = 0; water.connect(wlp); wlp.connect(whp); whp.connect(waterG); waterG.connect(amb); water.start();
    W.noiseBuf = nb;
  }
  // 古琴：拨弦（泛音叠加 + 指甲声 + 偶尔的上滑音与吟）
  function qin(t, midi, vel = 0.5, dur = 3.2, slide = false, harmonic = false) {
    const f = hz(midi);
    const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(vel, t + 0.006);
    out.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.35);
    out.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(harmonic ? 6000 : 2600, t); lp.frequency.exponentialRampToValueAtTime(harmonic ? 3000 : 650, t + dur * 0.8);
    lp.connect(out);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (pan) { pan.pan.value = -0.15; out.connect(pan); pan.connect(music); } else out.connect(music);
    const parts = harmonic ? [[2, 1], [4, 0.15]] : [[1, 1], [2, 0.42], [3, 0.16], [4.02, 0.06]];
    for (const [k, g] of parts) {
      const o = ctx.createOscillator(); o.type = k === 1 && !harmonic ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(f * k * (slide ? 0.944 : 1), t);
      if (slide) o.frequency.linearRampToValueAtTime(f * k, t + 0.22);
      if (dur > 2.4 && !harmonic) { // 吟：轻微颤动
        const l = ctx.createOscillator(); l.frequency.value = 4.6; const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * k * 0.006, t + 0.9);
        l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur);
      }
      const gg = ctx.createGain(); gg.gain.value = g; o.connect(gg); gg.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
    if (!harmonic) { // 指甲触弦
      const n = ctx.createBufferSource(); n.buffer = W.noiseBuf; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
      const ng = ctx.createGain(); ng.gain.setValueAtTime(vel * 0.25, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      n.connect(hp); hp.connect(ng); ng.connect(music); n.start(t, Math.random() * 2); n.stop(t + 0.06);
    }
  }
  // 箫：气声 + 慢起音 + 颤音
  function xiao(t, midi, dur = 3, vel = 0.1) {
    const f = hz(midi);
    const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(vel, t + 0.35); out.gain.setValueAtTime(vel, t + dur - 0.6); out.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.connect(out);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (pan) { pan.pan.value = 0.25; out.connect(pan); pan.connect(music); } else out.connect(music);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2; const g2 = ctx.createGain(); g2.gain.value = 0.07;
    const l = ctx.createOscillator(); l.frequency.value = 4.8; const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.007, t + 0.8);
    l.connect(lg); lg.connect(o.frequency);
    o.connect(lp); o2.connect(g2); g2.connect(lp);
    const n = ctx.createBufferSource(); n.buffer = W.noiseBuf; n.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 6; const ng = ctx.createGain(); ng.gain.value = 0.6;
    n.connect(bp); bp.connect(ng); ng.connect(lp);
    for (const s of [o, o2, l]) { s.start(t); s.stop(t + dur + 0.05); }
    n.start(t, Math.random() * 2); n.stop(t + dur + 0.05);
  }
  function chirp(t) {
    const o = ctx.createOscillator(); o.type = 'sine'; const g = ctx.createGain(); g.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const n = 2 + Math.floor(Math.random() * 5); const base = 2600 + Math.random() * 1600; let tt = t;
    for (let i = 0; i < n; i++) {
      const d = 0.05 + Math.random() * 0.07;
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.3), tt); o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.5), tt + d);
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.028 + Math.random() * 0.02, tt + 0.01); g.gain.linearRampToValueAtTime(0, tt + d);
      tt += d + 0.03 + Math.random() * 0.08;
    }
    o.connect(g); if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; g.connect(pan); pan.connect(amb); } else g.connect(amb);
    o.start(t); o.stop(tt + 0.05);
  }
  // 乐句生成：以调式主音起落，级进为主，间以休止
  let lastDeg = 5, birdNext = 0;
  function phrase(t0) {
    const tonic = MODES[mode] ?? 0; const beat = ending ? 1.25 : 60 / 54;
    let t = t0; const len = 3 + Math.floor(Math.random() * (ending ? 3 : 5));
    let deg = lastDeg;
    const rh = [1, 1, 0.5, 0.5, 1.5, 2, 1];
    const useXiao = !ending && Math.random() < 0.45 * density;
    for (let i = 0; i < len; i++) {
      const step = [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)];
      deg = Math.max(3, Math.min(12, deg + step));
      if (i === len - 1) deg = tonic + 5 + (Math.random() < 0.3 ? 5 : 0) - (deg > 10 ? 0 : 0);
      const d = rh[Math.floor(Math.random() * rh.length)] * beat;
      const m = scaleNote(deg);
      if (ending) qin(t, m + 12, 0.28, 4.5, false, Math.random() < 0.5);
      else qin(t, m, 0.42 + Math.random() * 0.12, 2.6 + d, Math.random() < 0.2);
      if (!ending && Math.random() < 0.18) qin(t, scaleNote(deg - 5), 0.2, 3); // 八度相和
      if (useXiao && i % 2 === 0) xiao(t + 0.05, m + 12, d * 2 + 0.8, 0.07);
      t += d;
    }
    lastDeg = deg;
    if (!ending && Math.random() < 0.6) qin(t0, scaleNote(tonic) - 12 + 12, 0.18, 5); // 低音散音
    return t + (2 + Math.random() * 3) * beat / (0.6 + 0.4 * density);
  }
  function tick() {
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now + 1.2 > nextPhrase) nextPhrase = phrase(Math.max(now + 0.1, nextPhrase));
    if (birdRate > 0 && now > birdNext) { chirp(now + 0.05); birdNext = now + (1.5 + Math.random() * 5) / birdRate; }
  }
  return {
    start() {
      init(); if (!ctx) return; if (ctx.state === 'suspended') ctx.resume();
      if (!started) { started = true; nextPhrase = ctx.currentTime + 0.6; timer = setInterval(tick, 200); }
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 1.5);
    },
    toggle() { on = !on; if (mMaster) mMaster.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.25); return on; },
    isOn() { return on; },
    setMode(m, dens = 1) { mode = m; density = dens; },
    setEnding(v) { ending = v; birdRate = v ? 0 : birdRate; },
    setBirds(r) { birdRate = r; },
    setWater(v) { if (waterG) waterG.gain.setTargetAtTime(v, ctx.currentTime, 0.5); },
    say(key, onEnd, delay = 400) {
      if (!ctx || !key) return; const tok = ++vToken; clearTimeout(vTimer); vStop(0.3);
      if (!voiceOn) return;
      const go = () => vLoad(key).then(buf => {
        if (tok !== vToken || !voiceOn) return;
        if (!buf) { if (onEnd) onEnd(); return; } // 缺录的句子：不出声，照常往下走
        const src = ctx.createBufferSource(); src.buffer = buf; const g = ctx.createGain(); g.gain.value = 1;
        src.connect(g); g.connect(vbus); src.start(); vCur = { src, g }; setDuck(1);
        src.onended = () => { if (vCur && vCur.src === src) { vCur = null; setDuck(0); if (onEnd) onEnd(); } };
      });
      vTimer = setTimeout(go, delay);
    },
    hush(fade = 0.3) { vToken++; clearTimeout(vTimer); vStop(fade); if (ctx) setTimeout(() => { if (!vCur) setDuck(0); }, fade * 1000 + 300); },
    preload(keys) { if (ctx) keys.forEach(k => k && vLoad(k)); },
    speaking() { return !!vCur; },
    setVoice(v) { voiceOn = v; if (!v) this.hush(0.3); },
    voiceIsOn() { return voiceOn; },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && started && ctx.state === 'suspended') ctx.resume(); }
  };
})();
