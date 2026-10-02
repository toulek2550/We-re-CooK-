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
function leave(socket, code) {
  const m = rooms.get(code);
  if (!m || !m.delete(socket.id)) return;
  socket.leave(code);
  if (!m.size) { rooms.delete(code); seqs.delete(code); stopGame(code); }
  sendRoom(code);
}

/* ---------------- referee ---------------- */
// room members in seat order: humans (creator first, then join order) then the host's bots
function seatOrder(code) {
  const m = rooms.get(code); if (!m) return [];
  const hum = [...m].filter(([, p]) => p && p.joinedAt).sort(([ia, a], [ib, b]) =>
    ((b.creator ? 1 : 0) - (a.creator ? 1 : 0)) || ((a.seq || 0) - (b.seq || 0)) || (ia < ib ? -1 : 1)).map(([id]) => ({ id }));
  const host = hum[0] && m.get(hum[0].id);
  const LV = { easy: .7, normal: 1, hard: 1.35 };
  const bots = (host && Array.isArray(host.bots) ? host.bots.slice(0, 5) : []).filter(b => b && typeof b.id === 'string')
    .map(b => ({ id: 'bot:' + b.id, bot: LV[b.lvl] ? b.lvl : 'normal', sk: LV[b.lvl] || 1 }));
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
  }
}
function startGame(code, gen, dur, mode) {
  stopGame(code);
  if (!rooms.get(code)) return;
  const players = seatOrder(code);
  const t0 = Date.now() + COUNTDOWN_MS;
  // solo: only people play in the referee (solo bots are simulated by the host's screen as before)
  const M = E.createMatch({ gen, dur, t0, mode: mode === 'team' && [4, 6].includes(players.length) ? 'team' : 'solo', players: mode === 'team' && [4, 6].includes(players.length) ? players : players.filter(p => !p.bot) });
  const gm = { code, gen, M };
  for (const p of humans(gm)) setServerFields(code, p.id, { done: false });
  pushAll(gm);
  // every half second: expired orders, stage changes, bots, and the end of the match
  gm.timer = setInterval(() => {
    const now = Date.now(); const r = M.tick(now);
    dispatch(gm, r.events);
    if (r.events.some(e => e.type === 'end')) {
      for (const p of humans(gm)) { const snap = M.snap(p.id, now); const pr = rooms.get(code).get(p.id); setServerFields(code, p.id, { done: true, score: snap.score, served: snap.served, tot: ((pr && +pr.tot) || 0) + snap.score }); }
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
    if (!base) { const n = (seqs.get(code) || 0) + 1; seqs.set(code, n); base = { seq: n }; }
    m.set(socket.id, merge(base, strip(p)));
    sendRoom(code);
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
        startGame(code, clean.gen, dur, m.get(socket.id).mode === 'team' ? 'team' : 'solo');
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
    if (res.ok) pushAll(gm);
    reply(ack, { ...res, snap: gm.M.snap(socket.id, now) });
  });
  // pass an item to your teammate (team mode only — the match refuses anyone else)
  socket.on('game:pass', (msg, ack) => {
    if (!allow()) return reply(ack, { ok: false, msg: 'ส่งถี่เกินไป' });
    if (bad(msg)) return reply(ack, { ok: false, msg: 'ข้อมูลไม่ถูกต้อง' });
    const gm = myGame(msg.code); if (!gm) return reply(ack, { ok: false, msg: 'ไม่ได้อยู่ในเกม' });
    const r = gm.M.pass(socket.id, msg.item, Date.now()); if (r.ok) dispatch(gm, r.events);
    reply(ack, { ok: r.ok, msg: r.msg });
  });
  socket.on('game:ask', (msg, ack) => {
    if (!allow()) return reply(ack, { ok: false });
    if (bad(msg)) return reply(ack, { ok: false });
    const gm = myGame(msg.code); if (!gm) return reply(ack, { ok: false });
    const r = gm.M.ask(socket.id, String(msg.ing), Date.now()); if (r.ok) dispatch(gm, r.events);
    reply(ack, { ok: r.ok, msg: r.msg });
  });
  socket.on('game:clear', (code, ack) => { if (!allow()) return reply(ack, { ok: false }); const gm = myGame(code); reply(ack, gm ? gm.M.clear(socket.id) : { ok: false }); });
  socket.on('game:wash', (code, ack) => {
    if (!allow()) return reply(ack, { ok: false });
    const gm = myGame(code); if (!gm) return reply(ack, { ok: false });
    const r = gm.M.wash(socket.id, Date.now()); if (r.ok) pushAll(gm);
    reply(ack, { ...r, score: gm.M.snap(socket.id, Date.now()).score });
  });

  socket.on('room:leave', code => leave(socket, code));

  socket.on('disconnect', () => {
    lobby.delete(socket.id);
    for (const code of [...rooms.keys()]) leave(socket, code);
    sendLobby();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`We're CooK? running on http://localhost:${PORT}`));
