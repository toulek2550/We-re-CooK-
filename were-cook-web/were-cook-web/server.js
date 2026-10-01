// We're CooK? — tiny real-time server: static files + lobby/room presence relay
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.static(__dirname + '/public'));
const server = http.createServer(app);
const io = new Server(server);

const MAX_PLAYERS = 6;
const lobby = new Map();              // socketId -> presence
const rooms = new Map();              // code -> Map(socketId -> presence)
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
const sendLobby = () => io.emit('lobby:peers', [...lobby].map(([id, p]) => ({ id, p })));
function sendRoom(code) {
  const m = rooms.get(code);
  io.to(code).emit('room:peers', { code, peers: m ? [...m].map(([id, p]) => ({ id, p })) : [] });
}
function leave(socket, code) {
  const m = rooms.get(code);
  if (!m || !m.delete(socket.id)) return;
  socket.leave(code);
  if (!m.size) rooms.delete(code);
  sendRoom(code);
}

io.on('connection', socket => {
  lobby.set(socket.id, {});
  sendLobby();

  socket.on('lobby:set', patch => { lobby.set(socket.id, merge(lobby.get(socket.id) || {}, patch)); sendLobby(); });

  socket.on('room:join', ({ code, p } = {}) => {
    if (!validCode(code)) return;
    let m = rooms.get(code);
    if (!m) rooms.set(code, (m = new Map()));
    if (m.size >= MAX_PLAYERS && !m.has(socket.id)) return socket.emit('room:full', code);
    socket.join(code);
    m.set(socket.id, merge(m.get(socket.id) || {}, p));
    sendRoom(code);
  });

  socket.on('room:set', ({ code, patch } = {}) => {
    const m = rooms.get(code);
    if (!m || !m.has(socket.id)) return;
    m.set(socket.id, merge(m.get(socket.id), patch));
    sendRoom(code);
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
