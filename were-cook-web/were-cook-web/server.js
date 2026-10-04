// We're CooK? — real-time server
//  1) serves the game files
//  2) relays lobby/room presence (who is here, ready, chat)
//  3) is the REFEREE during a match: it owns the order tickets, the timer and the score.
//     Clients only send what they did (the plate they built); the server checks it and scores it
//     with the shared engine (public/shared/engine.js), so nobody can hand themselves points.
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const E = require('./public/shared/engine.js');

const app = express();
app.use(express.static(__dirname + '/public'));
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 16 * 1024 });

const MAX_PLAYERS = 6;
const COUNTDOWN_MS = 3100;            // the "3-2-1-ลุย!" the clients show before cooking starts
const lobby = new Map();              // socketId -> presence
const rooms = new Map();              // code -> Map(socketId -> presence)
const seqs = new Map();               // code -> join counter (server decides who joined first)
const games = new Map();              // code -> { gen, timer, players: Map(socketId -> engine game) }
const validCode = c => typeof c === 'string' && /^wc[0-5]{4}$/.test(c);

// merge a patch into presence; null deletes a field; reject anything too big
function merge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return base;
  const next = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) continue;
    if (v === null) delete next[k]; else next[k] = v;
  }
  return JSON.stringify(next).length <= 4096 ? next : base;
}
// fields only the server may write: join order and everything about the score
const SERVER_ONLY = ['seq', 'score', 'served', 'done', 'tot'];
const strip = p => {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return {};
  const out = { ...p }; for (const k of SERVER_ONLY) delete out[k]; return out;
};
const sendLobby = () => io.emit('lobby:peers', [...lobby].map(([id, p]) => ({ id, p })));
function sendRoom(code) {
  const m = rooms.get(code);
  io.to(code).emit('room:peers', { code, peers: m ? [...m].map(([id, p]) => ({ id, p })) : [] });
}
const setServerFields = (code, id, fields) => { const m = rooms.get(code); if (m && m.has(id)) m.set(id, { ...m.get(id), ...fields }); };
// host = the room creator, otherwise whoever joined first (same rule as the client)
function hostId(code) {
  const m = rooms.get(code); if (!m) return null;
  const list = [...m].filter(([, p]) => p && p.joinedAt).sort(([ia, a], [ib, b]) =>
    ((b.creator ? 1 : 0) - (a.creator ? 1 : 0)) || ((a.seq || 0) - (b.seq || 0)) || (ia < ib ? -1 : 1));
  return list.length ? list[0][0] : null;
}
// "ghosts": players who dropped (e.g. pressed F5). For GRACE ms they keep their seat, host role and
// place in a running game; joining again with the same player id (pid) takes it all back.
const GRACE = 45000;
const ghosts = new Map();             // code -> Map(pid -> { p: presence, id: old socket id, t })
const validPid = v => typeof v === 'string' && /^[a-z0-9]{6,32}$/i.test(v);
function closeRoom(code) { rooms.delete(code); seqs.delete(code); ghosts.delete(code); tours.delete(code); stopGame(code); }
function leave(socket, code, keep) {
  const m = rooms.get(code); if (!m) return;
  const p = m.get(socket.id); if (!p) return;
  m.delete(socket.id); socket.leave(code);
  if (keep && validPid(p.pid)) { let g = ghosts.get(code); if (!g) ghosts.set(code, (g = new Map())); g.set(p.pid, { p, id: socket.id, t: Date.now() }); }
  if (!m.size && !(ghosts.get(code) && ghosts.get(code).size)) closeRoom(code);
  sendRoom(code);
}
setInterval(() => {
  const now = Date.now();
  for (const [code, g] of ghosts) {
    for (const [pid, gh] of g) if (now - gh.t > GRACE) g.delete(pid);
    if (!g.size) { ghosts.delete(code); const m = rooms.get(code); if (m && !m.size) closeRoom(code); }
  }
}, 5000);
// give a returning player their old seat (and their place in the game, if one is running)
function reclaim(code, pid, socket, m) {
  if (!validPid(pid)) return null;
  let old = null;
  const g = ghosts.get(code); if (g && g.has(pid)) { old = g.get(pid); g.delete(pid); }
  if (!old) for (const [id, p] of m) if (id !== socket.id && p.pid === pid) { old = { p, id }; m.delete(id); break; }   // same player, stale connection
  if (!old) return null;
  const gm = games.get(code);
  if (gm) { const gp = gm.M.players.find(x => x.id === old.id); if (gp) gp.id = socket.id; }
  return old.p;
}

