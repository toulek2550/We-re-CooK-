/* We're CooK? — tiny WebGL2 renderer for the KayKit "Restaurant Bits" models (CC0, Kay Lousberg).
   No libraries: loads kit.json + kit.bin (packed by tools/pack_kaykit.py) + the shared texture,
   draws instances with soft sun shadows, and tells the page where each object is on screen
   (so HTML buttons can sit on top of 3D objects and act as click / drop targets). */
(function (root) {
  'use strict';
  /* ---------- tiny matrix library (column-major, like WebGL) ---------- */
  const M4 = {
    ident: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    mul(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s } return o },
    persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0] },
    ortho(l, r, b, t, n, f) { return [2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1] },
    lookAt(e, c, u) {
      let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z = z.map(v => v / l);
      let x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x = x.map(v => v / l);
      const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
      return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1];
    },
    // full transform: position, rotations (radians, applied Z then X then Y), per-axis scale
    full(p, rx, ry, rz, sx, sy, sz) {
      const cx = Math.cos(rx), sxn = Math.sin(rx), cy = Math.cos(ry), syn = Math.sin(ry), cz = Math.cos(rz), szn = Math.sin(rz);
      const Rz = [cz, szn, 0, 0, -szn, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], Rx = [1, 0, 0, 0, 0, cx, sxn, 0, 0, -sxn, cx, 0, 0, 0, 0, 1], Ry = [cy, 0, -syn, 0, 0, 1, 0, 0, syn, 0, cy, 0, 0, 0, 0, 1];
      const S = [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1]; const m = M4.mul(Ry, M4.mul(Rx, M4.mul(Rz, S))); m[12] = p[0]; m[13] = p[1]; m[14] = p[2]; return m;
    },
    model(p, ry, s) { const c = Math.cos(ry), n = Math.sin(ry); return [c * s, 0, -n * s, 0, 0, s, 0, 0, n * s, 0, c * s, 0, p[0], p[1], p[2], 1] },
    xf(m, v) { const x = v[0], y = v[1], z = v[2]; return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14], m[3] * x + m[7] * y + m[11] * z + m[15]] },
  };
  const lerp = (a, b, t) => a + (b - a) * t; const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec2 aT; layout(location=3) in vec4 aC;
uniform mat4 uVP, uM, uLVP; out vec3 vN; out vec2 vT; out vec4 vL; out vec3 vW; out vec3 vC;
void main(){ vec4 w = uM*vec4(aP,1.); vW=w.xyz; vN=mat3(uM)*aN; vT=aT; vC=aC.rgb; vL=uLVP*w; gl_Position=uVP*w; }`;
  const FS = `#version 300 es
precision highp float; precision highp sampler2DShadow;
uniform sampler2D uTex; uniform sampler2DShadow uShadow; uniform vec3 uLight, uEye, uGlow; uniform vec4 uTint; uniform float uSmap;
in vec3 vN; in vec2 vT; in vec4 vL; in vec3 vW; in vec3 vC; out vec4 o;
float shade(){ vec3 p=vL.xyz/vL.w*.5+.5; if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.) return 1.; float s=0.; vec2 ts=vec2(1./uSmap);
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) s+=texture(uShadow, vec3(p.xy+vec2(x,y)*ts*1.3, p.z-.0018)); return s/9.; }
void main(){
  // KayKit parts are textured; our own models (uv < 0) use a flat colour per part
  vec3 base = vT.x < -.5 ? pow(vC, vec3(2.2)) : pow(texture(uTex,vT).rgb, vec3(2.2)) * pow(vC, vec3(2.2)); vec3 n=normalize(vN);
  float d=max(dot(n,-uLight),0.); float sh=shade();
  vec3 amb=mix(vec3(.30,.24,.34), vec3(.62,.58,.56), n.y*.5+.5);
  vec3 c=base*(amb + vec3(1.05,.95,.82)*d*mix(.28,1.,sh));
  vec3 V=normalize(uEye-vW); c += base*pow(1.-max(dot(n,V),0.),3.)*.22;
  float g=dot(c,vec3(.3,.59,.11)); c=mix(c, g*uTint.rgb, uTint.a);
  c += uGlow; o=vec4(pow(c,vec3(1./2.2)),1.);
}`;
  const SVS = `#version 300 es
layout(location=0) in vec3 aP; uniform mat4 uLVP, uM; void main(){ gl_Position=uLVP*uM*vec4(aP,1.); }`;
  const SFS = `#version 300 es
