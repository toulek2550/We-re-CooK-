// Run the game WITHOUT npm install (no express / socket.io needed): node tools/dev-server-nodeps.js
// It loads the real server.js and swaps socket.io for a tiny look-alike (SSE + POST). Good for testing at home / on a LAN.
const Module = require('module'); const orig = Module._load;
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2] || path.join(__dirname, '..');
let IO;
const socks = new Map(); // id -> sock
let nid = 0;
class Sock {
  constructor(res) { this.id = 'S' + (++nid) + Math.random().toString(36).slice(2, 6); this.res = res; this.h = {}; this.rooms = new Set(); }
  on(e, f) { this.h[e] = f }
  join(r) { this.rooms.add(r) } leave(r) { this.rooms.delete(r) }
  emit(ev, data) { this.send({ ev, data }) }
  send(o) { try { this.res.write('data: ' + JSON.stringify(o) + '\n\n') } catch (e) { } }
}
class FakeIO {
  constructor() { this.h = {}; IO = this }
  on(e, f) { this.h[e] = f }
  emit(ev, data) { for (const s of socks.values()) s.emit(ev, data) }
  to(t) { return { emit: (ev, data) => { for (const s of socks.values()) if (s.id === t || s.rooms.has(t)) s.emit(ev, data) } } }
}
const CLIENT = `(()=>{window.io=function(){const acks={};let seq=0,q=[];const h={};
const fire=(e,...a)=>(h[e]||[]).forEach(f=>f(...a));
const s={id:null,connected:false,on(e,f){(h[e]=h[e]||[]).push(f)},
 emit(ev,...a){const ack=typeof a[a.length-1]==='function'?a.pop():null;const n=ack?++seq:0;if(ack)acks[n]=ack;
  const go=()=>fetch('/_b/emit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sid:s.id,ev,args:a,n})});
  if(s.id)go();else q.push(go)}};
const es=new EventSource('/_b/stream');
es.onmessage=m=>{const d=JSON.parse(m.data);if(d.t==='hello'){s.id=d.sid;s.connected=true;fire('connect');q.splice(0).forEach(f=>f())}
 else if(d.t==='ack'){const f=acks[d.n];delete acks[d.n];f&&f(d.r)}else fire(d.ev,d.data)};
es.onerror=()=>{if(s.connected){s.connected=false;s.id=null;fire('disconnect')}};
window.__sock=s;return s}})();`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.bin': 'application/octet-stream', '.css': 'text/css', '.svg': 'image/svg+xml' };
function app(req, res) {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/socket.io/socket.io.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(CLIENT) }
  if (u.pathname === '/_b/stream') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    const s = new Sock(res); socks.set(s.id, s); s.send({ t: 'hello', sid: s.id }); IO.h.connection(s);
    req.on('close', () => { socks.delete(s.id); s.h.disconnect && s.h.disconnect() }); return;
  }
  if (u.pathname === '/_b/emit') {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      res.end('ok'); let m; try { m = JSON.parse(body) } catch (e) { return }
      const s = socks.get(m.sid); if (!s || !s.h[m.ev]) return;
      const args = m.args || []; if (m.n) args.push(r => s.send({ t: 'ack', n: m.n, r }));
      try { s.h[m.ev](...args) } catch (e) { console.error('handler error', m.ev, e) }
    }); return;
  }
  if (u.pathname === '/_b/kill') { const id = u.searchParams.get('sid'); const s = socks.get(id); if (s) { try { s.res.end() } catch (e) { } } return res.end('ok') }
  let p = path.join(ROOT, 'public', decodeURIComponent(u.pathname)); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end() } res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d) });
}
Module._load = function (r, ...a) {
  if (r === 'express') { const f = () => ({ use() { } }); f.static = () => 0; return f }
  if (r === 'socket.io') return { Server: FakeIO };
  if (r === 'http') { const h = orig.call(this, r, ...a); return { ...h, createServer: () => h.createServer(app) } }
  return orig.call(this, r, ...a)
};
require(path.join(ROOT, 'server.js'));