/* ---------------- referee ---------------- */
// room members in seat order: humans (creator first, then join order) then the host's bots
function seatOrder(code) {
  const m = rooms.get(code); if (!m) return [];
  const hum = [...m].filter(([, p]) => p && p.joinedAt).sort(([ia, a], [ib, b]) =>
    ((b.creator ? 1 : 0) - (a.creator ? 1 : 0)) || ((a.seq || 0) - (b.seq || 0)) || (ia < ib ? -1 : 1)).map(([id, p]) => ({ id, key: validPid(p.pid) ? p.pid : id }));
  const host = hum[0] && m.get(hum[0].id);
  const LV = { easy: .7, normal: 1, hard: 1.35 };
  const bots = (host && Array.isArray(host.bots) ? host.bots.slice(0, 5) : []).filter(b => b && typeof b.id === 'string')
    .map(b => ({ id: 'bot:' + b.id, key: 'bot:' + b.id, bot: LV[b.lvl] ? b.lvl : 'normal', sk: LV[b.lvl] || 1 }));
  return [...hum, ...bots];
}
function stopGame(code) { const gm = games.get(code); if (gm) { clearInterval(gm.timer); games.delete(code); } }
const humans = gm => gm.M.players.filter(p => !p.bot && rooms.get(gm.code) && rooms.get(gm.code).has(p.id));
function pushAll(gm, extra) {
  const now = Date.now();
  for (const p of humans(gm)) {
    const snap = gm.M.snap(p.id, now);
    setServerFields(gm.code, p.id, { gen: gm.gen, score: snap.score, served: snap.served });
    io.to(p.id).emit('game:you', { code: gm.code, snap, ...(extra || {}) });
  }
  sendRoom(gm.code);
}
function dispatch(gm, events) {
  for (const e of events || []) {
    if (e.type === 'recv' || e.type === 'ask') io.to(e.to).emit('game:' + e.type, { code: gm.code, from: e.from, item: e.item, ing: e.ing });
    else if (e.type === 'expired') for (const p of humans(gm)) { if (gm.M.players.find(q => q.id === p.id).team === e.team) io.to(p.id).emit('game:expired', { code: gm.code, list: e.list }); }
    else if (e.type === 'stage') io.to(gm.code).emit('game:stage', { code: gm.code, i: e.i });
    else if (e.type === 'prank' || e.type === 'gold' || e.type === 'goldnew' || e.type === 'grab' || e.type === 'coopserve' || e.type === 'coopbot' || e.type === 'boost') io.to(gm.code).emit('game:' + e.type, { code: gm.code, ...e });
  }
}
const tours = new Map();              // code -> { round, alive: [ids] }  (tournament progress, checked by the server)
// the host proposes who is still in; the server only accepts the right number of players, all still alive
function checkTour(code, tour, players) {
  if (!tour || typeof tour !== 'object' || !Array.isArray(tour.alive)) return null;
  // players are identified by a stable key (their player id), so a reload (new connection) keeps their place
  const ids = players.map(p => p.key), round = +tour.round, alive = tour.alive.filter(id => typeof id === 'string');
  const prev = tours.get(code);
  if (round === 1 || !prev) { const all = ids.slice(); tours.set(code, { round: 1, alive: all }); return tours.get(code) }
  if (round !== prev.round + 1) return prev.round === round ? prev : null;
  const want = E.tourNext(prev.alive.length);
  const ok = alive.length === want && alive.every(id => prev.alive.includes(id)) && new Set(alive).size === alive.length;
  if (!ok) return null;
  // people the server refereed last round: nobody kept may have scored less than a person who was cut
  const sc = prev.scores || {}, kept = alive.filter(k => k in sc).map(k => sc[k]), cut = prev.alive.filter(k => k in sc && !alive.includes(k)).map(k => sc[k]);
  if (kept.length && cut.length && Math.max(...cut) > Math.min(...kept)) return null;
  tours.set(code, { round, alive }); return tours.get(code);
}
function startGame(code, gen, dur, mode, tour, diff, market) {
  stopGame(code);
  if (!rooms.get(code)) return;
  let players = seatOrder(code), round = 'normal';
  if (mode === 'tour') {
    const t = checkTour(code, tour, players.filter(p => !p.bot).concat(players.filter(p => p.bot)));
    if (!t) return;                                              // refuse a bad tournament step
    players = players.filter(p => t.alive.includes(p.key)); round = E.tourKind(t.round, t.alive.length);
  } else tours.delete(code);
  const t0 = Date.now() + COUNTDOWN_MS;
  const team = mode === 'team' && [4, 6].includes(players.length);
  // solo / tournament: only people play in the referee (solo bots are simulated by the host's screen)
  const coop = mode === 'coop';
  const M = E.createMatch({ gen, dur, t0, mode: team ? 'team' : coop ? 'coop' : 'solo', players: team || coop ? players : players.filter(p => !p.bot), round, diff: ['easy', 'normal', 'chef'].includes(diff) ? diff : 'normal', market: !!market });
  const gm = { code, gen, M, keys: Object.fromEntries(players.map(p => [p.id, p.key])), tour: mode === 'tour' };
  for (const p of humans(gm)) setServerFields(code, p.id, { done: false });
  pushAll(gm);
  // every half second: expired orders, stage changes, bots, and the end of the match
  gm.timer = setInterval(() => {
    const now = Date.now(); const r = M.tick(now);
    dispatch(gm, r.events);
    if (r.events.some(e => e.type === 'end')) {
      for (const p of humans(gm)) { const snap = M.snap(p.id, now); const pr = rooms.get(code).get(p.id); setServerFields(code, p.id, { done: true, score: snap.score, served: snap.served, tot: ((pr && +pr.tot) || 0) + snap.score }); }
      if (gm.tour && tours.get(code)) { const sc = {}; for (const p of humans(gm)) { const pr = rooms.get(code).get(p.id); sc[(pr && validPid(pr.pid)) ? pr.pid : (gm.keys[p.id] || p.id)] = M.snap(p.id, now).score; } tours.get(code).scores = sc; }
      clearInterval(gm.timer); pushAll(gm); return;
    }
    if (r.changed) pushAll(gm);
  }, 500);
  games.set(code, gm);
}

