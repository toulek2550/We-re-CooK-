/* We're CooK? — shared game engine (runs the SAME code in the browser and on the server)
   - Recipe data: ingredients, amounts, cooking transforms, menus
   - Taste engine: sweet / salty / sour / spicy / umami
   - Scoring: Recipe 40 + Technique 25 + Taste 20 + Time 15 = 100
   - Game instance: tickets, serving, washing — the server uses it as the referee,
     offline mode runs it inside the browser.                                   */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WCEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const clamp01 = v => Math.max(0, Math.min(1, Number.isFinite(v) ? v : .5));

  /* ---------- taste ---------- */
  // sw = หวาน, sa = เค็ม, so = เปรี้ยว, sp = เผ็ด, um = อูมามิ (0–100 each)
  const TASTE = [['sw', 'หวาน', '#FF7FA8'], ['sa', 'เค็ม', '#5AA9F0'], ['so', 'เปรี้ยว', '#9CCB3B'], ['sp', 'เผ็ด', '#FF5A4E'], ['um', 'อูมามิ', '#E0A412']];
  const TK = TASTE.map(t => t[0]);

  /* ---------- ingredients ----------
     th: Thai name, cat: drawer group, u: unit, opts: amounts you can pick, d: default amount,
     t: taste added at the DEFAULT amount (scales linearly with the amount)            */
  const I = (th, cat, u, opts, d, t) => ({ th, cat, u, opts, d, t });
  const ING = {
    // meat & eggs
    pork: I('หมู', 'meat', 'g', [100, 150, 200], 150, { um: 22, sa: 2 }),
    chicken: I('น่องไก่', 'meat', 'ชิ้น', [1, 2], 1, { um: 18, sa: 3 }),
    fish: I('ปลากะพง', 'meat', 'ตัว', [1], 1, { um: 20, sa: 2 }),
    shrimp: I('กุ้งสด', 'meat', 'ตัว', [3, 5, 7], 5, { um: 16, sw: 4, sa: 4 }),
    eggraw: I('ไข่ไก่', 'meat', 'ฟอง', [1, 2], 1, { um: 8, sa: 2 }),
    patty: I('เนื้อบด', 'meat', 'g', [100, 150, 200], 150, { um: 22, sa: 4 }),
    bacon: I('เบคอน', 'meat', 'ชิ้น', [1, 2, 3, 4], 2, { sa: 14, um: 10 }),
    sausage: I('ไส้กรอก', 'meat', 'ชิ้น', [1, 2], 1, { sa: 10, um: 10 }),
    steak: I('สเต๊กเนื้อ', 'meat', 'g', [150, 200, 250], 200, { um: 26, sa: 2 }),
    salmon: I('แซลมอน', 'meat', 'g', [100, 150, 200], 150, { um: 18, sa: 4 }),
    tofu: I('เต้าหู้', 'meat', 'ก้อน', [1], 1, { um: 4 }),
    // rice, bread, dough
    rice: I('ข้าวสวย', 'carb', 'จาน', [1], 1, { sw: 6 }),
    sticky: I('ข้าวเหนียว', 'carb', 'กำ', [1, 2], 1, { sw: 8 }),
    bun: I('ขนมปังเบอร์เกอร์', 'carb', 'ชิ้น', [1], 1, { sw: 6, sa: 3 }),
    hbun: I('ขนมปังฮอทดอก', 'carb', 'ชิ้น', [1], 1, { sw: 6, sa: 3 }),
    toast: I('ขนมปังแผ่น', 'carb', 'แผ่น', [1, 2], 2, { sw: 4, sa: 3 }),
    tortilla: I('ตอร์ติญ่า', 'carb', 'แผ่น', [1, 2], 1, { sw: 2, sa: 2 }),
    pasta: I('สปาเกตตี', 'carb', 'g', [80, 100, 120], 100, { sw: 3, sa: 1 }),
    potato: I('มันฝรั่ง', 'carb', 'หัว', [1, 2], 1, { sw: 3, um: 2 }),
    pizza: I('แป้งพิซซ่า', 'carb', 'แผ่น', [1], 1, { sw: 3, sa: 3 }),
    croissant: I('แป้งครัวซองต์', 'carb', 'ชิ้น', [1, 2], 1, { sw: 8, sa: 3 }),
    donut: I('แป้งโดนัท', 'carb', 'ชิ้น', [1, 2], 1, { sw: 10 }),
    ramen: I('เส้นราเมง', 'carb', 'ก้อน', [1], 1, { sa: 2 }),
    dumpling: I('เกี๊ยว', 'carb', 'ชิ้น', [1], 1, { um: 8, sa: 3 }),
    // vegetables, herbs & fruit
    chili: I('พริกขี้หนู', 'veg', 'เม็ด', [1, 2, 3, 4, 5], 3, { sp: 30 }),
    garlic: I('กระเทียม', 'veg', 'กลีบ', [2, 4, 6], 4, { sp: 4, um: 4 }),
    basil: I('ใบกะเพรา', 'veg', 'กำ', [1, 2], 1, { sp: 4, um: 2 }),
    papaya: I('มะละกอดิบ', 'veg', 'ลูก', [1], 1, { sw: 4, so: 2 }),
    tomato: I('มะเขือเทศ', 'veg', 'ลูก', [1, 2], 1, { so: 8, sw: 4, um: 4 }),
    mushroom: I('เห็ด', 'veg', 'ดอก', [3, 5, 7], 5, { um: 12 }),
    lettuce: I('ผักกาดหอม', 'veg', 'ใบ', [1, 2, 3], 2, { sw: 1 }),
    onion: I('หอมใหญ่', 'veg', 'ซีก', [1, 2], 1, { sw: 5, sp: 2 }),
    avocado: I('อะโวคาโด', 'veg', 'ลูก', [1], 1, { um: 4, sw: 2 }),
    mango: I('มะม่วงสุก', 'veg', 'ลูก', [1], 1, { sw: 24, so: 4 }),
    pineapple: I('สับปะรด', 'veg', 'ชิ้น', [3, 5], 5, { sw: 14, so: 8 }),
    carrot: I('แครอท', 'veg', 'หัว', [1], 1, { sw: 8 }),
    cucumber: I('แตงกวา', 'veg', 'ลูก', [1], 1, { sw: 2 }),
    bellpepper: I('พริกหยวก', 'veg', 'ลูก', [1], 1, { sw: 4, sp: 2 }),
    apple: I('แอปเปิ้ล', 'veg', 'ลูก', [1], 1, { sw: 16, so: 4 }),
    banana: I('กล้วย', 'veg', 'ลูก', [1], 1, { sw: 20 }),
    strawberry: I('สตรอว์เบอร์รี', 'veg', 'ลูก', [1], 1, { sw: 14, so: 6 }),
    lemon: I('เลมอน', 'veg', 'ลูก', [1], 1, { so: 26 }),
    nori: I('สาหร่ายโนริ', 'veg', 'แผ่น', [1], 1, { sa: 4, um: 6 }),
    kimchi: I('กิมจิ', 'veg', 'ถ้วย', [1], 1, { so: 12, sp: 10, sa: 4 }),
    // dairy & coconut
    coconut: I('กะทิ', 'dairy', 'ช้อน', [2, 3, 4], 3, { sw: 6, sa: 3, um: 4 }),
    cheese: I('เชดดาร์ชีส', 'dairy', 'แผ่น', [1, 2], 1, { sa: 10, um: 8 }),
    mozzarella: I('มอสซาเรลล่า', 'dairy', 'g', [50, 100], 100, { sa: 6, um: 6 }),
    butter: I('เนย', 'dairy', 'ช้อน', [1, 2], 1, { sa: 4, sw: 2, um: 2 }),
    icecream: I('ไอศกรีม', 'dairy', 'สกู๊ป', [1, 2], 1, { sw: 22 }),
    pepperoni: I('เป๊ปเปอโรนี', 'dairy', 'แผ่น', [4, 6, 8], 6, { sa: 12, sp: 6, um: 6 }),
    // sauces
    ketchup: I('ซอสมะเขือเทศ', 'sauce', 'ช้อน', [1, 2, 3], 2, { sw: 10, so: 8, sa: 6 }),
    mustard: I('มัสตาร์ด', 'sauce', 'ช้อน', [1, 2], 1, { so: 8, sp: 6, sa: 4 }),
    mayo: I('มายองเนส', 'sauce', 'ช้อน', [1, 2, 3], 2, { sw: 4, so: 4, um: 4 }),
    soysauce: I('ซีอิ๊วญี่ปุ่น', 'sauce', 'ช้อน', [1], 1, { sa: 18, um: 8 }),
    gochujang: I('โคชูจัง', 'sauce', 'ช้อน', [1], 1, { sp: 16, sw: 8, sa: 6 }),
  };
  const CATS = [['meat', 'เนื้อสัตว์และไข่'], ['carb', 'ข้าวและแป้ง'], ['veg', 'ผัก สมุนไพร ผลไม้'], ['dairy', 'กะทิ นม ชีส'], ['sauce', 'ซอส']];

  /* seasoning bottles: taste added per 1 ช้อน */
  const SEASON = {
    fish: { th: 'น้ำปลา', t: { sa: 9, um: 5 } },
    oyster: { th: 'ซอสหอยนางรม', t: { um: 8, sa: 4, sw: 3 } },
    salt: { th: 'เกลือ', t: { sa: 10 } },
    sugar: { th: 'น้ำตาล', t: { sw: 10 } },
    lime: { th: 'น้ำมะนาว', t: { so: 12 } },
    chili: { th: 'พริกป่น', t: { sp: 10 } },
  };
  const SEASON_KEYS = Object.keys(SEASON);

  /* cooking changes taste a little (e.g. grilling brings out umami) */
  const STATE_MOD = { sauteed: { um: 1.15 }, deepfried: { um: 1.1, sa: 1.1 }, grilled: { um: 1.25, sw: 1.1 }, baked: { sw: 1.1 }, boiled: { um: .9 }, fries: { sa: 1.1 } };

  /* ---------- tools & transforms: "ingredient:state" -> new state ---------- */
  const COOK_TOOLS = ['knife', 'mortar', 'pan', 'fryer', 'pot', 'oven', 'grill', 'steamer'];
  const TR = {
    knife: { 'potato:raw': 'chopped', 'lettuce:raw': 'chopped', 'tomato:raw': 'chopped', 'onion:raw': 'chopped', 'garlic:raw': 'chopped', 'mushroom:raw': 'chopped', 'pork:raw': 'chopped', 'chili:raw': 'chopped', 'papaya:raw': 'chopped', 'mango:raw': 'chopped', 'carrot:raw': 'chopped', 'cucumber:raw': 'chopped', 'bellpepper:raw': 'chopped', 'apple:raw': 'chopped', 'banana:raw': 'chopped', 'strawberry:raw': 'chopped', 'lemon:raw': 'chopped' },
    mortar: { 'avocado:raw': 'mashed', 'tomato:raw': 'mashed', 'potato:boiled': 'mashed', 'chili:raw': 'mashed', 'garlic:raw': 'mashed', 'papaya:chopped': 'somtam' },
    pan: { 'sausage:raw': 'sauteed', 'eggraw:raw': 'sauteed', 'bacon:raw': 'sauteed', 'patty:raw': 'sauteed', 'steak:raw': 'sauteed', 'salmon:raw': 'sauteed', 'mushroom:chopped': 'sauteed', 'pork:chopped': 'sauteed', 'bellpepper:chopped': 'sauteed', 'rice:raw': 'sauteed', 'tofu:raw': 'sauteed', 'kimchi:raw': 'sauteed' },
    fryer: { 'potato:chopped': 'fries', 'chicken:raw': 'deepfried', 'donut:raw': 'deepfried', 'shrimp:raw': 'deepfried', 'eggraw:raw': 'deepfried', 'banana:raw': 'deepfried', 'tofu:raw': 'deepfried', 'dumpling:raw': 'deepfried' },
    pot: { 'pasta:raw': 'boiled', 'potato:raw': 'boiled', 'shrimp:raw': 'boiled', 'mushroom:raw': 'boiled', 'coconut:raw': 'boiled', 'carrot:chopped': 'boiled', 'ramen:raw': 'boiled' },
    oven: { 'pizza:raw': 'baked', 'croissant:raw': 'baked', 'toast:raw': 'baked', 'apple:chopped': 'baked' },
    grill: { 'chicken:raw': 'grilled', 'pork:raw': 'grilled', 'shrimp:raw': 'grilled', 'bellpepper:raw': 'grilled', 'mushroom:raw': 'grilled' },
    steamer: { 'sticky:raw': 'steamed', 'fish:raw': 'steamed', 'dumpling:raw': 'steamed' },
  };

  /* ---------- menus ----------
     c: [ingredient, state, amount] in PLATING ORDER (bottom first)
     s: the ideal seasoning (hidden from players — the target taste is computed from it) */
  const M = (id, th, cuisine, tier, c, s) => ({ id, th, cuisine, tier, c, s: s || {} });
  const MENUS = [
    // Thai
    M('kapao', 'กะเพราหมูสับไข่ดาว', 'th', 2, [['rice', 'raw', 1], ['pork', 'sauteed', 150], ['chili', 'mashed', 3], ['basil', 'raw', 1], ['eggraw', 'deepfried', 1]], { fish: 2, oyster: 1, sugar: 1 }),
    M('tomyum', 'ต้มยำกุ้ง', 'th', 2, [['shrimp', 'boiled', 5], ['mushroom', 'boiled', 5], ['chili', 'chopped', 3]], { lime: 3, fish: 2, chili: 1, sugar: .5 }),
    M('somtam', 'ส้มตำไทย', 'th', 2, [['papaya', 'somtam', 1], ['tomato', 'chopped', 1], ['chili', 'mashed', 2], ['garlic', 'mashed', 2]], { lime: 3, fish: 2, sugar: 2 }),
    M('kaiyang', 'ไก่ย่างข้าวเหนียว', 'th', 1, [['sticky', 'steamed', 1], ['chicken', 'grilled', 1]], { fish: 1, lime: 1, chili: 1, sugar: 1 }),
    M('mooping', 'หมูปิ้งข้าวเหนียว', 'th', 1, [['sticky', 'steamed', 1], ['pork', 'grilled', 100]], { oyster: 1, sugar: 1.5 }),
    M('kaidao', 'ข้าวไข่ดาวน้ำปลาพริก', 'th', 1, [['rice', 'raw', 1], ['eggraw', 'deepfried', 1], ['chili', 'chopped', 1]], { fish: 1.5, lime: .5 }),
    M('plamanao', 'ปลานึ่งมะนาว', 'th', 3, [['fish', 'steamed', 1], ['garlic', 'chopped', 4], ['chili', 'chopped', 3]], { lime: 3.5, fish: 2, sugar: 1 }),
    M('mangosticky', 'ข้าวเหนียวมะม่วง', 'th', 2, [['sticky', 'steamed', 1], ['mango', 'chopped', 1], ['coconut', 'boiled', 3]], { sugar: 1, salt: .5 }),
    // Chinese 🇨🇳
    M('friedrice', 'ข้าวผัดหมูใส่ไข่', 'cn', 2, [['rice', 'sauteed', 1], ['pork', 'sauteed', 150], ['eggraw', 'sauteed', 1]], { oyster: 1, salt: .5 }),
    M('dimsum', 'เกี๊ยวนึ่งจิ้มซีอิ๊ว', 'cn', 1, [['dumpling', 'steamed', 1], ['soysauce', 'raw', 1]]),
    M('mapotofu', 'เต้าหู้ผัดพริก', 'cn', 2, [['tofu', 'sauteed', 1], ['pork', 'sauteed', 150], ['chili', 'chopped', 2]], { oyster: 1, chili: 1 }),
    // Japanese 🇯🇵
    M('sushi', 'ซูชิแซลมอน', 'jp', 2, [['rice', 'raw', 1], ['salmon', 'raw', 150], ['nori', 'raw', 1], ['soysauce', 'raw', 1]], { sugar: .5 }),
    M('ramen', 'ราเมงหมูย่าง', 'jp', 3, [['ramen', 'boiled', 1], ['pork', 'grilled', 100], ['eggraw', 'sauteed', 1], ['nori', 'raw', 1]], { salt: 1 }),
    M('gyoza', 'เกี๊ยวซ่า', 'jp', 1, [['dumpling', 'deepfried', 1], ['soysauce', 'raw', 1]]),
    M('tempura', 'เทมปุระกุ้ง', 'jp', 1, [['shrimp', 'deepfried', 5], ['soysauce', 'raw', 1]]),
    // Korean 🇰🇷
    M('kchicken', 'ไก่ทอดเกาหลี', 'kr', 1, [['chicken', 'deepfried', 1], ['gochujang', 'raw', 1]], { sugar: 1 }),
    M('bibimbap', 'บิบิมบับ', 'kr', 3, [['rice', 'raw', 1], ['eggraw', 'sauteed', 1], ['carrot', 'chopped', 1], ['kimchi', 'raw', 1], ['gochujang', 'raw', 1]]),
    M('kimchipork', 'หมูผัดกิมจิ', 'kr', 2, [['pork', 'sauteed', 150], ['kimchi', 'sauteed', 1]], { sugar: .5 }),
    // Western (kept from the earlier version)
    M('hotdog', 'ฮอทดอก', 'west', 1, [['hbun', 'raw', 1], ['sausage', 'sauteed', 1], ['mustard', 'raw', 1]]),
    M('fries', 'เฟรนช์ฟรายส์', 'west', 1, [['potato', 'fries', 1], ['ketchup', 'raw', 2]], { salt: .5 }),
    M('breakfast', 'ไข่ดาวเบคอนขนมปังปิ้ง', 'west', 1, [['toast', 'baked', 2], ['bacon', 'sauteed', 2], ['eggraw', 'sauteed', 1]], { salt: .5 }),
    M('donutice', 'โดนัทไอศกรีม', 'west', 1, [['donut', 'deepfried', 1], ['icecream', 'raw', 1]]),
    M('croissant', 'ครัวซองต์เนย', 'west', 1, [['croissant', 'baked', 1], ['butter', 'raw', 1]]),
    M('friedshrimp', 'กุ้งทอดจิ้มมายองเนส', 'west', 1, [['shrimp', 'deepfried', 5], ['mayo', 'raw', 2]]),
    M('burger', 'ชีสเบอร์เกอร์', 'west', 2, [['bun', 'raw', 1], ['patty', 'sauteed', 150], ['cheese', 'raw', 1], ['lettuce', 'chopped', 2]], { salt: .5 }),
    M('blt', 'แซนด์วิช BLT', 'west', 2, [['toast', 'baked', 2], ['bacon', 'sauteed', 2], ['lettuce', 'chopped', 2], ['tomato', 'chopped', 1]]),
    M('spaghetti', 'สปาเกตตีซอสมะเขือเทศ', 'west', 2, [['pasta', 'boiled', 100], ['tomato', 'mashed', 1], ['garlic', 'chopped', 4]], { salt: 1, sugar: .5 }),
    M('taco', 'ทาโก้กัวคาโมเล่', 'west', 2, [['tortilla', 'raw', 1], ['avocado', 'mashed', 1], ['onion', 'chopped', 1], ['tomato', 'chopped', 1]], { lime: 1, salt: .5 }),
    M('shrimpsalad', 'สลัดกุ้ง', 'west', 2, [['lettuce', 'chopped', 2], ['shrimp', 'boiled', 5], ['tomato', 'chopped', 1], ['mayo', 'raw', 2]]),
    M('salmon', 'แซลมอนจี่เนยกับสลัด', 'west', 2, [['lettuce', 'chopped', 2], ['salmon', 'sauteed', 150], ['butter', 'raw', 1]], { salt: .5, lime: .5 }),
    M('pepperoni', 'พิซซ่าเป๊ปเปอโรนี', 'west', 2, [['pizza', 'baked', 1], ['tomato', 'mashed', 1], ['mozzarella', 'raw', 100], ['pepperoni', 'raw', 6]]),
    M('hawaiian', 'พิซซ่าฮาวายเอี้ยน', 'west', 2, [['pizza', 'baked', 1], ['tomato', 'mashed', 1], ['mozzarella', 'raw', 100], ['pineapple', 'raw', 5]]),
    M('chickenmash', 'ไก่ทอดกับมันบด', 'west', 3, [['potato', 'mashed', 1], ['chicken', 'deepfried', 1], ['butter', 'raw', 1]], { salt: 1 }),
    M('steak', 'สเต๊กเนื้อเห็ดผัด', 'west', 3, [['steak', 'sauteed', 200], ['mushroom', 'sauteed', 5], ['potato', 'boiled', 1], ['butter', 'raw', 1]], { salt: 1 }),
    M('burgerset', 'ชุดเบอร์เกอร์เฟรนช์ฟรายส์', 'west', 3, [['bun', 'raw', 1], ['patty', 'sauteed', 150], ['cheese', 'raw', 1], ['potato', 'fries', 1], ['ketchup', 'raw', 2]], { salt: .5 }),
  ];
  // co-op table menus (Family Style): small plates of 1–4 pieces, no sauces; one new station comes in every round or two
  const R = (ing, st) => [ing, st, 1];
  const FS_MENUS = [
    M('fs_salad', 'สลัดผักสด', 'fs', 1, [R('lettuce', 'chopped'), R('tomato', 'chopped')]),
    M('fs_mango', 'มะม่วงสุกหั่น', 'fs', 1, [R('mango', 'chopped')]),
    M('fs_caprese', 'มะเขือเทศชีส', 'fs', 1, [R('tomato', 'chopped'), R('mozzarella', 'raw')]),
    M('fs_fries', 'เฟรนช์ฟรายส์', 'fs', 1, [R('potato', 'fries')]),
    M('fs_shrimp', 'กุ้งทอดกับผักสด', 'fs', 1, [R('shrimp', 'deepfried'), R('lettuce', 'chopped')]),
    M('fs_chicken', 'ไก่ทอด', 'fs', 1, [R('chicken', 'deepfried')]),
    M('fs_donut', 'โดนัทไอศกรีม', 'fs', 1, [R('donut', 'deepfried'), R('icecream', 'raw')]),
    M('fs_hotdog', 'ฮอทดอก', 'fs', 1, [R('hbun', 'raw'), R('sausage', 'sauteed')]),
    M('fs_eggtoast', 'ไข่ดาวบนขนมปัง', 'fs', 1, [R('toast', 'raw'), R('eggraw', 'sauteed')]),
    M('fs_burger', 'ชีสเบอร์เกอร์', 'fs', 2, [R('bun', 'raw'), R('patty', 'sauteed'), R('cheese', 'raw'), R('lettuce', 'chopped')]),
    M('fs_steak', 'สเต๊กกับเฟรนช์ฟรายส์', 'fs', 2, [R('steak', 'sauteed'), R('potato', 'fries')]),
    M('fs_salmon', 'แซลมอนอะโวคาโด', 'fs', 2, [R('salmon', 'sauteed'), R('avocado', 'raw')]),
    M('fs_pizza', 'พิซซ่าชีส', 'fs', 2, [R('pizza', 'baked'), R('mozzarella', 'raw'), R('tomato', 'chopped')]),
    M('fs_croissant', 'ครัวซองต์เนย', 'fs', 1, [R('croissant', 'baked'), R('butter', 'raw')]),
    M('fs_blt', 'แซนด์วิช BLT', 'fs', 2, [R('toast', 'baked'), R('bacon', 'sauteed'), R('lettuce', 'chopped'), R('tomato', 'chopped')]),
    M('fs_pasta', 'สปาเกตตีชีส', 'fs', 2, [R('pasta', 'boiled'), R('tomato', 'chopped'), R('cheese', 'raw')]),
    M('fs_taco', 'ทาโก้อะโวคาโด', 'fs', 2, [R('tortilla', 'raw'), R('avocado', 'mashed'), R('tomato', 'chopped'), R('onion', 'chopped')]),
    M('fs_mash', 'ไก่ทอดมันบด', 'fs', 2, [R('chicken', 'deepfried'), R('potato', 'mashed')]),
    M('fs_kaiyang', 'ไก่ย่างกับมะเขือเทศ', 'fs', 1, [R('chicken', 'grilled'), R('tomato', 'chopped')]),
    M('fs_mooping', 'หมูปิ้ง', 'fs', 1, [R('pork', 'grilled')]),
    M('fs_shrimpgrill', 'กุ้งเผาพริก', 'fs', 1, [R('shrimp', 'grilled'), R('chili', 'chopped')]),
    M('fs_tomyum', 'ต้มยำกุ้ง', 'fs', 2, [R('shrimp', 'boiled'), R('mushroom', 'boiled'), R('chili', 'chopped')]),
    M('fs_somtam', 'ส้มตำ', 'fs', 3, [R('papaya', 'somtam'), R('tomato', 'chopped'), R('chili', 'mashed')]),
    M('fs_sticky', 'ไก่ย่างข้าวเหนียว', 'fs', 2, [R('sticky', 'steamed'), R('chicken', 'grilled')]),
    M('fs_mangosticky', 'ข้าวเหนียวมะม่วง', 'fs', 2, [R('sticky', 'steamed'), R('mango', 'chopped')]),
    M('fs_fish', 'ปลานึ่งกระเทียมพริก', 'fs', 2, [R('fish', 'steamed'), R('garlic', 'chopped'), R('chili', 'chopped')]),
    // no station at all: just put it on the plate (the first rounds, Family Style)
    M('fs_berry', 'สตรอว์เบอร์รีสด', 'fs', 1, [R('strawberry', 'raw')]),
    M('fs_bananaice', 'กล้วยไอศกรีม', 'fs', 1, [R('banana', 'raw'), R('icecream', 'raw')]),
    M('fs_cheesetoast', 'ขนมปังชีส', 'fs', 1, [R('toast', 'raw'), R('cheese', 'raw')]),
    M('fs_fruit', 'ผลไม้รวม', 'fs', 1, [R('apple', 'chopped'), R('banana', 'chopped'), R('strawberry', 'raw')]),
    M('fs_sticks', 'แครอทแตงกวาแท่ง', 'fs', 1, [R('carrot', 'chopped'), R('cucumber', 'chopped')]),
    M('fs_bigsalad', 'สลัดจานใหญ่', 'fs', 2, [R('lettuce', 'chopped'), R('tomato', 'chopped'), R('cucumber', 'chopped'), R('carrot', 'chopped')]),
    M('fs_bananafry', 'กล้วยทอด', 'fs', 1, [R('banana', 'deepfried')]),
    M('fs_pepperegg', 'ไข่ผัดพริกหยวก', 'fs', 1, [R('eggraw', 'sauteed'), R('bellpepper', 'sauteed')]),
    M('fs_salmonlemon', 'แซลมอนเลมอน', 'fs', 2, [R('salmon', 'sauteed'), R('lemon', 'chopped')]),
    M('fs_veggrill', 'ผักย่าง', 'fs', 1, [R('bellpepper', 'grilled'), R('mushroom', 'grilled')]),
    M('fs_lemonchicken', 'ไก่ย่างเลมอน', 'fs', 2, [R('chicken', 'grilled'), R('lemon', 'chopped')]),
    M('fs_applebake', 'แอปเปิ้ลอบไอศกรีม', 'fs', 2, [R('apple', 'baked'), R('icecream', 'raw')]),
    M('fs_carrotsoup', 'แครอทต้มกับขนมปัง', 'fs', 1, [R('carrot', 'boiled'), R('toast', 'raw')]),
    // Asia: Chinese / Japanese / Korean small plates
    M('fs_sushi', 'ซูชิแซลมอน', 'fs', 2, [R('rice', 'raw'), R('salmon', 'raw'), R('nori', 'raw')]),
    M('fs_onigiri', 'ข้าวปั้นสาหร่าย', 'fs', 1, [R('rice', 'raw'), R('nori', 'raw')]),
    M('fs_ramen', 'ราเมง', 'fs', 2, [R('ramen', 'boiled'), R('eggraw', 'sauteed'), R('nori', 'raw')]),
    M('fs_gyoza', 'เกี๊ยวซ่า', 'fs', 1, [R('dumpling', 'deepfried')]),
    M('fs_dimsum', 'เกี๊ยวนึ่ง', 'fs', 1, [R('dumpling', 'steamed')]),
    M('fs_friedrice', 'ข้าวผัดไข่', 'fs', 1, [R('rice', 'sauteed'), R('eggraw', 'sauteed')]),
    M('fs_tofu', 'เต้าหู้ทอด', 'fs', 1, [R('tofu', 'deepfried')]),
    M('fs_kchicken', 'ไก่ทอดเกาหลีกับกิมจิ', 'fs', 1, [R('chicken', 'deepfried'), R('kimchi', 'raw')]),
    M('fs_bibimbap', 'บิบิมบับ', 'fs', 2, [R('rice', 'raw'), R('eggraw', 'sauteed'), R('carrot', 'chopped'), R('kimchi', 'raw')]),
  ];
  const MENU_BY_ID = Object.fromEntries(MENUS.concat(FS_MENUS).map(m => [m.id, m]));
  const LIFE = { 1: 70, 2: 90, 3: 110 };            // seconds before an order walks out
  const TIER_X = { 1: .8, 2: 1, 3: 1.25 };           // harder menus are worth more
  const MAX_PLATE = 6;

  /* ---------- names ---------- */
  const SPECIAL = {
    'eggraw:sauteed': 'ไข่ดาว', 'eggraw:deepfried': 'ไข่ดาวกรอบ', 'bacon:sauteed': 'เบคอนกรอบ', 'potato:fries': 'เฟรนช์ฟรายส์', 'potato:mashed': 'มันบด', 'chicken:deepfried': 'ไก่ทอด',
    'donut:deepfried': 'โดนัททอด', 'shrimp:deepfried': 'กุ้งทอด', 'toast:baked': 'ขนมปังปิ้ง', 'pizza:baked': 'แป้งพิซซ่าอบ', 'croissant:baked': 'ครัวซองต์อบ', 'pasta:boiled': 'สปาเกตตีต้ม',
    'steak:sauteed': 'สเต๊กย่าง', 'patty:sauteed': 'แพตตี้สุก', 'mushroom:sauteed': 'เห็ดผัด', 'salmon:sauteed': 'แซลมอนจี่', 'sausage:sauteed': 'ไส้กรอกจี่',
    'pork:chopped': 'หมูสับ', 'pork:sauteed': 'หมูสับผัด', 'pork:grilled': 'หมูปิ้ง', 'chicken:grilled': 'ไก่ย่าง', 'shrimp:grilled': 'กุ้งเผา', 'sticky:steamed': 'ข้าวเหนียวนึ่ง',
    'fish:steamed': 'ปลานึ่ง', 'papaya:chopped': 'มะละกอสับ', 'papaya:somtam': 'ส้มตำ', 'chili:mashed': 'พริกตำ', 'chili:chopped': 'พริกซอย', 'garlic:mashed': 'กระเทียมตำ',
    'coconut:boiled': 'กะทิเคี่ยว', 'mango:chopped': 'มะม่วงหั่น', 'shrimp:boiled': 'กุ้งต้ม', 'mushroom:boiled': 'เห็ดต้ม',
    'banana:deepfried': 'กล้วยทอด', 'apple:baked': 'แอปเปิ้ลอบ', 'bellpepper:grilled': 'พริกหยวกย่าง', 'mushroom:grilled': 'เห็ดย่าง', 'carrot:boiled': 'แครอทต้ม', 'lemon:chopped': 'เลมอนฝาน', 'bellpepper:sauteed': 'พริกหยวกผัด',
    'rice:sauteed': 'ข้าวผัด', 'tofu:deepfried': 'เต้าหู้ทอด', 'tofu:sauteed': 'เต้าหู้ผัด', 'kimchi:sauteed': 'กิมจิผัด', 'dumpling:deepfried': 'เกี๊ยวซ่า', 'dumpling:steamed': 'เกี๊ยวนึ่ง', 'ramen:boiled': 'เส้นราเมงต้ม', 'salmon:raw': 'แซลมอนสด',
  };
  const SUFFIX = { raw: '', chopped: 'หั่น', sauteed: 'ผัด', deepfried: 'ทอด', boiled: 'ต้ม', mashed: 'บด', baked: 'อบ', grilled: 'ย่าง', steamed: 'นึ่ง', somtam: 'ตำ', fries: 'ทอด' };
  const itemName = it => SPECIAL[it.ing + ':' + it.st] || (ING[it.ing] ? ING[it.ing].th : it.ing) + (SUFFIX[it.st] || '');
  const amtText = () => '';   // amounts were removed: one ingredient = one piece
  const keyOf = it => it.ing + ':' + it.st;

  /* ---------- helpers ---------- */
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
  function pathTo(ing, st) {
    if (st === 'raw') return [];
    const seen = new Set(['raw']), q = [['raw', []]];
    while (q.length) { const [s, p] = q.shift(); for (const t of COOK_TOOLS) { const n = TR[t][ing + ':' + s]; if (n && !seen.has(n)) { const np = [...p, t]; if (n === st) return np; seen.add(n); q.push([n, np]) } } }
    return null;
  }
  /* order stream: a shuffled "bag" per tier so every menu shows up before any repeats; same seed => same orders for everyone */
  function buildSeq(gen, n = 240) {
    const r = mulberry(Math.floor(gen) % 2147483647 || 7); const bags = {}, seq = [];
    const draw = t => {
      if (!bags[t] || !bags[t].length) { bags[t] = MENUS.filter(m => m.tier === t).slice(); for (let i = bags[t].length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [bags[t][i], bags[t][j]] = [bags[t][j], bags[t][i]] } }
      let m = bags[t].pop(); if (seq.length && seq[seq.length - 1] === m && bags[t].length) { bags[t].unshift(m); m = bags[t].pop() } return m
    };
    for (let k = 0; k < n; k++) { const x = r(); const tier = k < 2 ? (x < .6 ? 1 : 2) : k < 5 ? (x < .4 ? 1 : 2) : (x < .32 ? 1 : x < .8 ? 2 : 3); seq.push(draw(tier)) }
    return seq;
  }

  /* ---------- TASTE ENGINE ---------- */
  const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
  function emptyTaste() { return { sw: 0, sa: 0, so: 0, sp: 0, um: 0 } }
  // what a plate tastes like: every item adds its taste x amount, every spoon of seasoning adds its taste
  function tasteOf(plate, season) {
    const t = emptyTaste();
    for (const it of plate || []) {
      const g = ING[it.ing]; if (!g) continue; const f = (+it.amt || g.d) / g.d; const mod = STATE_MOD[it.st] || {};
      for (const k of TK) t[k] += (g.t[k] || 0) * f * (mod[k] || 1);
    }
    for (const [s, n] of Object.entries(season || {})) { const b = SEASON[s]; if (!b) continue; for (const k of TK) t[k] += (b.t[k] || 0) * (+n || 0) }
    for (const k of TK) t[k] = Math.round(clamp(t[k]));
    return t;
  }
  // the target taste of a menu = the taste of its perfect version (so every target is reachable)
  const targetOf = m => m._target || (m._target = tasteOf(m.c.map(([ing, st, amt]) => ({ ing, st, amt })), m.s));
  /* customer requests ("คำขอรส") and judges move the target: the same dish must be seasoned differently */
  const REQS = [
    { k: 'sp', d: 25, th: 'เผ็ดมาก' }, { k: 'sp', d: -20, th: 'ไม่เผ็ด', need: 20 }, { k: 'sw', d: 15, th: 'หวานหน่อย' },
    { k: 'sa', d: -12, th: 'เค็มน้อย', need: 12 }, { k: 'so', d: 15, th: 'เปรี้ยวจัด' }, { k: 'um', d: 12, th: 'กลมกล่อม' },
  ];
  const JUDGES = [
    { name: 'เชฟสมชาย', k: 'sp', d: 20, th: 'ชอบเผ็ดมาก' }, { name: 'คุณป้าแดง', k: 'sa', d: -10, th: 'ไม่ชอบเค็ม' },
    { name: 'เชฟมะลิ', k: 'sw', d: 12, th: 'ชอบหวาน' }, { name: 'ลุงเปรี้ยว', k: 'so', d: 15, th: 'ชอบเปรี้ยวจี๊ด' },
  ];
  // target for one ticket = recipe target + customer request + judge preference (kept inside 0..100)
  function targetFor(m, req, judge) {
    const t = { ...targetOf(m) };
    for (const x of [req, judge]) if (x && TK.includes(x.k)) t[x.k] = Math.round(clamp(t[x.k] + x.d));
    return t;
  }
  // courses for the final's set meal (main + side + dessert)
  const COURSE = { donutice: 'dessert', croissant: 'dessert', mangosticky: 'dessert', fries: 'side', somtam: 'side', shrimpsalad: 'side', taco: 'side', kaidao: 'side', friedshrimp: 'side' };
  const courseOf = id => COURSE[id] || 'main';
  const COURSE_TH = { main: 'จานหลัก', side: 'เครื่องเคียง', dessert: 'ของหวาน' };
  const SET_BONUS = 60;
  // Hell's Kitchen table: a table orders 2-3 courses (appetizer -> main -> dessert) that must go out IN ORDER;
  // the head chef at the pass sends back any course below standard, and a table served well tips extra
  const HK_COURSE = { side: 'ออเดิร์ฟ', main: 'จานหลัก', dessert: 'ของหวาน' };
  const HK_MIN = 45, HK_GOOD = 70;
  // MasterChef-style challenges inside a normal match
  const CHAL = { pressure: { th: 'Pressure Test', ms: 60000 }, speed: { th: 'รอบเร่งความเร็ว ×1.5', ms: 40000 } };
  const DUEL_MS = 60000, DUEL_WIN = 100, DUEL_LOSE = 40;
  /* ---------- DAYS: the co-op campaign. Short rounds, 1-3 stars, ONE new thing per day ----------
     tools = the stations in the kitchen that day; menus = what customers order;
     split = ingredients/stations shared out round the table (pass left/right); wash / season / gold / market / rival / cards = that day's event */
  const WORLDS = [
    { id: 'home', th: 'ครัวบ้านป้าแดง', icon: '🏠' },
    { id: 'diner', th: 'ร้านอาหารฝรั่ง', icon: '🍔' },
    { id: 'thai', th: 'ครัวไทยเยาวราช', icon: '🌶️' },
  ];
  // Family Style rules for a day: a shop meter (0–100) drains all the time, a served dish fills it up,
  // an order that runs out of patience knocks a big chunk off; empty meter = the shop closes. Serve `goal` dishes to clear the day.
  // the days get harder: more dishes, more orders at once, less patience, a faster drain
  const HEARTS = 3, METER = { start: 60, max: 100, miss: 12 };   // a missed order costs about as much as ~10 s of waiting (it used to be ~40 s)
  const DAY_RAMP = [[3, 1, 1.6, .5], [4, 2, 1.5, .55], [4, 2, 1.5, .55], [5, 2, 1.4, .6], [5, 2, 1.3, .65], [6, 3, 1.25, .7], [6, 3, 1.2, .75], [7, 3, 1.15, .8], [7, 3, 1.1, .85], [8, 3, 1.05, .9], [8, 4, 1, .95], [10, 4, .95, 1]].map(([goal, cap, px, drain]) => ({ goal, cap, px: Math.round((px - .1) * 100) / 100, drain: Math.round(drain * 1.9 * 100) / 100 }));   // the shop drains steadily (faster than before) so every order matters, while a miss stings less
  // co-op table (Family Style): no sauce bottles — a dish is just its solid pieces
  const fsComp = m => { const c = m.c.filter(x => ING[x[0]] && ING[x[0]].cat !== 'sauce'); return c.length ? c : m.c };
  const DAY_INGS = D => [...new Set(D.menus.map(id => MENU_BY_ID[id]).filter(Boolean).flatMap(m => fsComp(m).map(c => c[0])))];
  const ROUND_PAUSE = 5600, ROUND_BONUS = 20;   // continuous co-op: the round card pause, and a little meter boost for clearing a round
  const meterGain = pts => Math.min(30, 10 + Math.round(pts / 5));
  /* Family Style: no fixed campaign. Every game draws its OWN run from the seed (same seed = same run on every screen and on the server):
     round 1 opens ONE random station (plus dishes that need none), most rounds add another random station, dishes get bigger
     (more pieces on the plate) as the rounds go on, and the last round throws in everything that was opened. */
  const TOOL_TH = { knife: 'เขียง', fryer: 'หม้อทอด', pan: 'กระทะ', oven: 'เตาอบ', pot: 'หม้อต้ม', mortar: 'ครก', grill: 'เตาถ่าน', steamer: 'ซึ้งนึ่ง' };
  const fsToolsOf = m => [...new Set(fsComp(m).flatMap(c => pathTo(c[0], c[1]) || []))];
  const RUN_MOOD = ['ลูกค้าแน่นร้าน', 'จานใหญ่ขึ้น', 'ออร์เดอร์รัว ๆ', 'มือต้องไว', 'ส่งของกันให้ทัน', 'ครัวเริ่มร้อน'];
  function fsRun(seed) {
    const r = mulberry((Math.floor(Math.abs(+seed) || 1) % 2147483647) ^ 0x2b7e5);
    const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a };
    const pieces = m => fsComp(m).length;
    const open = [], out = []; let lastNew = 0;
    for (let n = 1; n <= 12; n++) {
      const maxP = n <= 2 ? 2 : n <= 5 ? 3 : 4;
      const fits = (tools, m) => fsToolsOf(m).every(t => tools.includes(t)) && pieces(m) <= maxP;
      // a station is worth opening when it unlocks at least one dish together with what is already open
      const usable = COOK_TOOLS.filter(t => !open.includes(t) && FS_MENUS.some(m => fsToolsOf(m).includes(t) && fits(open.concat(t), m)));
      let nt = null;
      if (n < 12 && usable.length && (n === 1 || n - lastNew >= 2 || r() < .7)) { nt = shuffle(usable)[0]; open.push(nt); lastNew = n }
      const feas = FS_MENUS.filter(m => fits(open, m));
      let menus;
      if (n === 12) menus = feas.map(m => ({ m, k: r() + pieces(m) * .3 })).sort((a, b) => b.k - a.k).slice(0, 8).map(x => x.m.id);   // the party: 8 dishes from everything opened, big ones first
      else {
        const fresh = shuffle(feas.filter(m => nt && fsToolsOf(m).includes(nt))).slice(0, 2);
        const none = n <= 2 ? shuffle(feas.filter(m => !fsToolsOf(m).length && !fresh.includes(m))).slice(0, 1) : [];
        // bigger plates later on: the rest are drawn with a lean toward more pieces
        const rest = feas.filter(m => !fresh.includes(m) && !none.includes(m)).map(m => ({ m, k: r() + (n >= 6 ? pieces(m) * .25 : 0) })).sort((a, b) => b.k - a.k).map(x => x.m);
        const want = Math.min(feas.length, 4 + Math.floor(n / 2));   // enough dishes that a full table doesn't keep getting the same ones
        menus = [...new Set(fresh.concat(none, rest))].slice(0, want).map(m => m.id);
      }
      const th = n === 1 ? `เปิดร้าน: ${TOOL_TH[nt] || 'มือเปล่า'}` : n === 12 ? 'งานเลี้ยงใหญ่' : nt ? `${TOOL_TH[nt]}มาแล้ว!` : RUN_MOOD[Math.floor(r() * RUN_MOOD.length)];
      const news = n === 12 ? '🎉 รอบสุดท้าย! ทุกเมนูที่เปิดมา' : nt ? `เครื่องครัวใหม่: ${TOOL_TH[nt]}` : 'จานซับซ้อนขึ้น ส่งของให้เพื่อนไว ๆ';
      out.push({ n, dur: n === 12 ? 120 : 75, gx: n === 12 ? 1.15 : 1, ...DAY_RAMP[n - 1], w: n <= 4 ? 0 : n <= 8 ? 1 : 2, th, news, menus, tools: open.slice(), newTool: nt, split: true, ings: DAY_INGS({ menus }) });
    }
    return out;
  }
  const DAYS = [
    { w: 0, th: 'เปิดร้าน: เขียงอย่างเดียว', news: 'หั่นผักผลไม้ วางลงจาน แล้วลากจานไปเสิร์ฟ', menus: ['fs_salad', 'fs_mango', 'fs_caprese'], tools: ['knife'] },
    { w: 0, th: 'หม้อทอดมาแล้ว', news: 'ของทอดขายดี! เฟรนช์ฟรายส์ต้องหั่นก่อนทอด', menus: ['fs_fries', 'fs_shrimp', 'fs_donut', 'fs_salad'], tools: ['knife', 'fryer'] },
    { w: 0, th: 'ทอดไม่หยุด', news: 'ลูกค้าเยอะขึ้น ส่งของให้กันไว ๆ', menus: ['fs_fries', 'fs_shrimp', 'fs_chicken', 'fs_donut', 'fs_mango'], tools: ['knife', 'fryer'] },
    { w: 0, th: 'เปิดกระทะ', news: 'กระทะมาแล้ว: ฮอทดอก ไข่ดาว', menus: ['fs_hotdog', 'fs_eggtoast', 'fs_fries', 'fs_shrimp', 'fs_salad'], tools: ['knife', 'fryer', 'pan'] },
    { w: 1, th: 'ร้านอาหารฝรั่ง', news: 'เบอร์เกอร์ สเต๊ก แซลมอน', menus: ['fs_burger', 'fs_steak', 'fs_salmon', 'fs_hotdog', 'fs_eggtoast'], tools: ['knife', 'fryer', 'pan'] },
    { w: 1, th: 'เปิดเตาอบ', news: 'พิซซ่า ครัวซองต์ แซนด์วิช', menus: ['fs_pizza', 'fs_croissant', 'fs_blt', 'fs_burger', 'fs_fries'], tools: ['knife', 'fryer', 'pan', 'oven'] },
    { w: 1, th: 'หม้อต้มมาแล้ว', news: 'สปาเกตตีต้องต้มก่อน', menus: ['fs_pasta', 'fs_pizza', 'fs_blt', 'fs_steak', 'fs_salmon'], tools: ['knife', 'pan', 'oven', 'pot', 'fryer'] },
    { w: 1, th: 'ครกบดของ', news: 'บดอะโวคาโดกับมันฝรั่งต้มในครก', menus: ['fs_taco', 'fs_mash', 'fs_burger', 'fs_pizza', 'fs_pasta'], tools: ['knife', 'fryer', 'pan', 'oven', 'pot', 'mortar'] },
    { w: 2, th: 'เตาถ่าน', news: 'ย่างไก่ ปิ้งหมู เผากุ้ง', menus: ['fs_kaiyang', 'fs_mooping', 'fs_shrimpgrill', 'fs_chicken', 'fs_mango'], tools: ['knife', 'grill', 'fryer'] },
    { w: 2, th: 'ครัวไทย', news: 'ต้มยำ ส้มตำ มาแล้ว', menus: ['fs_tomyum', 'fs_somtam', 'fs_kaiyang', 'fs_mooping', 'fs_shrimpgrill'], tools: ['knife', 'grill', 'pot', 'mortar'] },
    { w: 2, th: 'ซึ้งนึ่ง', news: 'ข้าวเหนียวกับปลาต้องนึ่ง', menus: ['fs_sticky', 'fs_mangosticky', 'fs_fish', 'fs_somtam', 'fs_tomyum'], tools: ['knife', 'steamer', 'grill', 'mortar', 'pot'] },
    { w: 2, th: 'งานเลี้ยงใหญ่', news: '🎉 รอบสุดท้าย! ทุกเมนู ทุกเครื่องครัว', menus: FS_MENUS.map(m => m.id), tools: COOK_TOOLS, dur: 120, gx: 1.15 },
  ].map((d, i) => ({ n: i + 1, dur: 75, gx: 1, ...DAY_RAMP[i], ...d, split: true, ings: DAY_INGS(d) }));   // with friends, ingredients and stations are always split round the table
  // simple counting: every ingredient is just "one piece" — no grams, no counts to pick
  for (const k in ING) { ING[k].opts = [1]; ING[k].d = 1 }
  for (const m of MENUS) for (const c of m.c) c[2] = 1;
  // market: staples are always in your pantry; everything else rides the shared belt and you must grab it first
  const STAPLES = Object.keys(ING).filter(k => ['carb', 'sauce'].includes(ING[k].cat) || k === 'butter');
  const BELT = { every: 1700, life: 12000, max: 7, hold: 6 };
  // difficulty: easy = few short menus, everything open, amounts/plating order don't count, longer waits, no prank cards
  const EASY_MENUS = ['hotdog', 'fries', 'donutice', 'croissant', 'friedshrimp', 'kaidao', 'kaiyang', 'mooping', 'salmon'];
  const DIFFS = { easy: { th: 'ง่าย', lifeX: 1.5, capMax: 3 }, normal: { th: 'ปกติ', lifeX: 1 }, chef: { th: 'เชฟ', lifeX: .8, capAdd: 1 } };
  const COMBO_MS = 25000;          // serve the next good dish within 25 s to keep the combo
  const GOLD_BONUS = 80, GOLD_EVERY = 40000, GOLD_LIFE = 35;   // the gold order everyone races for
  // prank cards (earned with combos, used on the cook who is ahead)
  // co-op: combo cards help your own kitchen (there is no other team to prank); the rival shop pranks you instead
  const CO_CARDS = [
    { id: 'patience', th: 'ลูกค้าใจเย็น', icon: '⏰', desc: 'ทุกออร์เดอร์ได้เวลาเพิ่ม 20 วินาที' },
    { id: 'tips', th: 'ทิปพิเศษ', icon: '💰', desc: '3 จานถัดไปได้คะแนน ×1.5' },
    { id: 'cleanup', th: 'ล้างจานหมด', icon: '🧽', desc: 'จานสกปรกของทุกคนสะอาดทันที' },
  ];
  const CARDS = [
    { id: 'power', th: 'ไฟดับ', icon: '🔌', desc: 'เครื่องครัวคนที่นำอยู่ใช้ไม่ได้ 6 วินาที', ms: 6000 },
    { id: 'smoke', th: 'ควันพริก', icon: '🌶️', desc: 'ควันพริกบังจอคนที่นำอยู่ 5 วินาที', ms: 5000 },
    { id: 'plates', th: 'จานกองท่วม', icon: '🍽️', desc: 'จานสกปรกไปกองที่อ่างคนที่นำอยู่ 2 ใบ', ms: 0 },
  ];
  // minimum time a mini-game can really take (ms) - the server refuses faster "cooking"
  const MIN_COOK = { knife: 400, mortar: 500, pan: 900, fryer: 900, pot: 900, oven: 300, grill: 300, steamer: 300, somtam: 600 };
  /* tournament: how many stay after a round with n cooks, and what kind of round it is */
  // the tournament is for an even number of cooks (4 or 6) and always has a 2v2 team round (Thai Kitchen Battle):
  //   6: qualifier (6→4) → mystery box (4, ranks only) → team 2v2 (winning pair goes on) → final 1v1 set meal
  //   4: mystery box (ranks only) → team 2v2 → final
  const TOUR_PLANS = { 4: [['mystery', 4], ['team', 2], ['final', 1]], 6: [['normal', 4], ['mystery', 4], ['team', 2], ['final', 1]] };
  const tourOk = n => !!TOUR_PLANS[n];
  const tourStep = (round, n0) => (TOUR_PLANS[n0] || TOUR_PLANS[4])[Math.max(0, Math.min((TOUR_PLANS[n0] || TOUR_PLANS[4]).length - 1, round - 1))];
  const tourKind = (round, n0) => tourStep(round, n0)[0];
  const tourKeep = (round, n0) => tourStep(round, n0)[1];
  const tourNext = n => n >= 5 ? n - 2 : n >= 3 ? 2 : 1;          // (old rule, kept for anything that still asks)
  /* round kinds for the tournament */
  const ROUNDS = { normal: { th: 'รอบคัดเลือก' }, mystery: { th: 'รอบวัตถุดิบปริศนา' }, team: { th: 'รอบทีม 2v2' }, final: { th: 'รอบชิงชนะเลิศ' } };
  // mystery box: 4 menus picked by the round seed -> the pantry is only their ingredients (+ 3 decoys)
  function mysteryBox(seed) {
    const r = mulberry((Math.floor(seed) % 2147483647) ^ 0xbeef); const pool = MENUS.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
    const pick = []; for (const t of [1, 2, 2, 3]) { const m = pool.find(x => x.tier === t && !pick.includes(x)); if (m) pick.push(m) }
    const ings = new Set(pick.flatMap(m => m.c.map(c => c[0]))); const others = Object.keys(ING).filter(k => !ings.has(k));
    for (let i = 0; i < 3 && others.length; i++) ings.add(others.splice(Math.floor(r() * others.length), 1)[0]);
    return { menus: pick.map(m => m.id), pantry: [...ings].sort() };
  }
  // 100% = identical; every point of average difference costs 2%
  function tasteAccuracy(actual, target) {
    const diff = TK.reduce((a, k) => a + Math.abs(actual[k] - target[k]), 0) / TK.length;
    return Math.round(clamp(100 - diff * 2));
  }
  // the best amount of each bottle for this plate and target (coordinate search in ½-spoon steps)
  function idealSeason(plate, target, keys) {
    const s = {}; let best = tasteAccuracy(tasteOf(plate, s), target); const K = keys && keys.length ? keys : SEASON_KEYS;
    for (let pass = 0; pass < 6; pass++) {
      let moved = false;
      for (const k of K) for (const d of [.5, -.5]) {
        const v = (s[k] || 0) + d; if (v < 0 || v > 8) continue;
        const t = { ...s, [k]: v }; const a = tasteAccuracy(tasteOf(plate, t), target);
        if (a > best) { best = a; if (v) s[k] = v; else delete s[k]; moved = true }
      }
      if (!moved) break;
    }
    return { season: s, acc: best };
  }
  // which bottles the menu uses (a hint, without the amounts)
  const seasonHint = m => Object.keys(m.s).filter(k => m.s[k] > 0);

  /* ---------- SCORING: Recipe 40 + Technique 25 + Taste 20 + Time 15 ---------- */
  function judgeDish(menu, plate, season, lifeF, target, easy) {
    const req = menu.c.map(([ing, st, amt], i) => ({ ing, st, amt, i }));
    const items = plate.map((it, j) => ({ ...it, j }));
    const usedI = new Set(), match = []; // {r, it, full}
    for (const r of req) { const it = items.find(x => !usedI.has(x.j) && x.ing === r.ing && x.st === r.st); if (it) { usedI.add(it.j); match.push({ r, it, full: true }) } }
    for (const r of req) { if (match.some(m => m.r === r)) continue; const it = items.find(x => !usedI.has(x.j) && x.ing === r.ing); if (it) { usedI.add(it.j); match.push({ r, it, full: false }) } }
    const extras = items.filter(x => !usedI.has(x.j));
    const missing = req.filter(r => !match.some(m => m.r === r && m.full));
    // completeness: right ingredient + right state = 1, right ingredient but wrong cooking = 0.4
    const comp = match.reduce((a, m) => a + (m.full ? 1 : .4), 0) / req.length;
    // 1) Recipe 40 = components 28 + amounts 8 + plating order 4
    const compPts = Math.max(0, comp * 28 - extras.length * 4);
    const amtPts = match.length ? 8 * match.reduce((a, m) => { const g = ING[m.r.ing]; const span = (Math.max(...g.opts) - Math.min(...g.opts)) || m.r.amt; return a + clamp(1 - Math.abs((+m.it.amt || g.d) - m.r.amt) / span, 0, 1) }, 0) / req.length : 0;
    const order = match.slice().sort((a, b) => a.it.j - b.it.j).map(m => m.r.i);
    let pairs = 0, good = 0; for (let a = 0; a < order.length; a++) for (let b = a + 1; b < order.length; b++) { pairs++; if (order[a] < order[b]) good++ }
    const seqPts = order.length < 2 ? (order.length ? 4 * comp : 0) : 4 * (good / pairs) * comp;
    const recipe = compPts + (easy ? 12 * comp : amtPts + seqPts);
    // 2) Technique 25 = how well each part was cooked (mini-game quality)
    const qs = match.map(m => m.it.st === 'raw' ? 100 : clamp(+m.it.q || 0));
    const tech = qs.length ? 25 * (qs.reduce((a, b) => a + b, 0) / qs.length / 100) * comp : 0;
    // 3) Taste 20 = how close the 5 tastes are to the target
    const actual = tasteOf(plate, season), tgt = target || targetOf(menu), acc = tasteAccuracy(actual, tgt);   // target may include a request
    const taste = 20 * acc / 100 * comp;
    // 4) Time 15 = how much of the order timer was left
    const time = 15 * clamp(lifeF, 0, 1) * comp;
    const total = Math.round(recipe + tech + taste + time);
    return {
      total, comp, recipe: Math.round(recipe), tech: Math.round(tech), taste: Math.round(taste), time: Math.round(time), acc, actual, target: tgt,
      parts: { comp: Math.round(compPts), amt: Math.round(amtPts), seq: Math.round(seqPts) },
      missing: missing.map(r => itemName(r)), extra: extras.map(x => itemName(x)),
    };
  }

  /* ---------- validation (never trust what a client sends) ---------- */
  function cleanPlate(plate) {
    if (!Array.isArray(plate) || !plate.length || plate.length > MAX_PLATE) return null;
    const out = [];
    for (const it of plate) {
      if (!it || typeof it !== 'object') return null;
      const g = ING[it.ing]; if (!g || typeof it.st !== 'string') return null;
      if (it.st !== 'raw' && !pathTo(it.ing, it.st)) return null;            // a state you can't actually cook
      const amt = 1;                                                           // amounts were removed: always one piece
      const q = it.st === 'raw' ? 100 : Math.round(+it.q); if (!(q >= 0 && q <= 100)) return null;
      out.push({ ing: it.ing, st: it.st, amt, q });
    }
    return out;
  }
  function cleanSeason(season) {
    const out = {}; if (!season || typeof season !== 'object') return out;
    for (const k of SEASON_KEYS) { const v = Math.round((+season[k] || 0) * 10) / 10; if (v > 0) out[k] = Math.min(10, v) }
    return out;
  }

  /* ---------- STAGES: the kitchen opens up as the round goes on ----------
     f = when it starts, as a fraction of the round (so it works for 2, 3 or 5 minute rounds) */
  // cap = how many orders hang at once (the ramp: 2 -> 3 -> 4), like a party game getting busier
  const STAGES = [
    { f: 0, th: 'เปิดร้าน', tools: ['knife', 'pan', 'fryer'], cap: 2 },
    { f: .18, th: 'ลูกค้าเริ่มเยอะ', tools: ['pot', 'oven', 'mortar'], cap: 3 },
    { f: .4, th: 'ครัวไทยเต็มรูปแบบ', tools: ['grill', 'steamer'], cap: 3 },
    { f: .6, th: 'ร้านแน่น!', tools: [], cap: 4 },
    { f: .8, th: 'Rush Hour!', tools: [], rush: true, cap: 4 },
  ];
  const RUSH_LIFE = .7, RUSH_X = 1.5;
  const menuTools = m => new Set(m.c.flatMap(([ing, st]) => pathTo(ing, st) || []));
  // everything that is open at stage i: tools, the menus you can make with them, the ingredients those menus use
  const STAGE_INFO = STAGES.map((s, i) => {
    const tools = new Set(STAGES.slice(0, i + 1).flatMap(x => x.tools));
    const menus = MENUS.filter(m => [...menuTools(m)].every(t => tools.has(t)));
    const ings = new Set(menus.flatMap(m => m.c.map(c => c[0])));
    return { i, th: s.th, rush: !!s.rush, cap: s.cap || 3, tools: [...tools], menus: menus.map(m => m.id), ings: [...ings], newTools: s.tools };
  });
  const stageAt = (elapsedMs, dur) => { let i = 0; STAGES.forEach((s, j) => { if (elapsedMs >= s.f * dur * 1000) i = j }); return i };
  const stageStart = (i, dur) => STAGES[i] ? STAGES[i].f * dur * 1000 : null;
  const itemTools = it => pathTo(it.ing, it.st) || [];

  /* ---------- GAME INSTANCE (one per player in solo, one per team in team mode) ---------- */
  // opt: { allowed: [menu ids] (mystery), allOpen: every station open from the start, judge: {k,d,...}, sets: set-meal bonus, x: score multiplier }
  function createGame(gen, dur, t0, opt = {}) {
    const g = { gen, dur, t0, end: t0 + dur * 1000, seq: buildSeq(gen), tickets: [], next: 0, score: 0, served: 0, dirty: 0, washed: 0, opt, courses: {}, sets: 0, combo: 0, lastServe: 0, card: null, cards: 0, block: 0 };
    const rq = mulberry((Math.floor(gen) % 2147483647) ^ 0x7e9);
    g.stage = now => stageAt(now - t0, dur);
    // what is open now (all stations from the start in the mystery round and the final)
    const Q = opt.quota || null; if (Q) { g.goal = Q.goal; g.hearts = HEARTS; g.result = null; g.doneAt = 0; g.meter = METER.start; g.mt = t0 }
    const meterAt = now => !Q ? 0 : g.result ? g.meter : Math.max(0, Math.min(METER.max, g.meter - Q.drain * Math.max(0, now - g.mt) / 1000));
    const bump = (now, d) => { if (!Q || g.result) return; g.meter = Math.max(0, Math.min(METER.max, meterAt(now) + d)); g.mt = Math.max(now, g.mt) };
    g.meterAt = meterAt;
    const finish = (res, now) => { if (!Q || g.result) return; g.meter = meterAt(now); g.result = res; g.doneAt = now; g.tickets = [] };
    g.finish = finish; g.base = 0; g.pauseUntil = 0;
    const goalHit = now => { if (opt.onGoal) opt.onGoal(now); else finish('clear', now) };   // continuous play: the match moves on to the next round
    g.info = now => { const si = g.stage(now); if (opt.day) { const s2 = STAGE_INFO[si]; return { ...s2, cap: Q ? Q.cap : s2.cap, rush: Q ? false : s2.rush, tools: opt.day.tools, menus: opt.day.menus, ings: opt.day.ings } } const st = STAGE_INFO[opt.allOpen ? Math.max(si, 2) : si]; return opt.allOpen ? { ...st, rush: STAGE_INFO[si].rush, cap: opt.easy ? STAGE_INFO[si].cap : Math.max(3, STAGE_INFO[si].cap) } : st };
    const add = born => {
      const st = g.info(born); let m = null; const ok = id => st.menus.includes(id) && (!opt.allowed || opt.allowed.includes(id));
      // co-op table: whose order is next (the cook with the fewest orders)
      let own = null; if (opt.owners && opt.owners.length) { const cnt = id => g.tickets.filter(t => t.own === id).length; own = opt.owners.slice().sort((a, b) => cnt(a) - cnt(b) || ((g.rr = (g.rr || 0) + 1) % 2 ? -1 : 1))[0] }
      // no repeats: avoid what is already hanging and what this cook just had (the last 3); still random among the rest
      if (opt.day) { const pool = opt.day.menus.filter(ok), cur = g.tickets.map(t => t.id), hist = ((g.hist = g.hist || {})[own || '_'] = g.hist[own || '_'] || []);
        const score = id => cur.filter(x => x === id).length * 8 + (hist[hist.length - 1] === id ? 5 : 0) + (hist.includes(id) ? 2 : 0) + rq() * 1.5;
        const L = pool.map(id => [id, score(id)]).sort((a, b) => a[1] - b[1]); if (L.length) { m = MENU_BY_ID[L[0][0]]; hist.push(m.id); if (hist.length > 3) hist.shift() } }
      if (!m) for (let n = 0; n < g.seq.length; n++) { const c = g.seq[g.next % g.seq.length]; g.next++; if (ok(c.id)) { m = c; break } }
      if (!m) m = MENU_BY_ID[(opt.allowed || st.menus).find(ok) || st.menus[0]];
      const rush = st.rush;
      // from stage 2 on (or always in the final) some customers ask for a different taste
      let req = null; const x = rq();
      if (!opt.easy && (g.stage(born) >= 1 || opt.allOpen) && x < .4) { const tgt = targetOf(m); const opts = REQS.filter(q => !q.need || tgt[q.k] >= q.need); req = opts[Math.floor(rq() * opts.length)] || null } else rq();
      // Hell's Kitchen table order: 2-3 courses for one table, served appetizer -> main -> dessert
      if (opt.hell && g.stage(born) >= 1 && born < g.end - 90000 && !g.tickets.some(t => t.set) && rq() < .5) {
        const free = cap(born) - g.tickets.filter(t => !t.gold && !t.chal).length, pool = st.menus.filter(ok), by = c => pool.filter(id => courseOf(id) === c), pick = L => L.length ? L[Math.floor(rq() * L.length)] : null;
        const m1 = courseOf(m.id) === 'main' ? m.id : pick(by('main')) || m.id, m2 = pick(by('side').filter(id => id !== m1)) || pick(pool.filter(id => id !== m1)), m3 = free >= 2 ? pick(by('dessert').filter(id => id !== m1 && id !== m2)) : null; const ids = [m2, m1, m3].filter(Boolean);
        if (free >= 1 && ids.length >= 2) { const sg = (g.sid = (g.sid || 0) + 1), life = Math.round(ids.reduce((a, id) => a + LIFE[MENU_BY_ID[id].tier], 0) * .75 * (opt.lifeX || 1));
          ids.forEach((id, i) => g.tickets.push({ own: null, k: (g.kseq = (g.kseq || 0) + 1), id, born, life, rush: false, req: null, set: { g: sg, i: i + 1, n: ids.length, th: `โต๊ะ ${sg}`, course: i === 0 && ids.length > 1 && courseOf(id) !== 'main' ? HK_COURSE.side : HK_COURSE[courseOf(id)] || HK_COURSE.main } })); return }
      }
      g.tickets.push({ own, k: (g.kseq = (g.kseq || 0) + 1), id: m.id, born, life: Math.round(LIFE[m.tier] * (rush ? RUSH_LIFE : 1) * (opt.lifeX || 1)), rush, req });
    };
    g.add = add;
    const cap = now => { const c = g.info(now).cap + (opt.capAdd || 0); return opt.capMax ? Math.min(opt.capMax, c) : c };
    const refill = now => { if (now < g.pauseUntil) return; while (g.tickets.filter(t => !t.gold && !t.chal).length < cap(now)) add(now) };
    refill(t0);
    g.over = now => Q ? (!!g.result && now > g.doneAt + 900) || now > t0 + 15 * 60000 : now > g.end + 1500;
    g.tick = now => {
      const out = [];
      for (const tk of g.tickets) if (now > tk.born + tk.life * 1000) { out.push({ k: tk.k, th: MENU_BY_ID[tk.id].th, gold: !!(tk.gold || tk.chal) }); if (!tk.gold && !tk.chal) { g.score = Math.max(0, g.score - (tk.set ? 5 : 10)); g.combo = 0; if (Q && !g.result) { g.hearts--; bump(now, -METER.miss) } } }
      if (Q && !g.result && now > t0 && meterAt(now) <= 0) { finish('fail', now); g.changed = true }
      if (out.length && !g.result) g.tickets = g.tickets.filter(t => !out.some(o => o.k === t.k));
      // the kitchen gets busier: more orders hang at once as the stages go on
      if (!g.over(now) && !g.result) { const before = g.tickets.length; refill(now); if (g.tickets.length !== before) g.changed = true }
      return out;
    };
    g.serve = (payload, now) => {
      if (g.over(now) || g.result) return { ok: false, msg: 'หมดเวลาแล้ว' };
      const plate = cleanPlate(payload && payload.plate); if (!plate) return { ok: false, msg: 'ข้อมูลจานไม่ถูกต้อง' };
      const open = g.info(now).tools;
      if (plate.some(it => itemTools(it).some(t => !open.includes(t)))) return { ok: false, msg: 'ใช้เครื่องครัวที่ยังไม่เปิด' };
      const season = cleanSeason(payload.season); g.tick(now);
      const sel = payload.sel;
      let best = null;
      const waiting = tk => tk.set && g.tickets.some(t => t.set && t.set.g === tk.set.g && t.set.i < tk.set.i);   // Hell's Kitchen: an earlier course of this table is still out
      let early = null;
      for (const tk of g.tickets) {
        if (opt.owners && payload.by && tk.own && tk.own !== payload.by) continue;     // you plate YOUR order (Family Style)
        if (waiting(tk)) { if (!early) { const r0 = judgeDish(MENU_BY_ID[tk.id], plate, season, 1); if (r0.comp >= .9) early = tk } continue }
        const m0 = MENU_BY_ID[tk.id], m = opt.noSauce ? { ...m0, c: fsComp(m0) } : m0; const lifeF = 1 - (now - tk.born) / (tk.life * 1000);
        const tg = targetFor(m, tk.req, opt.judge); const r = judgeDish(m, plate, opt.noTaste ? idealSeason(plate, tg).season : season, lifeF, tg, opt.easy);
        const rank = r.comp * 1000 + (tk.k === sel ? 1 : 0) * 500 + r.total;
        if (!best || rank > best.rank) best = { rank, tk, m, r };
      }
      if ((!best || best.r.comp < .5) && early) { const first = g.tickets.filter(t => t.set && t.set.g === early.set.g).sort((a, b) => a.set.i - b.set.i)[0];
        return { ok: false, hk: true, msg: `👨‍🍳 ${early.set.th}: ต้องส่ง${first.set.course} (${MENU_BY_ID[first.id].th}) ก่อน ห้ามข้ามคอร์ส!` } }
      const cookedQ = (() => { const L = plate.filter(it => it.st !== 'raw'); return L.length ? Math.round(L.reduce((a, it) => a + (+it.q || 0), 0) / L.length) : 100 })();
      if (best && best.tk.set && best.r.comp >= .5 && (best.r.total < HK_MIN || cookedQ < 40)) return { ok: false, hk: true, msg: `👨‍🍳 เชฟหัวหน้าตีกลับ! ${MENU_BY_ID[best.tk.id].th} ของ${best.tk.set.th}${cookedQ < 40 ? ` ทำไม่ได้มาตรฐาน (ฝีมือ ${cookedQ}%)` : ` ได้แค่ ${best.r.total}/100`} · โต๊ะคอร์สต้องผ่านมาตรฐาน ทำใหม่!` };
      if (!best || best.r.comp < .5) {
        const tk0 = g.tickets.find(t => t.k === sel) || g.tickets[0]; if (!tk0) return { ok: false, msg: 'ยังไม่มีออร์เดอร์' }; const m = MENU_BY_ID[tk0.id];
        const r = judgeDish(m, plate, season, 1);
        return { ok: false, msg: r.missing.length ? `ยังไม่ใช่ ${m.th} · ขาด: ${r.missing.join(', ')}` : `ยังไม่ตรงกับออร์เดอร์ไหนเลย` };
      }
      const x = TIER_X[best.m.tier] * (best.tk.rush ? RUSH_X : 1) * (opt.x || 1);
      let pts = Math.round(best.r.total * x), bonus = 0;
      // set meal: one main + one side + one dessert served -> bonus
      if (opt.sets) { const c = courseOf(best.m.id); g.courses[c] = (g.courses[c] || 0) + 1;
        if (g.courses.main && g.courses.side && g.courses.dessert) { ['main', 'side', 'dessert'].forEach(k => g.courses[k]--); g.sets++; bonus = SET_BONUS } }
      // combo: good dishes served one after another (within COMBO_MS) multiply the score
      const good = best.r.comp >= .9 && best.r.total >= 55;
      g.combo = good && now - g.lastServe <= (opt.comboMs || COMBO_MS) ? g.combo + 1 : good ? 1 : 0; if (good) g.lastServe = now;
      const cx = 1 + Math.min(.5, Math.max(0, g.combo - 1) * .1);
      // the score report: where every point of this dish came from (the dish's 100-point judging × the menu's tier, then the extras)
      const why = { recipe: Math.round(best.r.recipe * x), tech: Math.round(best.r.tech * x), taste: Math.round(best.r.taste * x), time: Math.round(best.r.time * x) };
      const base = pts; pts = Math.round(pts * cx); why.combo = pts - base; why.round = base - why.recipe - why.tech - why.taste - why.time;
      // the gold order: first cook to serve it wins the bonus
      let gold = 0; if (best.tk.gold) gold = GOLD_BONUS;
      // challenges: the Pressure Test dish pays for quality, the speed round pays half again
      if (best.tk.chal) why.chal = Math.round(30 + best.r.total * .7);
      if (now < (g.boostUntil || 0)) why.chal = (why.chal || 0) + Math.round(pts * .5);
      pts += why.chal || 0;
      // a set order is done when its last dish goes out
      let setDone = null; if (best.tk.set) { const S2 = best.tk.set; g.setQ = g.setQ || {}; const q = g.setQ[S2.g] = (g.setQ[S2.g] || 0) + best.r.total;
        if (!g.tickets.some(t => t !== best.tk && t.set && t.set.g === S2.g)) { const avg = Math.round(q / S2.n), wow = avg >= HK_GOOD; bonus += SET_BONUS + 15 * S2.n + (wow ? 40 : 0); g.sets++; setDone = { n: S2.n, th: S2.th, avg, wow } } }
      pts += bonus + gold; g.score += pts; g.served++; bump(now, meterGain(pts)); if (Q && g.served >= g.goal) goalHit(now); if (!opt.noWash) g.dirty++;
      // every 3rd combo step earns a prank card (one at a time)
      why.set = bonus; why.gold = gold;
      if (g.tips > 0) { const tip = Math.round(pts * .5); pts += tip; g.score += tip; why.tip = tip; g.tips-- }
      let card = null; const deck = opt.coop ? CO_CARDS : CARDS; if (!opt.noCards && g.combo >= 3 && g.combo % 3 === 0 && !g.card) { card = deck[(g.cards++ * 7 + g.served) % deck.length].id; g.card = card }
      g.tickets = g.tickets.filter(t => t !== best.tk); refill(now);
      return { ok: true, pts, why, bonus, gold, setDone, chal: best.tk.chal || null, combo: g.combo, cx: Math.round(cx * 100) / 100, card, k: best.tk.k, id: best.m.id, th: best.m.th, tier: best.m.tier, x: Math.round(x * 100) / 100, rush: best.tk.rush, req: best.tk.req, br: best.r, plate, goldK: best.tk.gold ? best.tk.k : null };
    };
    g.clear = () => { g.dirty++; return { ok: true } };
    g.wash = now => { if (g.over(now)) return { ok: false }; if (g.dirty <= 0) return { ok: false, msg: 'ยังไม่มีจานสกปรก' }; g.dirty--; g.washed++; g.score += 3; return { ok: true } };
    g.botServe = (pts, now, who) => { if (g.result) return; g.score += pts; g.served++; bump(now, meterGain(pts)); let i = who ? g.tickets.findIndex(t => t.own === who) : -1; if (i < 0) i = g.tickets.findIndex(t => !t.gold); if (i > -1) g.tickets.splice(i, 1); if (Q && g.served >= g.goal) { goalHit(now); return } refill(now) };
    g.snap = now => {
      const si = g.stage(now), nx = stageStart(si + 1, dur);
      return { gen: g.gen, score: g.score, served: g.served, stage: si, dq: Q ? { goal: g.goal - g.base, served: g.served - g.base, round: opt.roundNo || 0, pause: Math.max(0, g.pauseUntil - now), meter: Math.round(meterAt(now) * 10) / 10, drain: g.result || now < t0 ? 0 : Q.drain, max: METER.max, result: g.result } : null, allOpen: !!opt.allOpen, endIn: Math.round(g.end - now), nextIn: nx == null ? null : Math.max(0, Math.round(t0 + nx - now)),
        judge: opt.judge || null, sets: opt.sets ? { n: g.sets, have: { ...g.courses } } : null,
        combo: g.combo, comboLeft: g.combo ? Math.max(0, Math.round(g.lastServe + COMBO_MS - now)) : 0, card: g.card, block: Math.max(0, Math.round(g.block - now)),
        boost: Math.max(0, Math.round((g.boostUntil || 0) - now)), tickets: g.tickets.map(t => ({ own: t.own || null, set: t.set || null, chal: t.chal || null, k: t.k, id: t.id, life: t.life, rush: t.rush, req: t.req, gold: !!t.gold, left: Math.round(Math.min(t.life * 1000, t.born + t.life * 1000 - now)) })) };
    };
    return g;
  }

  /* ---------- MATCH: solo (everyone for themselves) or teams of 2 (2v2 / 2v2v2) ----------
     Team rules: each teammate gets HALF of the pantry. Recipes need both halves,
     so you must pass ingredients to your teammate (and only to your teammate).
     The match keeps a ledger of what each player received, so nobody can use an
     ingredient that neither their pantry nor their teammate gave them.          */
  /* ---------- chef skills: every chef avatar has one, applied here by the referee (so nobody can fake it) ---------- */
  const SKILLS = [
    { id: 'taste', th: 'ลิ้นทอง', d: 'คะแนนรสชาติทุกจาน +25%' },
    { id: 'knife', th: 'มือมีดเทพ', d: 'หั่น / ตำ ได้คุณภาพอย่างน้อย 85%' },
    { id: 'heat', th: 'เจ้าแห่งไฟ', d: 'ผัด / ทอด / ย่าง คุณภาพ +10' },
    { id: 'calm', th: 'ลูกค้ารักรอ', d: 'ลูกค้ารอนานขึ้น 20% (เดี่ยว/ทีม)' },
    { id: 'charm', th: 'เสน่ห์ปลายจวัก', d: 'ได้ทิปทุกจาน +10%' },
    { id: 'combo', th: 'มือไวคอมโบ', d: 'ต่อคอมโบได้นานขึ้น 10 วินาที' },
  ];
  const skillOf = chef => SKILLS[Number.isInteger(+chef) && +chef >= 0 && +chef < SKILLS.length ? +chef : 0].id;
  function splitPantry(gen) {
    const r = mulberry((Math.floor(gen) % 2147483647) ^ 0x5eed);
    const keys = Object.keys(ING).sort();
    for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]] }
    return [keys.filter((_, i) => i % 2 === 0), keys.filter((_, i) => i % 2 === 1)];
  }
  // round: 'normal' | 'mystery' | 'final' (tournament rounds; a normal game is 'normal')
  function createMatch({ gen, dur, t0, mode, players, rand = Math.random, round = 'normal', diff = 'normal', tut = false, market = false, day = 0 }) {
    const RUN = mode === 'coop' && day ? fsRun(gen) : null;
    const DAY = RUN && RUN[day - 1] ? RUN[day - 1] : null; if (DAY) { dur = DAY.dur; market = !!DAY.market; diff = 'normal' }
    const team = mode === 'team' && (players.length === 4 || players.length === 6);   // 2v2 or 2v2v2
    const coop = mode === 'coop';                                                       // everyone in ONE kitchen, shared plates and score
    const M = { gen, dur, t0, day: DAY ? DAY.n : 0, mode: team ? 'team' : coop ? 'coop' : 'solo', games: {}, queue: [], lastStage: 0, finished: false, round: ROUNDS[round] ? round : 'normal', nextGold: tut ? Infinity : t0 + GOLD_EVERY * .9, golds: 0 };
    const box = M.round === 'mystery' ? mysteryBox(gen) : null;
    const judge = M.round === 'final' ? JUDGES[Math.floor(gen / 7) % JUDGES.length] : null;
    const D = DIFFS[diff] ? diff : 'normal'; M.diff = D;
    const dopt = { lifeX: DIFFS[D].lifeX * (coop && players.length > 1 ? 1.25 : 1), capMax: DIFFS[D].capMax ? DIFFS[D].capMax + (coop ? Math.floor(players.length / 2) : 0) : 0, capAdd: (DIFFS[D].capAdd || 0) + (coop ? Math.floor((players.length - 1) / 2) + (players.length > 1 ? 1 : 0) : 0), easy: D === 'easy', noCards: D === 'easy', coop };
    const gopt = tut ? { easy: true, noCards: true, allOpen: true, allowed: ['hotdog'], capMax: 1, lifeX: 20 } : { ...dopt, ...(M.round === 'mystery' ? { allowed: box.menus, allOpen: true } : M.round === 'final' ? { allOpen: true, judge, sets: true } : D === 'easy' ? { allowed: EASY_MENUS, allOpen: true } : {}) };
    if (DAY) { const n = players.length; Object.assign(gopt, { owners: coop ? players.map(p => p.id) : null, noSauce: true, quota: { goal: DAY.goal + Math.floor((n - 1) * .75), cap: n, drain: DAY.drain * (n > 1 ? 1 : .8) }, lifeX: DAY.px * (n > 1 ? 1.15 : 1), capAdd: 0, capMax: 0, allowed: DAY.menus, day: { tools: DAY.tools, menus: DAY.menus, ings: DAY.ings }, noWash: !DAY.wash, noTaste: !DAY.season, noCards: !DAY.cards, easy: false }); delete gopt.allOpen; delete gopt.capMax }
    if (coop && players.length >= 4 && !gopt.allowed) gopt.allOpen = true;
    if (!tut && !DAY && !coop) gopt.hell = true;   // Hell's Kitchen table orders (courses in order) show up in normal / team / tournament kitchens
    // MasterChef-style challenges at fixed points of the match (the same for everyone); ท้าชิง (duel) is started by a player
    M.chal = !tut && !DAY && !coop ? (dur >= 600 ? [{ at: t0 + dur * 1000 * .2, type: 'pressure' }, { at: t0 + dur * 1000 * .42, type: 'speed' }, { at: t0 + dur * 1000 * .64, type: 'pressure' }, { at: t0 + dur * 1000 * .85, type: 'speed' }] : dur <= 120 ? [{ at: t0 + dur * 1000 * .4, type: 'pressure' }] : [{ at: t0 + dur * 1000 * .3, type: 'pressure' }, { at: t0 + dur * 1000 * .62, type: 'speed' }]) : []; M.chalN = 0; M.chalUntil = 0; M.chalNow = null; M.duels = [];   // big kitchens: every station open from the start, so nobody stands idle
    M.players = players.map((p, i) => ({ id: p.id, bot: p.bot || null, sk: p.sk || 1, chef: Number.isInteger(+p.chef) ? +p.chef : 0, skill: skillOf(p.chef), team: coop ? 0 : team ? Math.floor(i / 2) : i, slot: team ? i % 2 : coop ? i : 0, recv: {}, served: 0, next: 0, ledger: {}, cooking: null }));
    const split = team ? splitPantry(gen) : null;
    M.market = !!(market && !team && !box && !tut && diff !== 'easy');
    // plate holders on the pass: a team shares 3 plates (and one pantry + one set of stations), a solo cook has 2. Co-op / tutorial keep the old single plate
    M.plates = !coop && !tut && !DAY ? {} : null;
    // co-op (Family Style): everyone has DIFFERENT ingredients and DIFFERENT stations; pass only to the cook on your left or right
    const n = players.length;
    const splitN = (keys, seed) => { const r = mulberry((Math.floor(gen) % 2147483647) ^ seed); const k = keys.slice().sort(); for (let i = k.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [k[i], k[j]] = [k[j], k[i]] } return Array.from({ length: n }, (_, s) => k.filter((_, i) => i % n === s)) };
    const doSplit = !DAY || DAY.split;
    const ringPantry = coop && n > 1 && doSplit ? splitN(DAY ? DAY_INGS(DAY) : M.market ? STAPLES : Object.keys(ING), 0x51) : null;
    // stations: deal the ones that open first round the table first, so everyone has something to cook from the start
    const ringTools = coop && n > 1 && D !== 'easy' && doSplit ? (() => { const r = mulberry((Math.floor(gen) % 2147483647) ^ 0x7a); const out = Array.from({ length: n }, () => []); let k = Math.floor(r() * n);
      for (const st of (DAY ? [{ tools: DAY.tools }] : STAGES)) { const g2 = st.tools.slice(); for (let i = g2.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [g2[i], g2[j]] = [g2[j], g2[i]] } for (const t of g2) { out[k % n].push(t); k++ } }
      return out })() : null;
    if (coop) { M.nextChaos = !tut && D !== 'easy' && (!DAY || DAY.rival) ? t0 + dur * 1000 * .3 : Infinity }
    if (DAY && !DAY.gold) M.nextGold = Infinity; if (DAY && DAY.gold) M.nextGold = t0 + dur * 1000 * .25;
    if (M.market) { M.belt = []; M.beltId = 0; M.beltNext = t0 }
    M.players.forEach(p => { p.pts = 0; p.block = 0; p.tools = ringTools ? ringTools[p.slot] : null; p.pantry = team ? (box ? box.pantry : null) : ringPantry ? ringPantry[p.slot] : box ? box.pantry : M.market ? STAPLES.slice() : null; if (!M.games[p.team]) { const mates = M.players.filter(q => q.team === p.team && !q.bot);
      // skills that change the whole kitchen (only where the kitchen belongs to you or your team; the co-op table keeps its shared rules)
      const o = DAY || coop ? gopt : { ...gopt, lifeX: (gopt.lifeX || 1) * (mates.some(q => q.skill === 'calm') ? 1.2 : 1), comboMs: mates.some(q => q.skill === 'combo') ? COMBO_MS + 10000 : 0 };
      M.games[p.team] = createGame(gen, dur, t0, o); if (M.plates) M.plates[p.team] = Array.from({ length: team ? 3 : 2 }, () => ({ items: [], season: {}, dirty: false })) } });
    const P = id => M.players.find(p => p.id === id);
    // ---- continuous co-op (Family Style): clearing a round's dishes opens the next round in the SAME match:
    //      new menus and stations, a fresh deal of ingredients/stations round the table, a short pause for the round card
    if (DAY && coop) {
      const dealTools = (tools, seed) => { const r = mulberry((Math.floor(gen) % 2147483647) ^ 0x7a ^ seed); const out = Array.from({ length: n }, () => []); let k = Math.floor(r() * n); const g2 = tools.slice(); for (let i = g2.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [g2[i], g2[j]] = [g2[j], g2[i]] } for (const t of g2) { out[k % n].push(t); k++ } return out };
      const deal = Dd => { const sp = n > 1 && Dd.split; const pan = sp ? splitN(DAY_INGS(Dd), 0x51 ^ Dd.n) : null; const tl = sp && D !== 'easy' ? dealTools(Dd.tools, Dd.n) : null; M.players.forEach(p => { p.tools = tl ? tl[p.slot] : null; p.pantry = pan ? pan[p.slot] : null }) };
      gopt.roundNo = DAY.n;
      gopt.onGoal = now => {
        const g0 = M.games[M.players[0].team], nx = RUN[M.day]; if (!nx) { g0.finish('clear', now); return }
        const Q = gopt.quota, v = Math.min(METER.max, g0.meterAt(now) + ROUND_BONUS);
        M.day = nx.n; gopt.roundNo = nx.n; Q.goal = nx.goal + Math.floor((n - 1) * .75); Q.cap = n; Q.drain = nx.drain * (n > 1 ? 1 : .8);
        gopt.lifeX = nx.px * (n > 1 ? 1.15 : 1); gopt.allowed = nx.menus; gopt.day = { tools: nx.tools, menus: nx.menus, ings: nx.ings };
        g0.base = g0.served; g0.goal = g0.served + Q.goal; g0.meter = v; g0.mt = now + ROUND_PAUSE; g0.pauseUntil = now + ROUND_PAUSE; g0.tickets = []; g0.changed = true;
        deal(nx); M.lastDeal = now; M.roundEv = { type: 'round', day: nx.n } };   // (lastDeal: refusals right after a re-deal are honest races, not cheating)
    }
    const mateOf = p => team ? M.players.find(q => q.team === p.team && q !== p) : null;
    const ringOf = p => { const i = M.players.indexOf(p); return { l: M.players[(i - 1 + n) % n], r: M.players[(i + 1) % n] } };
    // which way round the table is closer from a to b ('l' or 'r')
    const toward = (a, b) => { const i = M.players.indexOf(a), j = M.players.indexOf(b); const right = (j - i + n) % n; return right <= n - right ? 'r' : 'l' };
    const has = (p, ing) => !p.pantry || p.pantry.includes(ing);
    // can p use these ingredients? (own pantry, or received from the teammate). take=true actually uses them up
    function own(p, ings, take) {
      const need = {}; for (const ing of ings) if (!has(p, ing)) need[ing] = (need[ing] || 0) + 1;
      for (const [ing, n] of Object.entries(need)) if ((p.recv[ing] || 0) < n) return ing;
      if (take) for (const [ing, n] of Object.entries(need)) p.recv[ing] -= n;
      return null;
    }
    M.stage = now => M.games[M.players[0].team].stage(now);
    const openTools = now => M.games[M.players[0].team].info(now).tools;
    /* ---- cooking ledger: the server remembers every cooked item, so a plate can only hold food that was really cooked ---- */
    const L = (p, key) => (p.ledger[key] = p.ledger[key] || []);
    M.cookStart = (id, tool, now) => { const p = P(id); if (!p || p.bot || !MIN_COOK[tool]) return { ok: false }; if (p.tools && !p.tools.includes(tool)) return { ok: false, msg: 'เครื่องครัวนี้อยู่ที่สเตชันของเพื่อน' }; if (M.games[p.team].block > now || p.block > now) return { ok: false, msg: 'ไฟดับ! รอแป๊บ' }; if (team && M.players.some(q => q.team === p.team && q !== p && q.cooking && q.cooking.tool === tool && now - q.cooking.t < 25000)) return { ok: false, busy: true, msg: 'เพื่อนร่วมทีมกำลังใช้เครื่องครัวนี้อยู่' }; p.cooking = { tool, t: now }; return { ok: true } };
    M.cook = (id, c, now) => {
      const p = P(id); if (!p || p.bot) return { ok: false, msg: 'ไม่ได้อยู่ในเกม' };
      if (M.games[p.team].over(now)) return { ok: false, msg: 'หมดเวลาแล้ว' };
      if (!c || typeof c !== 'object' || !ING[c.ing] || !TR[c.tool]) return { ok: false, msg: 'ข้อมูลไม่ถูกต้อง' };
      const to = TR[c.tool][c.ing + ':' + c.st]; if (!to || to !== c.to) return { ok: false, msg: 'ทำแบบนี้ไม่ได้' };
      if (!openTools(now).includes(c.tool)) return { ok: false, msg: 'เครื่องครัวยังไม่เปิด' };
      if (p.tools && !p.tools.includes(c.tool)) return { ok: false, msg: 'เครื่องครัวนี้อยู่ที่สเตชันของเพื่อน' };  // (a power cut only stops new cooking; food already on the fire finishes)
      const kind = c.tool === 'mortar' && to === 'somtam' ? 'somtam' : c.tool;
      if (!p.cooking || p.cooking.tool !== c.tool || now - p.cooking.t < MIN_COOK[kind] * .8) return { ok: false, msg: 'ทำเร็วเกินจริง' };   // 20% slack for network jitter
      p.cooking = null;
      let inQ = 100;
      if (c.st === 'raw') { if (own(p, [c.ing], true)) return { ok: false, msg: `คุณไม่มี ${ING[c.ing].th}` } }
      else { const l = L(p, c.ing + ':' + c.st); if (!l.length) return { ok: false, msg: 'ไม่มีของชิ้นนี้' }; l.sort((a, b) => b - a); inQ = l.shift() }
      let q = Math.round(clamp(+c.q || 0));
      if (p.skill === 'knife' && (c.tool === 'knife' || c.tool === 'mortar')) q = Math.max(q, 85);
      if (p.skill === 'heat' && ['pan', 'fryer', 'grill'].includes(c.tool)) q = Math.min(100, q + 10);
      const out = c.st === 'raw' ? q : Math.round((inQ + q) / 2);
      L(p, c.ing + ':' + to).push(out);
      return { ok: true, q: out };
    };
    // turn the client's plate into the server's version: cooked items must come from the ledger (with the server's quality)
    function proven(p, plate, take) {
      const used = {}; const out = [];
      for (const it of plate) {
        if (it.st === 'raw') { out.push(it); continue }
        const key = it.ing + ':' + it.st; const l = (p.ledger[key] || []).slice().sort((a, b) => b - a); const k = used[key] || 0;
        if (k >= l.length) return { miss: it };
        out.push({ ...it, q: l[k] }); used[key] = k + 1;
      }
      if (take) for (const [key, n] of Object.entries(used)) { const l = p.ledger[key].sort((a, b) => b - a); l.splice(0, n) }
      return { plate: out };
    }
    /* ---- ท้าชิง: challenge someone above you for 60 s; whoever earns more in that time wins the bonus ----
       a person is judged on their real score; a bot (simulated on the host's screen) is given a weaker result by the referee */
    M.duel = (id, target, now) => {
      const p = P(id); if (!p || p.bot || M.mode !== 'solo' || tut) return { ok: false, msg: 'ท้าชิงได้ในโหมดเดี่ยว' };
      const g = M.games[p.team]; if (g.over(now) || now < t0) return { ok: false, msg: 'หมดเวลาแล้ว' };
      if (M.stage(now) < 1) return { ok: false, msg: 'ท้าชิงได้ตั้งแต่ช่วงที่ 2' }; if ((p.dueled || 0) >= (dur >= 600 ? 2 : 1)) return { ok: false, msg: dur >= 600 ? 'ท้าชิงได้เกมละ 2 ครั้ง' : 'ท้าชิงได้เกมละครั้ง' };
      if (now > g.end - DUEL_MS) return { ok: false, msg: 'เหลือเวลาไม่พอท้าชิงแล้ว' };
      const b = typeof target === 'string' ? target.slice(0, 40) : ''; const q = P(b); if (!b || q === p) return { ok: false, msg: 'เลือกคู่ท้าชิงไม่ถูกต้อง' };
      if (M.duels.some(d => !d.done && [d.a, d.b].some(x => x === id || x === b))) return { ok: false, msg: 'คนนี้กำลังท้าชิงอยู่' };
      p.dueled = (p.dueled || 0) + 1; const d = { a: id, b, human: !!q, t0: now, t1: now + DUEL_MS, sa: g.score, sb: q ? M.games[q.team].score : 0, bot: q ? 0 : Math.round(30 + rand() * 50), done: false };
      M.duels.push(d); return { ok: true, events: [{ type: 'duel', st: 'start', a: id, b, ms: DUEL_MS, human: !!q }] };
    };
    const duelOf = (id, now) => { const d = M.duels.find(x => !x.done && (x.a === id || x.b === id)); if (!d) return null; const ga = M.games[P(d.a).team].score - d.sa, gb = d.human ? M.games[P(d.b).team].score - d.sb : null; return { a: d.a, b: d.b, left: Math.max(0, d.t1 - now), ga, gb } };
    M.teams = () => Object.entries(M.games).map(([t, g]) => ({ t: +t, score: g.score, served: g.served, members: M.players.filter(p => p.team === +t).map(p => p.id) }));
    M.snap = (id, now) => {
      const p = P(id); if (!p) return null; const g = M.games[p.team]; const s = g.snap(now); const mate = mateOf(p);
      return { ...s, mode: M.mode, day: M.day, noWash: !!g.opt.noWash, noTaste: !!g.opt.noTaste, round: M.round, diff: M.diff, plates: M.plates ? M.plates[p.team].map(x => ({ items: x.items.map(i => ({ ...i })), season: { ...x.season }, dirty: x.dirty })) : null, busyT: team ? Object.fromEntries(M.players.filter(q => q.team === p.team && q !== p && q.cooking && now - q.cooking.t < 25000).map(q => [q.cooking.tool, q.id])) : null, cooks: M.players.length, ring: coop ? { l: n > 1 ? ringOf(p).l.id : null, r: n > 1 ? ringOf(p).r.id : null, tools: p.tools, block: Math.max(0, p.block - now), who: M.players.map(q => ({ id: q.id, pts: q.pts, served: q.served, tools: q.tools, pantry: q.pantry })) } : null, tips: g.tips || 0, market: M.market ? { belt: M.belt.map(b => ({ id: b.id, ing: b.ing, left: Math.max(0, Math.round(b.at + BELT.life - now)) })), life: BELT.life, hold: BELT.hold } : null, box: box ? box.menus : null, chal: M.chalNow && M.chalUntil > now ? { ...M.chalNow, left: M.chalUntil - now } : null, duel: duelOf(p.id, now), dueled: (p.dueled || 0) >= (dur >= 600 ? 2 : 1), team: p.team, slot: p.slot, mate: mate ? mate.id : null, pantry: p.pantry, recv: { ...p.recv }, teams: M.teams() };
    };
    M.serve = (id, payload, now) => {
      const p = P(id); if (!p || p.bot) return { ok: false, msg: 'ไม่ได้อยู่ในเกม' };
      const plate = cleanPlate(payload && payload.plate); if (!plate) return { ok: false, msg: 'ข้อมูลจานไม่ถูกต้อง' };
      const raws = plate.filter(it => it.st === 'raw').map(it => it.ing);
      const miss = own(p, raws, false); if (miss) return { ok: false, msg: `${ING[miss].th} ไม่ได้มาจากตู้ของคุณหรือเพื่อนร่วมทีม` };
      const pr = proven(p, plate, false); if (pr.miss) return { ok: false, msg: `${itemName(pr.miss)} ยังไม่ได้ทำจริง` };
      const r = M.games[p.team].serve({ ...payload, plate: pr.plate, by: p.id }, now);
      if (r.ok) { own(p, raws, true); proven(p, plate, true); afterServe(p, r) }
      return r;
    };
    // skills + the gold order, for any kind of serve
    function afterServe(p, r) { let extra = 0;
      if (p.skill === 'taste') extra = Math.round((r.why ? r.why.taste : 0) * .25); else if (p.skill === 'charm') extra = Math.round(r.pts * .1);
      if (extra) { M.games[p.team].score += extra; r.pts += extra; r.why = { ...(r.why || {}), skill: extra } }
      p.served++; p.pts += r.pts;
      if (r.goldK != null) { for (const g of Object.values(M.games)) g.tickets = g.tickets.filter(t => !t.gold); r.events = [{ type: 'gold', by: p.id, th: r.th, pts: r.gold }] } }
    M.pass = (id, item, now, dir, fx) => {
      const p = P(id); const mate = p && (coop ? (n > 1 ? ringOf(p)[dir === 'l' ? 'l' : 'r'] : null) : mateOf(p)); if (!p || !mate || mate === p) return { ok: false, msg: coop ? 'ส่งได้แค่เพื่อนข้าง ๆ' : 'ส่งได้เฉพาะเพื่อนร่วมทีม' };
      if (M.games[p.team].over(now)) return { ok: false, msg: 'หมดเวลาแล้ว' };
      const it = cleanPlate([item]); if (!it) return { ok: false, msg: 'ของไม่ถูกต้อง' };
      const open = openTools(now); if (itemTools(it[0]).some(t => !open.includes(t))) return { ok: false, msg: 'ใช้เครื่องครัวที่ยังไม่เปิด' };
      let thing = it[0];
      if (thing.st === 'raw') { if (own(p, [thing.ing], true)) return { ok: false, msg: `คุณไม่มี ${ING[thing.ing].th}` }; mate.recv[thing.ing] = (mate.recv[thing.ing] || 0) + 1 }
      else { const pr = proven(p, [thing], true); if (pr.miss) return { ok: false, msg: 'ของชิ้นนี้ยังไม่ได้ทำจริง' }; thing = pr.plate[0]; L(mate, thing.ing + ':' + thing.st).push(thing.q) }
      mate.from = mate.from || {}; mate.from[thing.ing] = p.id; if (mate.bot && coop) mate.next = Math.min(mate.next || Infinity, now + 900 + rand() * 700);
      // fx: where the piece left the sender's table and how fast (only for the look: it slides in at that height with that speed)
      const f = fx && typeof fx === 'object' ? { y: Math.round(clamp01(+fx.y || .5) * 100) / 100, v: Math.round(Math.max(.3, Math.min(2.5, +fx.v || 1)) * 100) / 100 } : null;
      return { ok: true, events: [{ type: 'recv', to: mate.id, from: p.id, item: thing, dir: dir === 'l' ? 'l' : 'r', fx: f }] };
    };
    M.ask = (id, ing, now) => {
      const p = P(id); if (!p || !ING[ing]) return { ok: false };
      const mate = coop ? M.players.find(q => q !== p && q.pantry && q.pantry.includes(ing)) : mateOf(p);
      if (coop && !mate) return { ok: false, msg: M.market ? 'ของนี้ต้องคว้าจากสายพาน' : 'ไม่มีใครมีของนี้' }; if (!mate) return { ok: false };
      if (!M.games[p.team].info(now).ings.includes(ing)) return { ok: false, msg: 'วัตถุดิบนี้ยังไม่เปิด' };
      if (!has(mate, ing)) return { ok: false, msg: 'เพื่อนก็ไม่มี' };
      if (mate.bot) { M.queue.push({ at: now + 1200, from: mate.id, to: p.id, ing }); return { ok: true, events: [], owner: mate.id } }
      return { ok: true, owner: mate.id, events: [{ type: 'ask', to: mate.id, from: p.id, ing }] };
    };
    // use the prank card on the cook (or team) that is ahead
    M.prank = (id, now) => {
      const p = P(id); if (!p) return { ok: false }; const g = M.games[p.team]; if (g.over(now)) return { ok: false, msg: 'หมดเวลาแล้ว' };
      if (!g.card) return { ok: false, msg: 'ยังไม่มีการ์ด' };
      if (coop) { const c = CO_CARDS.find(x => x.id === g.card); g.card = null; if (!c) return { ok: false };
        if (c.id === 'patience') g.tickets.forEach(t => { t.born += 20000 });
        if (c.id === 'tips') g.tips = (g.tips || 0) + 3;
        if (c.id === 'cleanup') g.dirty = 0;
        return { ok: true, card: c.id, events: [{ type: 'boost', from: p.id, card: c.id }] } }
      const others = Object.entries(M.games).filter(([t]) => +t !== p.team).sort((a, b) => b[1].score - a[1].score);
      const card = CARDS.find(c => c.id === g.card); g.card = null;
      if (!others.length) return { ok: true, card: card.id, none: true, events: [] };      // nobody in the referee to prank (offline bots are handled by the screen)
      const [tt, tg] = others[0];
      if (card.id === 'power') tg.block = now + card.ms;
      if (card.id === 'plates') tg.dirty += 2;
      const to = M.players.filter(q => q.team === +tt).map(q => q.id);
      return { ok: true, card: card.id, events: [{ type: 'prank', from: p.id, to, card: card.id, ms: card.ms }] };
    };
    // market: grab an item off the shared belt (first come, first served)
    M.grab = (id, itemId, now) => {
      const p = P(id); if (!p || !M.market) return { ok: false }; if (M.games[p.team].over(now)) return { ok: false, msg: 'หมดเวลาแล้ว' };
      const i = M.belt.findIndex(b => b.id === +itemId); if (i < 0) return { ok: false, msg: 'มีคนคว้าไปแล้ว!', gone: true };
      const held = Object.values(p.recv).reduce((a, b) => a + Math.max(0, b), 0); if (held >= BELT.hold) return { ok: false, msg: `ตะกร้าเต็ม (${BELT.hold} ชิ้น) ใช้ของก่อน` };
      const [b] = M.belt.splice(i, 1); p.recv[b.ing] = (p.recv[b.ing] || 0) + 1;
      return { ok: true, ing: b.ing, events: [{ type: 'grab', by: id, id: b.id, ing: b.ing }] };
    };
    // offline bots take something off the belt too
    M.steal = (itemId) => { const i = M.belt.findIndex(b => b.id === +itemId); if (i > -1) M.belt.splice(i, 1); return i > -1 };
    // throw away a raw market item you were holding
    M.drop = (id, ing) => { const p = P(id); if (!p || !M.market || STAPLES.includes(ing)) return { ok: false }; if ((p.recv[ing] || 0) > 0) p.recv[ing]--; return { ok: true } };
    /* ---- co-op: shared plates on the pass ---- */
    const PL = (p, i) => p && M.plates && M.plates[p.team] && M.plates[p.team][+i];
    const dirtyOK = g => !g.opt.easy && !g.opt.noWash;
    M.place = (id, pi, item, now) => {
      const p = P(id), pl = PL(p, pi); if (!p || !pl) return { ok: false }; const g = M.games[p.team]; if (g.over(now)) return { ok: false, msg: 'หมดเวลาแล้ว' };
      if (pl.dirty) return { ok: false, msg: 'จานนี้สกปรก ล้างก่อน' }; if (pl.items.length >= MAX_PLATE) return { ok: false, msg: 'จานเต็มแล้ว' };
      const it = cleanPlate([item]); if (!it) return { ok: false, msg: 'ของไม่ถูกต้อง' };
      const open = g.info(now).tools; if (itemTools(it[0]).some(t => !open.includes(t))) return { ok: false, msg: 'ใช้เครื่องครัวที่ยังไม่เปิด' };
      let thing = it[0];
      if (thing.st === 'raw') { if (own(p, [thing.ing], true)) return { ok: false, msg: `คุณไม่มี ${ING[thing.ing].th}` } }
      else { const pr = proven(p, [thing], true); if (pr.miss) return { ok: false, msg: `${itemName(thing)} ยังไม่ได้ทำจริง` }; thing = pr.plate[0] }
      pl.items.push({ ...thing, by: id }); return { ok: true };
    };
    M.seasonPlate = (id, pi, season) => { const pl = PL(P(id), pi); if (!P(id) || !pl || pl.dirty) return { ok: false }; pl.season = cleanSeason(season); return { ok: true } };
    M.dumpPlate = (id, pi) => { const p = P(id), pl = PL(p, pi); if (!p || !pl || !pl.items.length) return { ok: false }; pl.items = []; pl.season = {}; if (dirtyOK(M.games[p.team])) pl.dirty = true; return { ok: true } };
    M.servePlate = (id, pi, sel, now) => {
      const p = P(id), pl = PL(p, pi); if (!p || !pl) return { ok: false }; if (!pl.items.length) return { ok: false, msg: 'จานยังว่างอยู่' };
      const g = M.games[p.team]; const r = g.serve({ plate: pl.items.map(({ ing, st, amt, q }) => ({ ing, st, amt, q })), season: pl.season, sel, by: p.id }, now);
      if (!r.ok) return r;
      const helpers = [...new Set(pl.items.map(x => x.by))];
      pl.items = []; pl.season = {}; if (dirtyOK(g)) pl.dirty = true; afterServe(p, r);
      return { ...r, helpers, events: [...(r.events || []), ...(coop ? [{ type: 'coopserve', by: id, th: r.th, pts: r.pts, helpers }] : [])] };
    };
    M.wash = (id, now) => {
      const p = P(id); if (!p) return { ok: false };
      if (M.plates) { const g = M.games[p.team]; if (g.over(now)) return { ok: false }; const pl = M.plates[p.team].find(x => x.dirty); if (!pl) return { ok: false, msg: 'ยังไม่มีจานสกปรก' }; pl.dirty = false; g.washed++; g.score += 3; return { ok: true } }
      return M.games[p.team].wash(now) };
    M.washOld = (id, now) => { const p = P(id); return p ? M.games[p.team].wash(now) : { ok: false } };
    // dumping a plate throws its cooked food away for real
    M.clear = (id, plate) => { const p = P(id); if (!p) return { ok: false }; const pl = cleanPlate(plate); if (pl) { proven(p, pl.filter(it => it.st !== 'raw'), true); if (M.market) for (const it of pl) if (it.st === 'raw') M.drop(id, it.ing) } return M.games[p.team].clear() };
    M.over = now => M.games[M.players[0].team].over(now);
    // the clock: expired orders, stage changes, and what the bots do
    M.tick = now => {
      const events = []; let changed = false;
      for (const g of Object.values(M.games)) { const gone = g.tick(now); if (g.changed) { g.changed = false; changed = true } const lost = gone.filter(x => !x.gold); if (lost.length) events.push({ type: 'expired', team: +Object.keys(M.games).find(k => M.games[k] === g), list: lost }); if (gone.length) changed = true }
      // the gold order: from stage 2, every ~40 s the same dish shows up in every kitchen; the first to serve it wins
      if (!M.over(now) && M.stage(now) >= 1 && now >= M.nextGold && !Object.values(M.games).some(g => g.tickets.some(t => t.gold))) {
        M.nextGold = now + (M.day ? 30000 : GOLD_EVERY); M.golds++;
        const g0 = Object.values(M.games)[0]; const st = g0.info(now); const opts = st.menus.filter(id => !g0.opt.allowed || g0.opt.allowed.includes(id)).map(id => MENU_BY_ID[id]).filter(m => m.tier <= 2);
        const m = opts.length ? opts[(M.golds * 5 + Math.floor(gen)) % opts.length] : null;
        if (m) { for (const g of Object.values(M.games)) g.tickets.push({ k: 9000 + M.golds, id: m.id, born: now, life: GOLD_LIFE, rush: false, req: null, gold: true }); changed = true; events.push({ type: 'goldnew', th: m.th }) }
      }
      if (M.market && !M.over(now)) {
        const before = M.belt.length; M.belt = M.belt.filter(b => now < b.at + BELT.life); if (M.belt.length !== before) changed = true;
        while (now >= M.beltNext) {
          M.beltNext += BELT.every * (M.players.length > 2 ? .8 : 1);
          if (M.belt.length >= BELT.max) continue;
          const g0 = Object.values(M.games)[0]; const open = g0.info(now).ings.filter(k => !STAPLES.includes(k));
          const needed = [...new Set(Object.values(M.games).flatMap(g => g.tickets.flatMap(t => MENU_BY_ID[t.id].c.map(c => c[0]))))].filter(k => open.includes(k));
          const onBelt = k => M.belt.filter(b => b.ing === k).length;
          const pool = (rand() < .75 && needed.length ? needed : open).filter(k => onBelt(k) < 2);
          if (!pool.length) continue;
          M.belt.push({ id: ++M.beltId, ing: pool[Math.floor(rand() * pool.length)], at: Math.min(now, M.beltNext) }); changed = true;
        }
      }
      const si = M.stage(now); if (si !== M.lastStage) { M.lastStage = si; changed = true; events.push({ type: 'stage', i: si }) }
      for (const c of M.chal) if (!c.done && now >= c.at && !M.over(now)) { c.done = true; changed = true; const ms = CHAL[c.type].ms; M.chalUntil = now + ms;
        if (c.type === 'pressure') { const g0 = Object.values(M.games)[0]; const st = g0.info(now); const all = st.menus.filter(id => !g0.opt.allowed || g0.opt.allowed.includes(id)).map(id => MENU_BY_ID[id]); const hard = all.filter(m => m.tier >= 2);
          const L2 = hard.length ? hard : all; const m = L2[(Math.floor(gen) + 7 * ++M.chalN) % L2.length]; if (!m) continue;
          for (const g of Object.values(M.games)) g.tickets.push({ k: 8000 + M.chalN, id: m.id, born: now, life: ms / 1000, rush: false, req: null, chal: 'pressure' });
          M.chalNow = { kind: 'pressure', th: CHAL.pressure.th, dish: m.th }; events.push({ type: 'chal', kind: 'pressure', th: CHAL.pressure.th, dish: m.th, ms }) }
        if (c.type === 'speed') { for (const g of Object.values(M.games)) g.boostUntil = now + ms; M.chalNow = { kind: 'speed', th: CHAL.speed.th }; events.push({ type: 'chal', kind: 'speed', th: CHAL.speed.th, ms }) } }
      for (const d of M.duels) if (!d.done && (now >= d.t1 || M.over(now))) { d.done = true; changed = true;
        const pa = P(d.a), pb = P(d.b), ga = M.games[pa.team].score - d.sa, gb = d.human ? M.games[pb.team].score - d.sb : d.bot;
        const win = ga > gb ? d.a : gb > ga ? d.b : null, lose = win === d.a ? d.b : win === d.b ? d.a : null;
        if (win && P(win)) M.games[P(win).team].score += DUEL_WIN; if (lose && P(lose)) { const gl = M.games[P(lose).team]; gl.score = Math.max(0, gl.score - DUEL_LOSE) }
        events.push({ type: 'duel', st: 'end', a: d.a, b: d.b, ga, gb, win, bonus: DUEL_WIN, lose: DUEL_LOSE, human: d.human }) }
      if (coop && !M.over(now)) {
        const g = Object.values(M.games)[0];
        // the rival shop: from 30% of the round, every 40-55 s a prank lands on one cook (Family Style chaos)
        if (now >= M.nextChaos) { M.nextChaos = now + 40000 + rand() * 15000; const hum = M.players.filter(q => !q.bot);
          if (hum.length) { const t = hum[Math.floor(rand() * hum.length)]; const c = CARDS[Math.floor(rand() * CARDS.length)]; if (c.id === 'power') t.block = now + c.ms; changed = true; events.push({ type: 'prank', from: 'rival', to: [t.id], card: c.id, ms: c.ms }) } }
        // asked items from bots (forwarded one seat at a time)
        M.queue = M.queue.filter(q => { if (now < q.at) return true; const from = P(q.from), to = P(q.to); if (!from || !to) return false;
          const r = M.pass(q.from, { ing: q.ing, st: 'raw', amt: ING[q.ing].d, q: 100 }, now, toward(from, to)); if (r.ok) { changed = true; events.push(...r.events) } return false });
        const humans = M.players.filter(q => !q.bot);
        // bots at the co-op table really cook: they work their own order step by step at their own stations, ask people for what
        // they don't have, hand food that needs someone else's station to that person (and wait for it back), and help people's orders
        const toolOwner = tool => M.players.find(q => !q.tools || q.tools.includes(tool));
        const ingOwner = ing => M.players.find(q => q.pantry ? q.pantry.includes(ing) : true);
        for (const p of M.players) {
          if (!p.bot || !humans.length) continue; if (!p.next) p.next = now + (2500 + rand() * 1500) / p.sk; if (now < p.next) continue;
          p.next = now + (2600 + rand() * 1800) / p.sk;
          const near = humans.slice().sort((a, b) => { const d = x => { const i = M.players.indexOf(p), j = M.players.indexOf(x); const k = (j - i + n) % n; return Math.min(k, n - k) }; return d(a) - d(b) })[0];
          const dir = toward(p, near);
          const myTk = g.tickets.find(t => t.own === p.id && !t.gold), comps = myTk ? (g.opt.noSauce ? fsComp(MENU_BY_ID[myTk.id]) : MENU_BY_ID[myTk.id].c) : [];
          const needOwn = ing => comps.some(c => c[0] === ing);
          const stock = k => (p.ledger[k] || []).length, rawHave = ing => has(p, ing) || (p.recv[ing] || 0) > 0;
          const useRaw = ing => { if (!has(p, ing)) p.recv[ing]--; };
          const cookAt = (who, ing, s0, tool) => { const s1 = TR[tool][ing + ':' + s0]; if (!s1) return false; let q0 = 100; if (s0 === 'raw') useRaw(ing); else { const l = p.ledger[ing + ':' + s0]; l.sort((a, b) => b - a); q0 = l.shift() }
            L(p, ing + ':' + s1).push(Math.round((q0 + 70 + rand() * 26 * Math.min(1, p.sk)) / 2)); changed = true; events.push({ type: 'coopbot', by: who.id, act: 'cook', ing, st: s1 }); return true };
          // 1) something handed over that isn't for this bot's own order: cook it if a waiting order needs this bot's station, else pass it on
          const back = ing => { const b = p.from && P(p.from[ing]); return b && !b.bot ? toward(p, b) : dir };
          const stepFor = (ing, s0) => { for (const t of g.tickets) { if (t.own === p.id) continue; for (const [i2, st] of (g.opt.noSauce ? fsComp(MENU_BY_ID[t.id]) : MENU_BY_ID[t.id].c)) { if (i2 !== ing || st === s0) continue; const path = pathTo(ing, st) || []; let s = 'raw'; for (const tool of path) { if (s === s0) return tool; s = TR[tool][ing + ':' + s] } } } return null };
          const forPeople = (ing, s0) => { const t = stepFor(ing, s0); const f = p.from && P(p.from[ing]); return t && (!p.tools || p.tools.includes(t)) && f && !f.bot };   // a person handed it over to use this bot's station
          const got = Object.entries(p.recv).find(([ing, v]) => v > 0 && (!needOwn(ing) || forPeople(ing, 'raw'))), cookedKey = Object.keys(p.ledger).find(k => p.ledger[k].length && (!needOwn(k.split(':')[0]) || forPeople(...k.split(':'))));
          if (got || cookedKey) { const [ing, s0] = got ? [got[0], 'raw'] : cookedKey.split(':'); const tool = stepFor(ing, s0);
            if (tool && (!p.tools || p.tools.includes(tool))) { cookAt(p, ing, s0, tool); const s1 = TR[tool][ing + ':' + s0]; const r = M.pass(p.id, { ing, st: s1, amt: ING[ing].d, q: 90 }, now, back(ing)); if (r.ok) events.push(...r.events); continue }
            const r = M.pass(p.id, { ing, st: s0, amt: ING[ing].d, q: s0 === 'raw' ? 100 : 90 }, now, got ? (p.from && P(p.from[ing]) && !P(p.from[ing]).bot ? (toward(p, P(p.from[ing])) === 'l' ? 'r' : 'l') : dir) : back(ing)); if (r.ok) { changed = true; events.push(...r.events) } continue }
          // 2) help a person's order: send what only this bot has (cooked first when this bot owns the first station)
          const st0 = g.info(now); const want = [];
          for (const t of g.tickets) { const ow = t.own && P(t.own); if (!ow || ow.bot) continue; for (const [ing, st] of (g.opt.noSauce ? fsComp(MENU_BY_ID[t.id]) : MENU_BY_ID[t.id].c)) if (has(p, ing) && !has(ow, ing) && st0.ings.includes(ing) && !(M.market && !STAPLES.includes(ing))) want.push([ing, st, ow]) }
          const fresh = want.filter(([ing, st, ow]) => !(p.sent && p.sent[ing + ow.id] > now - 15000) && (ow.recv[ing] || 0) < 1 && !(ow.ledger[ing + ':' + st] || []).length);
          if (fresh.length && rand() < (myTk ? .8 : .95)) { const [ing, st, ow] = fresh[Math.floor(rand() * fresh.length)]; (p.sent = p.sent || {})[ing + ow.id] = now; const path = pathTo(ing, st) || [];
            if (path.length && (!p.tools || p.tools.includes(path[0]))) { cookAt(p, ing, 'raw', path[0]); const s1 = TR[path[0]][ing + ':raw']; const r = M.pass(p.id, { ing, st: s1, amt: ING[ing].d, q: 90 }, now, toward(p, ow)); if (r.ok) events.push(...r.events) }
            else { const r = M.pass(p.id, { ing, st: 'raw', amt: ING[ing].d, q: 100 }, now, toward(p, ow)); if (r.ok) { changed = true; events.push(...r.events) } }
            continue }
          // 3) its own order: the next missing piece, one station step at a time
          if (!myTk) continue;
          const left = {}; for (const [ing, st] of comps) { const k = ing + ':' + st; left[k] = (left[k] || 0) + 1 }
          let missing = null; for (const [k, c] of Object.entries(left)) { const [ing, st] = k.split(':'); const have = st === 'raw' ? (has(p, ing) ? 99 : (p.recv[ing] || 0)) : stock(k); if (have < c) { missing = [ing, st]; break } }
          if (!missing) {   // everything is ready: plate it and serve
            let qs = []; for (const [ing, st] of comps) { if (st === 'raw') { useRaw(ing); qs.push(100) } else { const l = p.ledger[ing + ':' + st]; l.sort((a, b) => b - a); qs.push(l.shift()) } }
            const m = MENU_BY_ID[myTk.id]; const avg = qs.reduce((a, b) => a + b, 0) / qs.length; const pts = Math.round((35 + avg * .45) * TIER_X[m.tier]);
            g.botServe(pts, now, p.id); p.pts += pts; p.served++; changed = true; events.push({ type: 'coopserve', by: p.id, th: m.th, pts, helpers: [p.id] }); continue }
          const [ing, st] = missing; const path = pathTo(ing, st) || [];
          let k = -1, s = 'raw', states = ['raw']; for (const tool of path) { s = TR[tool][ing + ':' + s]; states.push(s) }
          for (let x = states.length - 2; x >= 0; x--) { const sx = states[x]; if (sx === 'raw' ? rawHave(ing) : stock(ing + ':' + sx) > 0) { k = x; break } }
          if (k < 0) {   // the raw ingredient is on someone else's table
            const o = ingOwner(ing); if (!o) continue; if (o.bot) { p.recv[ing] = (p.recv[ing] || 0) + 1; continue }
            if (!(p.askT && p.askT[ing] > now - 14000)) { (p.askT = p.askT || {})[ing] = now; changed = true; events.push({ type: 'ask', to: o.id, from: p.id, ing }) } continue }
          const tool = path[k], o = toolOwner(tool);
          if (!p.tools || p.tools.includes(tool) || (o && o.bot)) { cookAt(o && o.bot && p.tools && !p.tools.includes(tool) ? o : p, ing, states[k], tool); continue }
          // the station belongs to a person: hand it over and ask them to cook it and send it back
          if (o && !(p.handT && p.handT[ing + ':' + states[k]] > now - 20000)) { (p.handT = p.handT || {})[ing + ':' + states[k]] = now;
            const r = M.pass(p.id, { ing, st: states[k], amt: ING[ing].d, q: states[k] === 'raw' ? 100 : 90 }, now, toward(p, o));
            if (r.ok) { changed = true; events.push(...r.events, { type: 'botneed', to: o.id, from: p.id, ing, st: states[k + 1], tool }) } }
        }
      }
      if (team && !M.over(now)) {
        // queued bot replies to "please pass me ..."
        M.queue = M.queue.filter(q => { if (now < q.at) return true; const r = M.pass(q.from, { ing: q.ing, st: 'raw', amt: ING[q.ing].d, q: 100 }, now); if (r.ok) { changed = true; events.push(...r.events) } return false });
        for (const p of M.players) {
          if (!p.bot) continue; if (!p.next) p.next = now + (6000 + rand() * 4000) / p.sk;
          if (now < p.next) continue;
          const mate = mateOf(p); const g = M.games[p.team]; const st = g.info(now);
          const weak = M.chalUntil > now ? 1.7 : 1;   // during a challenge the bots slow down, so people can win it
          if (mate && !mate.bot) {
            // bot teammate (same kitchen, nothing to pass): cooks the newest order now and then, the person does most of the work
            const tk = g.tickets.filter(t => !t.gold && !t.chal && !t.set).sort((a, b) => b.born - a.born)[0];
            if (tk && now > t0 + 15000) { const m = MENU_BY_ID[tk.id]; const pts = Math.round((45 + rand() * 30) * TIER_X[m.tier] * Math.min(p.sk, 1.1)); g.score += pts; g.served++; g.tickets = g.tickets.filter(t => t !== tk); p.pts += pts; p.served++; changed = true; events.push({ type: 'matecook', by: p.id, th: m.th, pts }) }
            p.next = now + (26000 + rand() * 12000) * weak / p.sk;
          } else if (p.slot === 0) {
            // an all-bot team cooks on its own (one bot of the pair keeps the score)
            const tk = g.tickets[0]; const m = MENU_BY_ID[tk.id];
            const pts = Math.round((55 + rand() * 35) * TIER_X[m.tier] * (tk.rush ? RUSH_X : 1) * Math.min(p.sk, 1.15));
            g.botServe(pts, now);
            p.next = now + (30000 + rand() * 12000) * weak / p.sk; changed = true;
          } else p.next = now + 60000;
        }
      }
      if (M.roundEv) { events.push(M.roundEv); M.roundEv = null; changed = true }
      if (!M.finished && M.over(now)) { M.finished = true; changed = true; events.push({ type: 'end' }) }
      return { changed, events };
    };
    return M;
  }

  return {
    TASTE, TK, ING, CATS, SEASON, SEASON_KEYS, COOK_TOOLS, TR, MENUS, MENU_BY_ID, LIFE, TIER_X, MAX_PLATE, SPECIAL,
    itemName, amtText, keyOf, mulberry, pathTo, buildSeq, tasteOf, targetOf, tasteAccuracy, seasonHint, judgeDish, cleanPlate, cleanSeason, createGame, createMatch, splitPantry, HEARTS, METER, fsComp, FS_MENUS, STAGES, STAGE_INFO, stageAt, RUSH_X,
    REQS, JUDGES, targetFor, tourNext, tourKind, tourKeep, tourOk, TOUR_PLANS, COURSE_TH, courseOf, SET_BONUS, MIN_COOK, ROUNDS, mysteryBox, idealSeason, CARDS, CO_CARDS, DAYS, WORLDS, fsRun, TOOL_TH, SKILLS, skillOf, HK_COURSE, HK_MIN, HK_GOOD, CHAL, DUEL_MS, DUEL_WIN, DUEL_LOSE, COMBO_MS, GOLD_BONUS, EASY_MENUS, DIFFS, STAPLES, BELT,
  };
});
