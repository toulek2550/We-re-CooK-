/* We're CooK? — sound, made entirely in code with the Web Audio API (no audio files).
   Theme B: cartoon party kitchen — bouncy marimba/xylophone music, playful cooking noises.
   SFX.play('chop') for one-shots · SFX.loop('sizzle', level) for continuous sounds · SFX.music('lobby'|'play'|'rush'|null) */
(function (root) {
  'use strict';
  const S = { ctx: null, ok: false, vol: { master: .8, music: .35, sfx: .8 }, loops: {}, mode: null };
  try { const v = JSON.parse(localStorage.getItem('wc_vol') || 'null'); if (v) Object.assign(S.vol, v) } catch (e) { }
  const save = () => { try { localStorage.setItem('wc_vol', JSON.stringify(S.vol)) } catch (e) { } };
  let master, musicBus, sfxBus, noiseBuf, verb;

  function init() {
    if (S.ctx) { if (S.ctx.state === 'suspended') S.ctx.resume(); return }
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return;
    const ctx = S.ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 6; comp.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(comp); sfxBus = ctx.createGain(); sfxBus.connect(comp);
    // a little room echo so things sound like they're in a kitchen
    verb = ctx.createDelay(.5); verb.delayTime.value = .09; const fb = ctx.createGain(); fb.gain.value = .22; const vg = ctx.createGain(); vg.gain.value = .18;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    verb.connect(lp); lp.connect(fb); fb.connect(verb); lp.connect(vg); vg.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVol(); S.ok = true; setInterval(tickLoops, 45);
    if (S.want) music(S.want);
  }
  function applyVol() { if (!S.ctx) return; master.gain.value = S.vol.master * 1.8; musicBus.gain.value = S.vol.music; sfxBus.gain.value = S.vol.sfx }
  // first click / key anywhere unlocks audio (browsers require a user gesture)
  ['pointerdown', 'keydown'].forEach(ev => root.addEventListener(ev, init, { capture: true, passive: true }));

  /* ---------- building blocks ---------- */
  const now = () => S.ctx.currentTime;
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec) }
  function tone(f, t, { type = 'sine', a = .005, dec = .2, vol = .3, f2 = null, bus = sfxBus, wet = 0 } = {}) {
    const o = S.ctx.createOscillator(), g = S.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + dec);
    env(g, t, a, vol, dec); o.connect(g); g.connect(bus); if (wet) { const w = S.ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb) } o.start(t); o.stop(t + a + dec + .05);
  }
  function noise(t, { dur = .1, a = .003, vol = .3, type = 'bandpass', f = 2000, f2 = null, q = 1, bus = sfxBus } = {}) {
    const s = S.ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = .8 + Math.random() * .4;
    const fl = S.ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
    const g = S.ctx.createGain(); env(g, t, a, vol, dur); s.connect(fl); fl.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + a + dur + .05);
  }
  // marimba / xylophone voice (the sound of theme B)
  const mar = (f, t, vol = .22, dec = .38, bus = musicBus) => { tone(f, t, { dec, vol, bus, wet: .3 }); tone(f * 4, t, { dec: dec * .25, vol: vol * .28, bus }) };
  const xylo = (f, t, vol = .2) => { tone(f * 2, t, { dec: .22, vol, wet: .4 }); tone(f * 6.2, t, { dec: .06, vol: vol * .3 }) };
  const bell = (f, t, vol = .25) => { [[1, 1], [2.76, .4], [5.4, .2]].forEach(([m, v]) => tone(f * m, t, { dec: 1.1 / m, vol: vol * v, wet: .5 })) };
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);   // MIDI note -> Hz

  /* ---------- one-shot sounds ---------- */
  const R = (a, b) => a + Math.random() * (b - a);
  const FX = {
    click: t => tone(1400, t, { dec: .03, vol: .06 }),
    pop: t => tone(520, t, { f2: 1100, dec: .07, vol: .22 }),
    place: t => { tone(420, t, { type: 'triangle', dec: .06, vol: .25 }); tone(840, t, { dec: .04, vol: .08 }) },
    whoosh: t => noise(t, { dur: .22, f: 500, f2: 3000, q: 2, vol: .3 }),
    chop: t => { noise(t, { dur: .05, f: 2600, q: 1.5, vol: .5 }); tone(140, t, { f2: 60, dec: .08, vol: .4 }) },
    pound: t => { tone(95, t, { f2: 45, dec: .16, vol: .55 }); noise(t, { dur: .06, type: 'lowpass', f: 700, vol: .35 }) },
    mix: t => noise(t, { dur: .16, f: 900, f2: 2200, q: 1.2, vol: .25 }),
    toss: t => { noise(t, { dur: .2, f: 600, f2: 3200, q: 2, vol: .3 }); noise(t + .05, { dur: .35, type: 'highpass', f: 3500, vol: .25 }) },
    flip: t => { noise(t, { dur: .45, type: 'highpass', f: 2800, vol: .35 }); tone(300, t, { type: 'triangle', dec: .05, vol: .12 }) },
    water: t => { for (let i = 0; i < 7; i++) tone(R(300, 500), t + i * .05, { f2: R(700, 1100), dec: .05, vol: .12 }) },
    steam: t => noise(t, { dur: .7, f: 3500, q: .8, vol: .3, a: .05 }),
    dip: t => { noise(t, { dur: .5, type: 'highpass', f: 2500, vol: .35, a: .02 }); tone(200, t, { f2: 120, dec: .12, vol: .15 }) },
    ding: t => bell(hz(88), t, .3),
    serve: t => { bell(hz(84), t, .28); [72, 76, 79, 84].forEach((n, i) => mar(hz(n), t + .08 + i * .07, .2, .3, sfxBus)) },
    coin: t => [84, 88, 91].forEach((n, i) => xylo(hz(n - 12), t + i * .05, .15)),
    good: t => { xylo(hz(84), t, .14); xylo(hz(91), t + .06, .12) },
    ok: t => xylo(hz(79), t, .12),
    bad: t => { tone(220, t, { type: 'square', dec: .12, vol: .07, f2: 160 }) },
    fail: t => { tone(330, t, { type: 'square', dec: .15, vol: .08, f2: 300 }); tone(250, t + .16, { type: 'square', dec: .3, vol: .08, f2: 160 }) },
    expire: t => { tone(196, t, { type: 'sawtooth', dec: .35, vol: .06, f2: 120 }) },
    scrub: t => noise(t, { dur: .08, f: R(1200, 2000), q: 2, vol: .18 }),
    wash: t => { FX.water(t); bell(hz(96), t + .3, .12) },
    tick: t => tone(1000, t, { dec: .04, vol: .18, type: 'triangle' }),
    beep: t => tone(1500, t, { dec: .08, vol: .12, type: 'square' }),
    count: t => { xylo(hz(72), t, .22); tone(800, t, { dec: .05, vol: .1, type: 'triangle' }) },
    go: t => { [72, 76, 79, 84].forEach(n => mar(hz(n), t, .16, .5, sfxBus)); tone(1200, t + .02, { f2: 2400, dec: .25, vol: .1 }) },
    stage: t => [79, 84, 88].forEach((n, i) => xylo(hz(n - 12), t + i * .09, .16)),
    rush: t => { [0, .14, .28].forEach(d => tone(hz(67), t + d, { type: 'sawtooth', dec: .1, vol: .08 })); tone(hz(72), t + .42, { type: 'sawtooth', dec: .4, vol: .09 }) },
    timeup: t => { tone(1800, t, { f2: 300, dec: .6, vol: .12 }); bell(hz(76), t + .55, .3) },
    fanfare: t => { [[72, 0], [76, .12], [79, .24], [84, .36], [79, .6], [84, .72]].forEach(([n, d]) => { mar(hz(n), t + d, .2, .35, sfxBus); tone(hz(n - 12), t + d, { type: 'sawtooth', dec: .12, vol: .04 }) }); bell(hz(96), t + .9, .2) },
    join: t => { xylo(hz(76), t, .12); xylo(hz(83), t + .07, .12) },
    burnt: t => { noise(t, { dur: .4, type: 'highpass', f: 2000, vol: .2 }); tone(150, t, { type: 'sawtooth', dec: .3, vol: .05, f2: 90 }) },
  };
  function play(name, opt) { if (!S.ok || !FX[name]) return; try { FX[name](now() + .005, opt) } catch (e) { } }

  /* ---------- continuous sounds (level 0..1) ---------- */
  const LOOPS = {
    sizzle: { f: 'highpass', fq: 3200, vol: .15, pops: .9 },      // pan / grill fat
    fry: { f: 'highpass', fq: 2400, vol: .3, pops: 1.4, bub: .4 }, // deep-fryer oil
    boil: { f: 'lowpass', fq: 400, vol: .25, bub: 1 },             // pot
    steam: { f: 'bandpass', fq: 3800, vol: .2 },                    // steamer
    crackle: { f: 'lowpass', fq: 900, vol: .12, pops: 1.2 },        // charcoal
    oven: { hum: 1, vol: .06 },                                     // oven fan
    pour: { f: 'bandpass', fq: 1100, vol: .22, wob: 1 },           // seasoning bottle
  };
  function loop(name, level) {
    if (!S.ok) return; const L = LOOPS[name]; let st = S.loops[name];
    if (!st) {
      const g = S.ctx.createGain(); g.gain.value = 0; g.connect(sfxBus); let src;
      if (L.hum) { src = S.ctx.createOscillator(); src.type = 'sawtooth'; src.frequency.value = 58; const lp = S.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; src.connect(lp); lp.connect(g) }
      else { src = S.ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; const fl = S.ctx.createBiquadFilter(); fl.type = L.f; fl.frequency.value = L.fq; fl.Q.value = .7; src.connect(fl); fl.connect(g); st = { fl } }
      src.start(); st = Object.assign(st || {}, { g, src, level: 0, L });
      S.loops[name] = st;
    }
    st.level = Math.max(0, Math.min(1, level)); st.g.gain.setTargetAtTime(st.level * L.vol, now(), .06);
    if (L.wob && st.fl) st.fl.frequency.setTargetAtTime(L.fq * (.8 + st.level * .6), now(), .05);
  }
  function stopLoops() { for (const [k, st] of Object.entries(S.loops)) { try { st.g.gain.setTargetAtTime(0, now(), .05); st.src.stop(now() + .3) } catch (e) { } } S.loops = {} }
  function tickLoops() {   // random crackles and bubbles make the loops feel alive
    if (!S.ok) return; const t = now();
    for (const st of Object.values(S.loops)) {
      const L = st.L, lv = st.level; if (lv <= .01) continue;
      if (L.pops && Math.random() < L.pops * lv * .55) noise(t + Math.random() * .04, { dur: R(.01, .03), type: 'highpass', f: R(2500, 6000), vol: R(.08, .2) * lv });
      if (L.bub && Math.random() < L.bub * lv * .5) tone(R(160, 320), t + Math.random() * .04, { f2: R(450, 800), dec: R(.03, .06), vol: R(.05, .12) * lv });
    }
  }

  /* ---------- music: a bouncy 4-bar loop (C - Am - F - G), marimba lead + pizzicato bass + light drums ---------- */
  const CH = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
  const RHY = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0];
  // fixed melody (indices into chord tones, +12 per octave), so the tune is the same every loop
  const MEL = [[2, 1, 0, 1, 2, 3, 2, 1], [1, 2, 3, 2, 1, 0, 1, 2], [0, 1, 2, 3, 4, 3, 2, 1], [2, 3, 4, 3, 2, 1, 2, 4]];
  const MODES = { lobby: { bpm: 104, drums: 0, lead: .2, bass: .17 }, play: { bpm: 96, drums: 1, lead: .2, bass: .19 }, rush: { bpm: 122, drums: 2, lead: .22, bass: .22, brass: 1 } };
  let seq = null;
  function music(mode) {
    S.want = mode; if (!S.ok) return;
    if (S.mode === mode) return; S.mode = mode; if (seq) { clearInterval(seq.timer); seq = null }
    if (!mode) return; const M = MODES[mode];
    seq = { step: 0, next: now() + .08, M };
    seq.timer = setInterval(() => {
      const spb = 60 / M.bpm / 4;
      while (seq && seq.next < now() + .15) { schedule(seq.step, seq.next, M); seq.step = (seq.step + 1) % 64; seq.next += spb }
    }, 25);
  }
  function schedule(step, t, M) {
    const bar = Math.floor(step / 16), s = step % 16, ch = CH[bar];
    const tone_ = i => ch[i % 3] + 12 * Math.floor(i / 3) + 12;
    if (RHY[s]) { const mi = MEL[bar][Math.floor(s / 2) % 8]; mar(hz(tone_(mi)), t, M.lead) }
    if (s === 0 || s === 8) tone(hz(ch[0] - 24), t, { type: 'triangle', dec: .22, vol: M.bass, bus: musicBus });
    if (s === 6 || s === 14) tone(hz(ch[2] - 24), t, { type: 'triangle', dec: .14, vol: M.bass * .8, bus: musicBus });
    if (M.drums) {
      // normal play: soft kick + light clap + gentle shaker · rush: full beat
      const busy = M.drums > 1;
      if (busy ? s % 8 === 0 : s === 0 || s === 10) tone(110, t, { f2: 45, dec: .12, vol: busy ? .3 : .2, bus: musicBus });   // kick
      if (busy ? s === 4 || s === 12 : s === 8) noise(t, { dur: .08, f: 1800, q: .8, vol: busy ? .18 : .1, bus: musicBus }); // clap
      if (busy ? true : s % 4 === 2) noise(t, { dur: .02, type: 'highpass', f: 7000, vol: busy ? .06 : .04, bus: musicBus }); // hats / shaker
    } else if (s % 4 === 2) noise(t, { dur: .03, type: 'highpass', f: 6000, vol: .035, bus: musicBus }); // shaker
    if (M.brass && (s === 0 || s === 10) && bar % 2 === 0) ch.forEach(n => tone(hz(n), t, { type: 'sawtooth', dec: .18, vol: .035, bus: musicBus }));
    if (s === 0 && bar === 0 && M.drums) xylo(hz(84), t, .05);
  }

  function setVol(k, v) { S.vol[k] = Math.max(0, Math.min(1, v)); applyVol(); save() }
  root.SFX = { init, play, loop, stopLoops, music, setVol, get vol() { return S.vol }, get ready() { return S.ok }, _tap() { const an = S.ctx.createAnalyser(); an.fftSize = 2048; master.connect(an); return an }, _stream() { const d = S.ctx.createMediaStreamDestination(); master.connect(d); return d.stream } };
})(typeof self !== 'undefined' ? self : this);