// simple rate limit for game actions: 8 per second per socket
function limiter() { let tokens = 8, last = Date.now(); return () => { const now = Date.now(); tokens = Math.min(8, tokens + (now - last) / 125); last = now; if (tokens < 1) return false; tokens--; return true; }; }

io.on('connection', socket => {
  lobby.set(socket.id, {});
  sendLobby();
  const allow = limiter();

  socket.on('lobby:set', patch => { lobby.set(socket.id, merge(lobby.get(socket.id) || {}, patch)); sendLobby(); });

  socket.on('room:join', ({ code, p } = {}) => {
    if (!validCode(code)) return;
    let m = rooms.get(code);
    if (!m) rooms.set(code, (m = new Map()));
    if (m.size >= MAX_PLAYERS && !m.has(socket.id)) return socket.emit('room:full', code);
    socket.join(code);
    let base = m.get(socket.id);
    if (!base) base = reclaim(code, p && p.pid, socket, m);
    if (!base) { const n = (seqs.get(code) || 0) + 1; seqs.set(code, n); base = { seq: n }; }
    m.set(socket.id, merge(base, strip(p)));
    sendRoom(code);
    const gm = games.get(code); if (gm && gm.M.players.some(x => x.id === socket.id)) socket.emit('game:you', { code, snap: gm.M.snap(socket.id, Date.now()) });
  });

  socket.on('room:set', ({ code, patch } = {}) => {
    const m = rooms.get(code);
    if (!m || !m.has(socket.id)) return;
    const clean = strip(patch);
    m.set(socket.id, merge(m.get(socket.id), clean));
    // the host starting a round (or going back to the waiting room) drives the referee
    if (hostId(code) === socket.id && clean.phase) {
      const gm = games.get(code);
      if (clean.phase === 'play' && typeof clean.gen === 'number' && (!gm || gm.gen !== clean.gen)) {
        const dur = [120, 180, 300].includes(+clean.dur) ? +clean.dur : 180;
        const hp = m.get(socket.id); startGame(code, clean.gen, dur, ['team', 'tour', 'coop'].includes(hp.mode) ? hp.mode : 'solo', hp.tour, hp.diff, hp.market);
      } else if (clean.phase === 'wait') stopGame(code);
    }
    sendRoom(code);
  });

  // ---- game actions: the client sends what it did, the server judges it ----
  const myGame = code => { const gm = games.get(code); return gm && gm.M.players.some(p => p.id === socket.id) ? gm : null; };
  const reply = (ack, data) => { if (typeof ack === 'function') ack(data); };
  const bad = msg => !msg || typeof msg !== 'object' || JSON.stringify(msg).length > 4000;
  socket.on('game:sync', (code, ack) => { const gm = myGame(code); reply(ack, gm ? { ok: true, snap: gm.M.snap(socket.id, Date.now()) } : { ok: false }); });
  socket.on('game:serve', (msg, ack) => {
    if (!allow()) return reply(ack, { ok: false, msg: 'ส่งถี่เกินไป' });
    if (bad(msg)) return reply(ack, { ok: false, msg: 'ข้อมูลไม่ถูกต้อง' });
    const gm = myGame(msg.code); if (!gm) return reply(ack, { ok: false, msg: 'ไม่ได้อยู่ในเกม' });
    const now = Date.now(); const res = gm.M.serve(socket.id, { plate: msg.plate, season: msg.season, sel: +msg.sel }, now);
    if (res.ok) { pushAll(gm); if (res.events) dispatch(gm, res.events) }
    const { events, ...out } = res; reply(ack, { ...out, snap: gm.M.snap(socket.id, now) });
  });
  // pass an item to your teammate (team mode only — the match refuses anyone else)
  socket.on('game:pass', (msg, ack) => {
    if (!allow()) return reply(ack, { ok: false, msg: 'ส่งถี่เกินไป' });
    if (bad(msg)) return reply(ack, { ok: false, msg: 'ข้อมูลไม่ถูกต้อง' });
    const gm = myGame(msg.code); if (!gm) return reply(ack, { ok: false, msg: 'ไม่ได้อยู่ในเกม' });
    const r = gm.M.pass(socket.id, msg.item, Date.now(), msg.dir === 'l' ? 'l' : 'r'); if (r.ok) { dispatch(gm, r.events); if (gm.M.mode === 'coop') pushAll(gm) }
    reply(ack, { ok: r.ok, msg: r.msg });
  });
  socket.on('game:ask', (msg, ack) => {
    if (!allow()) return reply(ack, { ok: false });
    if (bad(msg)) return reply(ack, { ok: false });
    const gm = myGame(msg.code); if (!gm) return reply(ack, { ok: false });
    const r = gm.M.ask(socket.id, String(msg.ing), Date.now()); if (r.ok) dispatch(gm, r.events);
    reply(ack, { ok: r.ok, msg: r.msg, owner: r.owner });
  });
  socket.on('game:clear', (msg, ack) => { if (!allow()) return reply(ack, { ok: false }); const code = msg && typeof msg === 'object' ? msg.code : msg; const gm = myGame(code); reply(ack, gm ? gm.M.clear(socket.id, msg && msg.plate) : { ok: false }); });
  // cooking is reported in two steps (start / done); the server times it and keeps the cooked food in a ledger
  socket.on('game:cookStart', (msg, ack) => { if (!allow()) return reply(ack, { ok: false }); if (bad(msg)) return reply(ack, { ok: false }); const gm = myGame(msg.code); reply(ack, gm ? gm.M.cookStart(socket.id, String(msg.tool), Date.now()) : { ok: false }); });
  socket.on('game:cook', (msg, ack) => { if (!allow()) return reply(ack, { ok: false, msg: 'ส่งถี่เกินไป' }); if (bad(msg)) return reply(ack, { ok: false, msg: 'ข้อมูลไม่ถูกต้อง' }); const gm = myGame(msg.code); reply(ack, gm ? gm.M.cook(socket.id, msg.c, Date.now()) : { ok: false, msg: 'ไม่ได้อยู่ในเกม' }); });
  // prank card: the referee picks the target (whoever is ahead) and applies the effect
  socket.on('game:prank', (code, ack) => {
    if (!allow()) return reply(ack, { ok: false });
    const gm = myGame(code); if (!gm) return reply(ack, { ok: false });
    const r = gm.M.prank(socket.id, Date.now()); if (r.ok) { dispatch(gm, r.events); pushAll(gm) }
    reply(ack, { ok: r.ok, msg: r.msg, card: r.card, none: r.none });
  });
  // market: grab from the shared belt / throw a grabbed item away
  socket.on('game:grab', (msg, ack) => {
    if (!allow()) return reply(ack, { ok: false, msg: 'ช้าหน่อย' }); if (bad(msg)) return reply(ack, { ok: false });
    const gm = myGame(msg.code); if (!gm) return reply(ack, { ok: false });
    const now = Date.now(); const r = gm.M.grab(socket.id, msg.id, now); if (r.ok) { dispatch(gm, r.events); pushAll(gm) }
    reply(ack, { ok: r.ok, msg: r.msg, ing: r.ing, gone: r.gone, snap: gm.M.snap(socket.id, now) });
  });
  socket.on('game:drop', (msg, ack) => { if (!allow()) return reply(ack, { ok: false }); if (bad(msg)) return reply(ack, { ok: false }); const gm = myGame(msg.code); reply(ack, gm ? gm.M.drop(socket.id, String(msg.ing)) : { ok: false }); });
  // co-op: shared plates (place / season / dump / serve) — everyone in the kitchen sees the change
  const coopAct = (ev, fn) => socket.on(ev, (msg, ack) => {
    if (!allow()) return reply(ack, { ok: false, msg: 'ช้าหน่อย' }); if (bad(msg)) return reply(ack, { ok: false });
    const gm = myGame(msg.code); if (!gm || !gm.M.plates) return reply(ack, { ok: false });
    const now = Date.now(); const r = fn(gm.M, msg, now); if (r.ok) { pushAll(gm); if (r.events) dispatch(gm, r.events) }
    const { events, ...out } = r; reply(ack, { ...out, snap: gm.M.snap(socket.id, now) });
  });
  coopAct('game:place', (M, m, now) => M.place(socket.id, +m.pi, m.item, now));
  coopAct('game:pseason', (M, m) => M.seasonPlate(socket.id, +m.pi, m.season));
  coopAct('game:pdump', (M, m) => M.dumpPlate(socket.id, +m.pi));
  coopAct('game:pserve', (M, m, now) => M.servePlate(socket.id, +m.pi, +m.sel, now));
  socket.on('game:wash', (code, ack) => {
    if (!allow()) return reply(ack, { ok: false });
    const gm = myGame(code); if (!gm) return reply(ack, { ok: false });
    const r = gm.M.wash(socket.id, Date.now()); if (r.ok) pushAll(gm);
    reply(ack, { ...r, score: gm.M.snap(socket.id, Date.now()).score });
  });

  socket.on('room:leave', code => leave(socket, code));

  socket.on('disconnect', () => {
    lobby.delete(socket.id);
    for (const code of [...rooms.keys()]) leave(socket, code, true);
    sendLobby();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`We're CooK? running on http://localhost:${PORT}`));
