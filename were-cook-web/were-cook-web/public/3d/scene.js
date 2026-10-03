/* We're CooK? — the 3D kitchen built from KayKit Restaurant Bits.
   Kitchen (stations) is around x=0, the serving/plate counter is around x=20.
   Every station is a "group" of objects; the page puts an HTML button on top of each group. */
(function (root) {
  'use strict';
  const GREY = [.62, .6, .66, .92], STONE = [.62, .6, .66, .88], BAMBOO = [.92, .7, .42, .7], STEEL = [.75, .78, .85, .55], WOOD = [.62, .42, .26, .9];
  function buildKitchen(k) {
    const G = {};               // groups: id -> [instances]
    const D = {}, T = {};       // D: decoration food on each station (hidden while cooking) · T: tool parts that move
    const add = (g, name, pos, rot = 0, s = 1, opt) => { const it = k.add(name, pos, rot, s, opt); if (it && g) (G[g] = G[g] || []).push(it); if (it && g && opt && opt.deco) (D[g] = D[g] || []).push(it); return it };
    const deco = { deco: true };
    /* ---------- room ---------- */
    for (let x = -12; x <= 28; x += 4) for (let z = -6; z <= 10; z += 4) add(null, 'floor_kitchen', [x + 2, -.5, z + 2]);
    const walls = { '-10': 'wall', '-6': 'wall_window_open', '-2': 'wall', '2': 'wall', '6': 'wall_window_open', '10': 'wall', '14': 'wall', '18': 'wall_orderwindow_decorated', '22': 'wall', '26': 'wall_window_closed' };
    for (const [x, w] of Object.entries(walls)) add(null, w, [+x, 0, -6.25]);
    add(null, 'pillar_A', [12, 0, -6]);
    /* ---------- back row along the wall (z = -5) ---------- */
    add(null, 'fridge_A_decorated', [-8, 0, -5]);
    add('knife', 'kitchencounter_straight_A_backsplash', [-6, 0, -5]);
    add('knife', 'cuttingboard', [-6, 1, -4.7], 10);
    T.knife = k.live(add('knife', 'knife', [-5.6, 1.15, -4.6]));
    add('knife', 'food_ingredient_tomato', [-6.35, 1.15, -4.75], 0, .7, deco);
    add('knife', 'food_ingredient_onion', [-5.75, 1.15, -4.95], 0, .7, deco);
    add(null, 'kitchencounter_straight_B_backsplash', [-4, 0, -5]);
    add(null, 'jar_A_large', [-4.5, 1, -5.3]); add(null, 'jar_B_medium', [-3.9, 1, -5.4]); add(null, 'jar_C_small', [-3.4, 1, -5.2]);
    add('pan', 'stove_single', [-2, 0, -5]);
    T.pan = k.live(add('pan', 'pan_A', [-2, 1.2, -5.1], 200));
    add('pan', 'food_ingredient_ham_cooked', [-2, 1.3, -5.1], 0, .55, deco);
    add(null, 'extractorhood', [-2, 0, -6]);
    add(null, 'kitchencounter_straight_B_backsplash', [0, 0, -5]); add(null, 'papertowel', [-.3, 1, -5.3]); add(null, 'jar_D_medium', [.4, 1, -5.2]);
    add('pot', 'stove_single', [2, 0, -5]);
    add('pot', 'pot_A', [2, 1.2, -5]);
    T.potWater = add('pot', 'water_disc', [2, 1.55, -5], 0, 1.05, { tint: [.55, .78, .95, .6] });
    add(null, 'extractorhood', [2, 0, -6]);
    add(null, 'kitchencounter_straight_A_backsplash', [4, 0, -5]);
    add(null, 'crate_buns', [4, 1, -5.1], 0, .45);
    T.oven = add('oven', 'oven', [6, 0, -5]);
    add(null, 'kitchencounter_straight_A_backsplash', [8, 0, -5]);
    add(null, 'shelf_papertowel_decorated', [8, 2.2, -5.95]);
    add(null, 'kitchencabinet', [-6, 0, -6]); add(null, 'kitchencabinet_half', [-4, 0, -6]); add(null, 'kitchencabinet', [4, 0, -6]); add(null, 'kitchencabinet', [8, 0, -6]);
    /* ---------- island (z = 0) ---------- */
    // Thai stations: our own models (WereCooK_3D_models/procedural, CC0)
    add('mortar', 'kitchentable_A', [-6, 0, 0]);
    T.mortar = k.live(add('mortar', 'mortar_bowl', [-6, 1, 0], 15, 1.25));
    T.pestle = k.live(add('mortar', 'pestle', [-5.75, 1.3, -.05], 0, 1.25)); T.pestle.rz = -.45;
    add('mortar', 'chili', [-6.75, 1, .7], 30, .55, deco); add('mortar', 'garlic', [-5.2, 1, .65], 0, .5, deco);
    add('fryer', 'kitchentable_A', [-2, 0, 0]);
    add('fryer', 'fryer_body', [-2, 1, 0], 0, 1.25);
    T.oil = add('fryer', 'water_disc', [-2, 1.6, 0], 0, 1.2, { tint: [.95, .7, .25, .75] });
    T.basket = k.live(add('fryer', 'basket', [-2, 1.62, 0], 0, 1.25));
    add('fryer', 'fries', [-1.3, 1, .65], 0, .5, deco);
    add('grill', 'kitchentable_B', [2, 0, 0]);
    add('grill', 'anglo', [2, 1, 0], 0, 1.45);
    add('grill', 'pork_skewer', [2.85, 1, .7], 20, .55, deco);
    add('steamer', 'kitchentable_A', [6, 0, 0]);
    add('steamer', 'steamer_body', [6, 1, 0], 0, 1.4);
    T.lid = k.live(add('steamer', 'steam_lid', [6, 1, 0], 0, 1.4));
    add('steamer', 'sticky_raw', [6.75, 1, .7], 0, .5, deco);
    /* ingredient crates along the front, like a market stall */
    for (const [x, items] of [[-7, [['shrimp_raw', .5]]], [-5, [['egg_raw', .32], ['egg_raw', .32], ['egg_raw', .32]]], [-3, [['chili', .45], ['chili', .45]]], [-1, [['basil', .6]]], [1, [['papaya', .38], ['lime', .35]]], [3, [['mango', .45], ['mango', .45]]], [5, [['garlic', .4], ['garlic', .4]]], [7, [['food_ingredient_tomato', .45], ['food_ingredient_tomato', .45]]]]) {
      add(null, 'crate', [x, 0, 4.3], 0, .85);
      items.forEach(([n, sc], i) => add(null, n, [x - .35 + i * (items.length > 1 ? .7 / (items.length - 1) : 0) + (items.length === 1 ? .35 : 0), .35, 4.3 + (i % 2 ? .15 : -.1)], i * 40 + 10, sc));
    }
    /* ---------- serving side (x = 20) ---------- */
    add('sink', 'kitchencounter_sink_backsplash', [15, 0, -5]);
    add('sink', 'kitchencounter_straight_A_backsplash', [17, 0, -5]);
    add('sink', 'dishrack_plates', [17, 1, -5.1]);
    add('season', 'kitchencounter_straight_A_backsplash', [19, 0, -5]);
    add('season', 'kitchencounter_straight_A_backsplash', [21, 0, -5]);
    for (const [n, x, z] of [['b_fish', 18.3, -5.1], ['b_oyster', 18.9, -5.3], ['b_salt', 19.5, -5.0], ['b_sugar', 20.15, -5.25], ['b_lime', 20.8, -5.0], ['b_chili', 21.4, -5.25], ['ketchup', 21.9, -4.85]]) add('season', n, [x, 1, z], 0, 1.25);
    add(null, 'kitchencounter_straight_B_backsplash', [23, 0, -5]); add(null, 'sticky_basket', [22.7, 1, -5], 0, 1); add(null, 'rice_bowl', [23.5, 1, -4.7], 0, .9); add(null, 'coconut_bowl', [23.3, 1, -5.5], 0, .8);
    add('plate', 'kitchentable_A_large', [20, 0, -1.5]);
    const plate = add('plate', 'plate', [20, 1, -1.4], 0, 2.6);
    add(null, 'plate', [21.9, 1, -2.1], 0, 1); add(null, 'plate', [21.9, 1.1, -2.1], 0, 1); add(null, 'plate', [21.9, 1.2, -2.1], 0, 1);
    add(null, 'menu', [18.2, 1, -2.2], 20);
    add(null, 'kitchencabinet', [24, 0, -6]); add(null, 'kitchencabinet', [16, 0, -6]); add(null, 'kitchencabinet', [20, 0, -6]);
    /* ---------- dining room in front (seen in the lobby) ---------- */
    add(null, 'table_round_A_decorated', [-3, 0, 7]); add(null, 'table_round_A_small_decorated', [5, 0, 7.5]); add(null, 'table_round_A_decorated', [16, 0, 7]);
    for (const [x, z, r] of [[-5, 7, 90], [-1, 7, -90], [-3, 9, 180], [-3, 5, 0], [14, 7, 90], [18, 7, -90], [16, 9, 180]]) add(null, 'chair_A', [x, 0, z], r);
    add(null, 'chair_stool', [3.6, 0, 7.5]); add(null, 'chair_stool', [6.4, 0, 7.5]);
    // what a plate item looks like in 3D: [model, cooked-look tint?]
    const COOK = [1, .72, .48, .32], BURNT = [.36, .26, .22, .82];
    const M = {
      pork: { raw: 'pork', chopped: 'pork_minced', sauteed: ['pork_minced', COOK], grilled: 'pork_skewer' },
      chicken: { raw: 'food_ingredient_ham', deepfried: 'food_ingredient_ham_cooked', grilled: 'food_ingredient_ham_cooked', burnt: 'food_ingredient_ham_trash' },
      fish: { raw: 'fish', steamed: ['fish', [1, .95, .9, .25]] }, shrimp: { raw: 'shrimp_raw', '*': 'shrimp' },
      eggraw: { raw: 'egg_raw', sauteed: 'egg_sunny', deepfried: 'egg_fried', burnt: 'egg_burnt' },
      patty: { raw: 'food_ingredient_burger_uncooked', sauteed: 'food_ingredient_burger_cooked', burnt: 'food_ingredient_burger_trash' },
      bacon: { raw: 'bacon', sauteed: ['bacon', COOK] }, sausage: { raw: 'sausage', '*': ['sausage', COOK] }, steak: { raw: 'food_ingredient_steak', '*': ['food_ingredient_steak', [.75, .45, .3, .55]] },
      salmon: { raw: 'salmon', '*': ['salmon', COOK] }, rice: { '*': 'rice_bowl' }, sticky: { raw: 'sticky_raw', steamed: 'sticky_basket' },
      bun: { '*': 'food_ingredient_bun' }, hbun: { '*': 'hbun' }, toast: { raw: 'toast', baked: ['toast', COOK] }, tortilla: { '*': 'tortilla' },
      pasta: { raw: 'pasta_raw', boiled: 'pasta_boiled' },
      potato: { raw: 'food_ingredient_potato', chopped: 'food_ingredient_potato_chopped', fries: 'fries', boiled: 'potato_boiled', mashed: 'food_ingredient_potato_mashed' },
      pizza: { raw: 'pizza_raw', baked: 'pizza_baked' }, croissant: { raw: ['croissant', [1, .95, .85, .3]], baked: 'croissant' }, donut: { raw: 'donut', deepfried: 'donut_fried' },
      chili: { raw: 'chili', chopped: 'chili_sliced', mashed: 'paste_red' }, garlic: { raw: 'garlic', chopped: 'garlic_chopped', mashed: 'paste_cream' }, basil: { '*': 'basil' },
      papaya: { raw: 'papaya', chopped: 'papaya_shredded', somtam: 'somtam' },
      tomato: { raw: 'food_ingredient_tomato', chopped: 'food_ingredient_tomato_slices', mashed: 'tomato_sauce' },
      mushroom: { raw: 'mushroom', chopped: 'mushroom_sliced', sauteed: ['mushroom_sliced', COOK], boiled: 'mushroom' },
      lettuce: { raw: 'food_ingredient_lettuce', chopped: 'food_ingredient_lettuce_chopped' }, onion: { raw: 'food_ingredient_onion', chopped: 'food_ingredient_onion_rings' },
      avocado: { raw: 'avocado', mashed: 'paste_green' }, mango: { raw: 'mango', chopped: 'mango_cubes' }, pineapple: { '*': 'pineapple' },
      coconut: { '*': 'coconut_bowl' }, cheese: { '*': 'food_ingredient_cheese_slice' }, mozzarella: { '*': 'mozzarella' }, butter: { '*': 'butter' }, icecream: { '*': 'icecream' },
      pepperoni: { '*': 'pepperoni' }, ketchup: { '*': 'ketchup' }, mustard: { '*': 'mustard' }, mayo: { '*': 'mayo' },
    };
    const COOKED = ['sauteed', 'deepfried', 'fries', 'baked', 'grilled'];
    function modelFor(it) {
      const m = M[it.ing]; if (!m) return null; const burnt = it.q < 45 && COOKED.includes(it.st);
      let v = (burnt && m.burnt) || m[it.st] || m['*'] || m.raw; let tint = null;
      if (Array.isArray(v)) { tint = v[1]; v = v[0] }
      if (burnt && !m.burnt) tint = BURNT;
      return k.has(v) ? { name: v, tint } : null;
    }
    // put what's on the plate onto the 3D plate (first item in the middle, the rest around it)
    let onPlate = [];
    function setPlate(items, boost = 1) {
      onPlate.forEach(it => k.remove(it)); onPlate = [];
      const n = items.length, c = plate.pos;
      items.forEach((item, i) => {
        const md = modelFor(item); if (!md) return; const mm = k.models[md.name];
        const size = Math.max(mm.max[0] - mm.min[0], mm.max[2] - mm.min[2], (mm.max[1] - mm.min[1]) * .8) || 1;
        const sc = Math.min(1.3 * boost, (n === 1 ? 1.05 : i === 0 ? .85 : .7) * boost / size);
        const a = n === 1 || i === 0 ? 0 : (i - 1) / (n - 1) * Math.PI * 2 + Math.PI / 2, r = n === 1 || i === 0 ? 0 : .72;
        const it = k.add(md.name, [c[0] + Math.cos(a) * r, c[1] + .12 - mm.min[1] * sc, c[2] + Math.sin(a) * r * .8], i * 37 - 20, sc, md.tint ? { tint: md.tint } : {});
        if (it) onPlate.push(it);
      });
    }
    /* ---------- cooking in 3D: the mini-games tell us what happens, we animate it ---------- */
    // where the food sits on each station, how big it is, and where the heat/steam comes from
    const SPOT = {
      knife: { p: [-6.05, 1.16, -4.65], size: .55 }, mortar: { p: [-6, 1.62, 0], size: .5 }, pan: { p: [-2, 1.3, -4.95], size: .5, fire: [-2, 1.12, -5.05] },
      fryer: { p: [-2, 1.68, 0], size: .45 }, pot: { p: [2, 1.56, -5], size: .4, fire: [2, 1.12, -5] }, oven: { p: [6, 1.6, -3.55], size: .5 },
      grill: { p: [2, 2.08, 0], size: .55, fire: [2, 1.55, 0] }, steamer: { p: [6, 1.75, 0], size: .5 },
    };
    const lerp = (a, b, t) => a + (b - a) * t, R = (a, b) => a + Math.random() * (b - a);
    const cook = { tool: null, food: null, st: {}, base: {}, t: 0, acc: {} };
    const rest = it => it && { pos: it.pos.slice(), rx: it.rx || 0, ry: it.ry, rz: it.rz || 0, sy: it.sy || 1 };
    const back = (it, b) => { if (it && b) { it.pos = b.pos.slice(); it.rx = b.rx; it.ry = b.ry; it.rz = b.rz; it.sy = b.sy } };
    const fx = (pos, o) => k.burst({ pos: [pos[0] + R(-.15, .15), pos[1], pos[2] + R(-.15, .15)], ...o });
    const flame = (c, n = 1) => { for (let i = 0; i < n; i++) fx([c[0] + R(-.25, .25), c[1], c[2] + R(-.2, .2)], { vel: [0, R(.8, 1.4), 0], life: R(.35, .55), size0: R(.11, .17), size1: .02, color: Math.random() < .5 ? [1, .55, .15] : [1, .85, .3], emit: .9 }) };
    const steam = (c, big) => fx(c, { vel: [R(-.1, .1), R(.6, 1), R(-.1, .1)], life: R(.9, 1.4), size0: big ? .18 : .11, size1: big ? .45 : .3, color: [1, 1, 1], emit: .35, drag: .4 });
    const smoke = c => fx(c, { vel: [R(-.1, .1), R(.5, .8), R(-.1, .1)], life: R(1.1, 1.6), size0: .15, size1: .45, color: [.32, .3, .32], drag: .3 });
    const bubble = (c, col, r = .3) => k.burst({ pos: [c[0] + R(-r, r), c[1], c[2] + R(-r * .8, r * .8)], vel: [0, R(.15, .35), 0], life: R(.25, .45), size0: R(.06, .1), size1: .03, color: col, emit: .25 });
    const crumbs = (c, col, n = 6) => { for (let i = 0; i < n; i++) k.burst({ pos: c.slice(), vel: [R(-1, 1), R(1, 2), R(-.6, .9)], life: R(.4, .7), size0: R(.06, .1), size1: .03, color: col, grav: 6 }) };
    const toolsOf = id => ({ knife: [T.knife], mortar: [T.mortar, T.pestle], pan: [T.pan], fryer: [T.basket], steamer: [T.lid] })[id] || [];
    const FOOD_COL = { chili: [.85, .15, .12], garlic: [.95, .92, .85], avocado: [.6, .78, .3], tomato: [.9, .2, .15], potato: [.95, .85, .55], papaya: [.75, .85, .45], pork: [.95, .65, .65], mango: [1, .8, .2] };
    // start cooking: hide the decorations, put the real ingredient on the station
    function start(tool, item) {
      end(); const sp = SPOT[tool]; if (!sp) return; cook.tool = tool; cook.item = item; cook.st = { done: 0, burn: 0, heat: .3, down: false, level: .3, water: 1, open: false };
      (D[tool] || []).forEach(it => it.hidden = true); toolsOf(tool).forEach(it => cook.base[it.name + tool] = rest(it));
      const md = modelFor(item); if (md) { const mm = k.models[md.name]; const size = Math.max(mm.max[0] - mm.min[0], mm.max[2] - mm.min[2], mm.max[1] - mm.min[1]) || 1;
        const sc = sp.size / size; cook.food = k.live(k.add(md.name, [sp.p[0], sp.p[1] - mm.min[1] * sc, sp.p[2]], -20, sc, md.tint ? { tint: md.tint } : {})); cook.food.baseTint = cook.food.tint.slice(); cook.food.y0 = cook.food.pos[1]; cook.food.s0 = sc;
        if (tool === 'oven' || tool === 'steamer') cook.food.hidden = true }
      if (T.oven) T.oven.glow = [0, 0, 0];
    }
    function end() {
      if (!cook.tool) return; const tool = cook.tool; (D[tool] || []).forEach(it => it.hidden = false);
      toolsOf(tool).forEach(it => back(it, cook.base[it.name + tool])); if (cook.food) k.remove(cook.food);
      if (T.oven) T.oven.glow = [0, 0, 0]; if (T.oil) T.oil.tint = [.95, .7, .25, .75]; cook.tool = null; cook.food = null; cook.anim = null;
    }
    // one-off actions: chop / pound / mix / toss / flip / dip / lift / water / open
    function hit(kind) {
      if (!cook.tool) return; const sp = SPOT[cook.tool], f = cook.food, now = cook.t;
      cook.anim = { kind, t0: now };
      const col = FOOD_COL[cook.item && cook.item.ing] || [.9, .8, .6];
      if (kind === 'chop') { crumbs([sp.p[0] + .1, sp.p[1] + .15, sp.p[2] + .1], col, 5); if (f) { f.sx = Math.max(.45, (f.sx || 1) - .15) } }
      if (kind === 'pound' || kind === 'mix') crumbs([sp.p[0], sp.p[1] + .3, sp.p[2]], col, kind === 'pound' ? 5 : 3);
      if (kind === 'toss') { for (let i = 0; i < 3; i++) flame(sp.fire, 2) }
      if (kind === 'water') for (let i = 0; i < 6; i++) bubble([sp.p[0], sp.p[1] - .25, sp.p[2]], [.7, .88, 1], .35);
      if (kind === 'open' && f) { f.hidden = false; for (let i = 0; i < 10; i++) steam([sp.p[0], sp.p[1] + .4, sp.p[2]], true) }
      if (kind === 'flip') crumbs([sp.p[0], sp.p[1] + .1, sp.p[2]], [1, .6, .2], 4);
    }
    function set(o) { if (cook.tool) Object.assign(cook.st, o) }
    // every frame: the look follows the mini-game state
    k.tickers = k.tickers || []; k.tickers.push(dt => {
      cook.t += dt; if (!cook.tool) return; const tool = cook.tool, st = cook.st, sp = SPOT[tool], f = cook.food, a = cook.anim, at = a ? cook.t - a.t0 : 9;
      const acc = (key, every) => { cook.acc[key] = (cook.acc[key] || 0) + dt; if (cook.acc[key] >= every) { cook.acc[key] = 0; return true } return false };
      // doneness -> colour (raw -> golden -> burnt)
      if (f && ['pan', 'fryer', 'grill', 'oven'].includes(tool)) { const d = Math.min(1, st.done), b = Math.min(1, st.burn); const base = f.baseTint;
        const cooked = [1, .72, .45, .35 * d], burnt = [.3, .22, .2, .85];
        f.tint = b > 0 ? cooked.map((v, i) => lerp(v, burnt[i], b)) : base[3] ? base.map((v, i) => lerp(v, cooked[i], d)) : cooked }
      if (tool === 'knife') { const kn = T.knife, b = cook.base[kn.name + tool]; const y = at < .18 ? Math.sin(at / .18 * Math.PI) : 0;
        kn.pos = [sp.p[0] + .35, sp.p[1] + .25 - y * .22, sp.p[2] + .05]; kn.rz = -1.2 + y * .5; kn.ry = 0 }
      if (tool === 'mortar') { const pe = T.pestle, b = cook.base[pe.name + tool]; const y = at < .14 ? Math.sin(at / .14 * Math.PI) : 0;
        if (a && a.kind === 'mix' && at < .3) { pe.ry = b.ry + Math.sin(at / .3 * Math.PI * 2) * .8; if (f) { f.pos[1] = f.y0 + Math.sin(at / .3 * Math.PI) * .25; f.ry += dt * 9 } }
        pe.pos = [b.pos[0] - y * .18, b.pos[1] - y * .25, b.pos[2]]; pe.rz = b.rz + y * .3;
        T.mortar.sy = 1 - y * .06; if (f) { f.sy = Math.max(.35, 1 - st.done * .65) * (1 - y * .25) } }
      if (tool === 'pan') { const pan = T.pan, b = cook.base[pan.name + tool]; const k2 = a && a.kind === 'toss' && at < .45 ? at / .45 : 1;
        pan.rx = Math.sin(k2 * Math.PI) * -.18; pan.pos = [b.pos[0], b.pos[1] + Math.sin(k2 * Math.PI) * .08, b.pos[2]];
        if (f) { f.pos[1] = f.y0 + Math.sin(k2 * Math.PI) * .7; f.rx = k2 < 1 ? k2 * Math.PI * 2 : 0 }
        if (acc('fl', .06 / Math.max(.2, st.heat))) flame(sp.fire, 1); if (st.heat > .8 && acc('sm', .12)) smoke([sp.p[0], sp.p[1] + .2, sp.p[2]]); else if (acc('st', .35)) steam([sp.p[0], sp.p[1] + .1, sp.p[2]]) }
      if (tool === 'fryer') { const bk = T.basket, b = cook.base[bk.name + tool]; const ty = st.down ? b.pos[1] - .38 : b.pos[1]; bk.pos[1] = lerp(bk.pos[1], ty, Math.min(1, dt * 10));
        if (f) { f.pos[1] = bk.pos[1] - b.pos[1] + f.y0 } T.oil.tint = st.down ? [1, .78, .3, .7] : [.95, .7, .25, .75];
        if (st.down && acc('bb', .04)) bubble([sp.p[0], 1.62, sp.p[2]], [1, .9, .55], .45); if (st.down && st.done > .85 && acc('sm', .15)) smoke([sp.p[0], 1.8, sp.p[2]]) }
      if (tool === 'pot') { const lv = st.level; if (acc('fl', .1 / (.3 + st.heat))) flame(sp.fire, 1);
        if (acc('bb', Math.max(.03, .3 - lv * .3))) bubble([sp.p[0], 1.57, sp.p[2]], [.85, .95, 1], .45); if (lv > .5 && acc('st', .25)) steam([sp.p[0], 1.75, sp.p[2]], lv > .85);
        if (f) { f.pos[1] = f.y0 + Math.sin(cook.t * 4) * .03; f.ry += dt * .8 } }
      if (tool === 'oven') { const d = Math.min(1.2, st.done); T.oven.glow = [.25 + d * .25, .1 + d * .06, 0]; if (st.done > .9 && acc('sm', .2)) smoke([sp.p[0], 2.1, sp.p[2] - .4]) }
      if (tool === 'grill') { if (acc('em', .07)) flame(sp.fire, 1); if (acc('sm', st.burn > 0 ? .08 : .3)) (st.burn > 0 ? smoke : steam)([sp.p[0], sp.p[1] + .15, sp.p[2]]);
        if (f) { const k2 = a && a.kind === 'flip' && at < .38 ? at / .38 : 1; f.pos[1] = f.y0 + Math.sin(k2 * Math.PI) * .5; f.rx = (st.side ? Math.PI : 0) + (k2 < 1 ? -Math.PI * (1 - k2) : 0) } }
      if (tool === 'steamer') { const lid = T.lid, b = cook.base[lid.name + tool]; const open = st.open ? 1 : 0; lid.pos[1] = lerp(lid.pos[1], b.pos[1] + open * .7, Math.min(1, dt * 8)); lid.rz = lerp(lid.rz, open * .35, Math.min(1, dt * 8));
        if (st.water > .18 && acc('st', .12)) steam([sp.p[0] + R(-.3, .3), 2.4, sp.p[2]]); if (st.water <= .18 && acc('sm', .3)) smoke([sp.p[0], 1.3, sp.p[2]]) }
    });
    return {
      groups: G, plate, setPlate, modelFor, cook: { start, end, hit, set, spot: id => SPOT[id] },
      shots: {
        kitchen: { eye: [0, 11.5, 10.5], target: [0, .6, -2.4], fov: 34, minW: 19 },
        plate: { eye: [20.6, 10, 8.5], target: [20.6, .8, -2.6], fov: 34, minW: 13 },
        lobby: { eye: [6, 9, 18], target: [6, 1, -1], fov: 40 },
        // close-up of one station; side>0 leaves room on the right for the mini-game card
        station: (id, side = 0, lift = 0) => { const g = G[id]; if (!g) return null; const p = g[0].pos; return { eye: [p[0] + side, p[1] + 5.2 - lift, p[2] + 6.4], target: [p[0] + side, p[1] + 1.1 - lift, p[2]], fov: 30, minW: 5.5 } },
      },
    };
  }
  root.buildKitchen = buildKitchen;
})(typeof self !== 'undefined' ? self : this);