precision mediump float; void main(){}`;

  function prog(gl, vs, fs) {
    const p = gl.createProgram();
    for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh) }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name) }
    return { p, u };
  }

  class Kit3D {
    constructor(canvas, opt = {}) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opt.preserve });
      if (!gl) throw new Error('no webgl2'); this.gl = gl;
      this.main = prog(gl, VS, FS); this.shadow = prog(gl, SVS, SFS);
      this.models = {}; this.inst = []; this.cam = { eye: [0, 10, 14], target: [0, 0, 0], fov: 32 }; this.tw = null;
      this.light = [-.45, -1, -.55]; const l = Math.hypot(...this.light); this.light = this.light.map(v => v / l);
      this.smap = opt.smap || 2048; this.dpr = Math.min(2, root.devicePixelRatio || 1); this.onFrame = null; this.t0 = performance.now(); this.running = false;
      // shadow map
      this.stex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.stex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, this.smap, this.smap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.sfb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.sfb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.stex, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    async load(base) {
      const gl = this.gl;
      const K = root.KIT_DATA;   // offline bundle (file://): everything embedded in kit-data.js
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('texture')); im.src = K ? K.tex : base + 'restaurantbits_texture.png' });
      const [man, bin] = K ? [K.json, Uint8Array.from(atob(K.bin), c => c.charCodeAt(0)).buffer] : await Promise.all([
        fetch(base + 'kit.json').then(r => { if (!r.ok) throw new Error('kit.json'); return r.json() }),
        fetch(base + 'kit.bin').then(r => { if (!r.ok) throw new Error('kit.bin'); return r.arrayBuffer() })]);
      this.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      for (const [name, e] of Object.entries(man.models)) {
        const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
        const buf = (data, loc, n) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0) };
        buf(new Float32Array(bin, e.p, e.v * 3), 0, 3); buf(new Float32Array(bin, e.n, e.v * 3), 1, 3); buf(new Float32Array(bin, e.t, e.v * 2), 2, 2);
        if (e.c != null) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(bin, e.c, e.v * 4), gl.STATIC_DRAW); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, 0, 0) }
        else gl.vertexAttrib4f(3, 1, 1, 1, 1);
        const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(bin, e.ix, e.i), gl.STATIC_DRAW);
        gl.bindVertexArray(null); this.models[name] = { vao, count: e.i, min: e.min, max: e.max };
      }
      return this;
    }
    has(name) { return !!this.models[name] }
    /* add an object: model name, position, y-rotation (degrees), scale, optional tag for hotspots */
    add(name, pos, rotDeg = 0, scale = 1, opt = {}) {
      const m = this.models[name]; if (!m) { console.warn('kit3d: no model', name); return null }
      const it = { name, m, pos: pos.slice(), ry: rotDeg * Math.PI / 180, s: scale, tint: opt.tint || [1, 1, 1, 0], baseTint: opt.tint || [1, 1, 1, 0], glow: [0, 0, 0], tag: opt.tag || null, hidden: false, bob: opt.bob || 0 };
      it.mat = M4.model(it.pos, it.ry, it.s); this.inst.push(it); return it;
    }
    move(it, pos, rotDeg, scale) { if (pos) it.pos = pos.slice(); if (rotDeg != null) it.ry = rotDeg * Math.PI / 180; if (scale != null) it.s = scale; it.mat = M4.model(it.pos, it.ry, it.s) }
    remove(it) { this.inst = this.inst.filter(x => x !== it) }
    /* "live" objects: anything can change pos / rx / ry / rz / s / sy every frame; call k.live(it) once */
    live(it) { it.rx = it.rx || 0; it.rz = it.rz || 0; it.live = true; return it }
    /* a model made in code: flat-shaded triangles, colour per vertex (uv = -1 means "no texture") */
    makeMesh(name, P, C) {
      const gl = this.gl, n = P.length / 3, N = new Float32Array(P.length), T = new Float32Array(n * 2).fill(-1);
      for (let i = 0; i < P.length; i += 9) {
        const a = [P[i + 3] - P[i], P[i + 4] - P[i + 1], P[i + 5] - P[i + 2]], b = [P[i + 6] - P[i], P[i + 7] - P[i + 1], P[i + 8] - P[i + 2]];
        let x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0]; const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
        for (let k = 0; k < 3; k++) { N[i + k * 3] = x; N[i + k * 3 + 1] = y; N[i + k * 3 + 2] = z }
      }
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const buf = (data, loc, sz, type = gl.FLOAT, norm = false) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, sz, type, norm, 0, 0) };
      buf(new Float32Array(P), 0, 3); buf(N, 1, 3); buf(T, 2, 2); buf(new Uint8Array(C), 3, 4, gl.UNSIGNED_BYTE, true);
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, Uint16Array.from({ length: n }, (_, i) => i), gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i + k]); mx[k] = Math.max(mx[k], P[i + k]) }
      this.models[name] = { vao, count: n, min: mn, max: mx };
    }
    /* a white low-poly ball (radius 1) used for particles: flames, steam, smoke, bubbles, crumbs */
    makeBlob() {
      const t = (1 + Math.sqrt(5)) / 2; let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v => { const l = Math.hypot(...v); return v.map(c => c / l) });
      const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
      const P = [], C = []; for (const f of F) for (const i of f) { P.push(...V[i]); C.push(255, 255, 255, 255) }
      this.makeMesh('_blob', P, C);
    }
    /* particles: { pos, vel, life (s), size0, size1, color [r,g,b], emit (0..1 self-glow), grav, drag } */
    burst(o) {
      if (!this.models._blob) this.makeBlob();
      const it = this.add('_blob', o.pos, 0, o.size0 || .1, { tint: [...(o.color || [1, 1, 1]), 1] }); if (!it) return;
      it.noShadow = true; it.p = { vel: (o.vel || [0, 0, 0]).slice(), life: o.life || 1, t: 0, s0: o.size0 || .1, s1: o.size1 == null ? 0 : o.size1, grav: o.grav || 0, drag: o.drag || 0, emit: o.emit || 0, col: o.color || [1, 1, 1] };
      (this.parts = this.parts || []).push(it);
    }
    clear() { this.inst = [] }
    /* camera */
    setCam(c) { this.tw = null; Object.assign(this.cam, { eye: c.eye.slice(), target: c.target.slice(), fov: c.fov || this.cam.fov, minW: c.minW || 0 }) }
    flyTo(c, ms = 700) { this.tw = { from: { eye: this.cam.eye.slice(), target: this.cam.target.slice(), fov: this.cam.fov, minW: this.cam.minW || 0 }, to: { eye: c.eye, target: c.target, fov: c.fov || this.cam.fov, minW: c.minW || 0 }, t: 0, ms } }
    resize() {
      const c = this.canvas, w = Math.max(1, Math.round(c.clientWidth * this.dpr)), h = Math.max(1, Math.round(c.clientHeight * this.dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
    }
    viewProj() {
      const c = this.canvas, asp = Math.max(.1, c.clientWidth / Math.max(1, c.clientHeight)); let fov = this.cam.fov * Math.PI / 180;
      // narrow screens (phones): widen the view so at least minW world units fit across at the target
      if (this.cam.minW) { const e = this.cam.eye, t = this.cam.target, d = Math.hypot(e[0] - t[0], e[1] - t[1], e[2] - t[2]); fov = Math.max(fov, 2 * Math.atan(this.cam.minW / 2 / (d * asp))) }
      return M4.mul(M4.persp(Math.min(fov, 1.6), asp, .5, 200), M4.lookAt(this.cam.eye, this.cam.target, [0, 1, 0]));
    }
    /* screen position (CSS px, relative to the canvas) of a world point */
    project(p, vp) { const v = M4.xf(vp || this.vp || this.viewProj(), p); if (v[3] <= 0) return null; return [(v[0] / v[3] + 1) / 2 * this.canvas.clientWidth, (1 - v[1] / v[3]) / 2 * this.canvas.clientHeight] }
    /* screen rectangle covering an object */
    rectOf(it, vp) {
      const { min, max } = it.m; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
        const w = M4.xf(it.mat, [x, y, z]); const s = this.project(w, vp); if (!s) continue; x0 = Math.min(x0, s[0]); y0 = Math.min(y0, s[1]); x1 = Math.max(x1, s[0]); y1 = Math.max(y1, s[1]);
      }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    lightVP() {
      // ortho light box around the camera target
      const t = this.cam.target, d = this.light, R = 22;
      const eye = [t[0] - d[0] * 30, t[1] - d[1] * 30, t[2] - d[2] * 30];
      return M4.mul(M4.ortho(-R, R, -R, R, 1, 70), M4.lookAt(eye, t, [0, 1, 0]));
    }
    render(now) {
      const gl = this.gl; if (gl.isContextLost()) return;
      const dt = this.last ? Math.min(.25, (now - this.last) / 1000) : 0; this.last = now;
      if (this.tw) { this.tw.t += dt * 1000 / this.tw.ms; const k = ease(Math.min(1, this.tw.t)); const a = this.tw.from, b = this.tw.to;
        this.cam.eye = lerp3(a.eye, b.eye, k); this.cam.target = lerp3(a.target, b.target, k); this.cam.fov = lerp(a.fov, b.fov, k); this.cam.minW = lerp(a.minW || 0, b.minW || 0, k); if (this.tw.t >= 1) this.tw = null }
      if (this.orbit && !this.tw) { const o = this.orbit; o.a += dt * o.speed; const ang = o.sway ? Math.sin(o.a) * o.sway : o.a; this.cam.eye = [o.c[0] + Math.sin(ang) * o.r, o.h, o.c[2] + Math.cos(ang) * o.r]; this.cam.target = o.c.slice() }
      this.resize(); const vp = this.vp = this.viewProj(); const lvp = this.lightVP(); const T = (now - this.t0) / 1000;
      if (this.tickers) for (const f of this.tickers) f(dt, T);
      if (this.parts && this.parts.length) {
        this.parts = this.parts.filter(it => { const p = it.p; p.t += dt; if (p.t >= p.life) { this.remove(it); return false }
          const f = p.t / p.life; p.vel[1] -= p.grav * dt; const d = Math.max(0, 1 - p.drag * dt); p.vel = p.vel.map(v => v * d);
          it.pos = [it.pos[0] + p.vel[0] * dt, it.pos[1] + p.vel[1] * dt, it.pos[2] + p.vel[2] * dt]; const sc = lerp(p.s0, p.s1, f);
          it.mat = M4.model(it.pos, it.ry + f * 2, sc); it.emit = p.emit ? p.col.map(c => c * p.emit * (1 - f * .6)) : null; return true });
      }
      for (const it of this.inst) if (it.live) it.mat = M4.full(it.pos, it.rx, it.ry, it.rz, it.s * (it.sx || 1), it.s * (it.sy || 1), it.s * (it.sz || 1));
      for (const it of this.inst) if (it.bob) { it.mat = M4.model([it.pos[0], it.pos[1] + Math.sin(T * 2 + it.pos[0]) * it.bob, it.pos[2]], it.ry + Math.sin(T * 1.3 + it.pos[2]) * .08, it.s) }
      // 1) shadow map
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
      const doShadow = !this.low || (this.sframe = ((this.sframe || 0) + 1) % 3) === 1;
      if (doShadow) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sfb); gl.viewport(0, 0, this.smap, this.smap); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.cullFace(gl.FRONT);
      gl.useProgram(this.shadow.p); gl.uniformMatrix4fv(this.shadow.u.uLVP, false, lvp);
      for (const it of this.inst) { if (it.hidden || it.noShadow) continue; gl.uniformMatrix4fv(this.shadow.u.uM, false, it.mat); gl.bindVertexArray(it.m.vao); gl.drawElements(gl.TRIANGLES, it.m.count, gl.UNSIGNED_SHORT, 0) }
      }
      // 2) the picture
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.canvas.width, this.canvas.height); gl.cullFace(gl.BACK);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const u = this.main.u; gl.useProgram(this.main.p);
      gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniformMatrix4fv(u.uLVP, false, lvp); gl.uniform3fv(u.uLight, this.light); gl.uniform3fv(u.uEye, this.cam.eye); gl.uniform1f(u.uSmap, this.smap);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.uniform1i(u.uTex, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.stex); gl.uniform1i(u.uShadow, 1);
      const pulse = .5 + .5 * Math.sin(T * 6);
      for (const it of this.inst) {
        if (it.hidden) continue;
        gl.uniformMatrix4fv(u.uM, false, it.mat); gl.uniform4fv(u.uTint, it.tint);
        const g = it.glow; if (it.emit) gl.uniform3fv(u.uGlow, it.emit); else gl.uniform3f(u.uGlow, g[0] * (.35 + .65 * pulse), g[1] * (.35 + .65 * pulse), g[2] * (.35 + .65 * pulse));
        gl.bindVertexArray(it.m.vao); gl.drawElements(gl.TRIANGLES, it.m.count, gl.UNSIGNED_SHORT, 0);
      }
      gl.bindVertexArray(null);
      if (this.onFrame) this.onFrame(vp, dt);
    }
    // low = "light graphics": 1x resolution, ~30 fps, shadows redrawn every 3rd frame
    setLow(v) { this.low = !!v; this.dpr = v ? 1 : Math.min(2, root.devicePixelRatio || 1); this.sframe = 0 }
    start() { if (this.running) return; this.running = true; let lastDraw = 0;
      const f = t => { if (!this.running) return; requestAnimationFrame(f);
        if (this.low && t - lastDraw < 31) return;
        const gap = lastDraw ? t - lastDraw : 16; lastDraw = t; this.frames = (this.frames || 0) + 1; this.fps = this.fps ? this.fps * .9 + (1000 / Math.max(1, gap)) * .1 : 60;
        try { this.render(t) } catch (e) { console.error(e); this.running = false } };
      requestAnimationFrame(f) }
    stop() { this.running = false }
  }
  Kit3D.M4 = M4;
  root.Kit3D = Kit3D;
})(typeof self !== 'undefined' ? self : this);
