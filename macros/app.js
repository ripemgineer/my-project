'use strict';

/* ---------- storage ---------- */
const KEY = 'macros-v1';
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const DEFAULT = {
  goals: { kcal: 2500, p: 180, c: 280, f: 75 },
  unit: 'kg',
  profile: {},
  log: {},      // 'YYYY-MM-DD' -> [entry]
  foods: {},    // key -> food (recents + custom foods)
  weights: {},  // 'YYYY-MM-DD' -> kg
};
let S = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return Object.assign(structuredClone(DEFAULT), JSON.parse(raw));
  } catch (e) { /* ignore */ }
  return structuredClone(DEFAULT);
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Could not save — storage full?'); }
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const r0 = n => Math.round(n);
const r1 = n => Math.round(n * 10) / 10;
const fmtG = n => (n < 10 ? r1(n) : r0(n));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const KG_LB = 2.20462;
const toDisp = kg => (S.unit === 'lb' ? kg * KG_LB : kg);
const fromDisp = v => (S.unit === 'lb' ? v / KG_LB : v);

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600);
}

let day = ymd(new Date());
function defaultMeal() {
  const h = new Date().getHours();
  return h < 11 ? 0 : h < 15 ? 1 : h < 21 ? 2 : 3;
}

/* ---------- nutrition math ---------- */
// food: { key, name, brand, code, img, per100:{kcal,p,c,f}, servingG, servingLabel, servingOnly, custom }
// entry: { id, meal, food, qty, unit: 'g' | 'serving' }
function grams(entry) {
  return entry.unit === 'serving' ? entry.qty * (entry.food.servingG || 100) : entry.qty;
}
function macrosOf(food, g) {
  const k = g / 100, n = food.per100;
  return { kcal: n.kcal * k, p: n.p * k, c: n.c * k, f: n.f * k };
}
const entryMacros = e => macrosOf(e.food, grams(e));
function sum(list) {
  return list.reduce((a, e) => { const m = entryMacros(e); a.kcal += m.kcal; a.p += m.p; a.c += m.c; a.f += m.f; return a; },
    { kcal: 0, p: 0, c: 0, f: 0 });
}
function amountLabel(e) {
  if (e.unit === 'serving') {
    const q = r1(e.qty);
    return e.food.servingOnly ? `${q} × ${e.food.servingLabel || 'serving'}` : `${q} × ${e.food.servingLabel || 'serving'} (${r0(grams(e))} g)`;
  }
  return `${r1(e.qty)} g`;
}

/* ---------- overlays (sheets) with Android back-button support ---------- */
const stack = [];
function showEl(id) { $('#' + id).hidden = false; }
function hideEl(id) { $('#' + id).hidden = true; if (id === 'scanner') stopScan(); }
function openOverlay(id) {
  showEl(id); stack.push(id);
  history.pushState({ depth: stack.length }, '');
}
function replaceTop(id) {
  if (!stack.length) return openOverlay(id);
  hideEl(stack.pop()); showEl(id); stack.push(id);
}
function closeTop() {
  if (!stack.length) return;
  hideEl(stack.pop());
  history.back();
}
function closeAll() {
  const n = stack.length;
  while (stack.length) hideEl(stack.pop());
  if (n) history.go(-n);
}
addEventListener('popstate', e => {
  const depth = (e.state && e.state.depth) || 0;
  while (stack.length > depth) hideEl(stack.pop());
});
$$('[data-close]').forEach(b => b.addEventListener('click', closeTop));
$$('.sheet').forEach(s => s.addEventListener('click', e => { if (e.target === s) closeTop(); }));

/* ---------- tabs & date ---------- */
let view = 'today';
$$('.tab[data-view]').forEach(t => t.addEventListener('click', () => {
  view = t.dataset.view;
  $$('.tab[data-view]').forEach(x => x.classList.toggle('active', x === t));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  render();
  scrollTo(0, 0);
}));
function shiftDay(n) { const d = parseYmd(day); d.setDate(d.getDate() + n); day = ymd(d); render(); }
$('#prevDay').addEventListener('click', () => shiftDay(-1));
$('#nextDay').addEventListener('click', () => shiftDay(1));
$('#dateLabel').addEventListener('click', () => {
  const p = $('#datePicker'); p.value = day;
  if (p.showPicker) { try { p.showPicker(); return; } catch (e) { /* fall through */ } }
  p.click();
});
$('#datePicker').addEventListener('change', e => { if (e.target.value) { day = e.target.value; render(); } });
function dayLabel() {
  const today = ymd(new Date());
  const d = parseYmd(day), t = parseYmd(today);
  const diff = Math.round((d - t) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/* ---------- render: today ---------- */
const RING_C = 2 * Math.PI * 52;
function render() {
  $('#dateLabel').textContent = dayLabel();
  if (view === 'today') renderToday();
  if (view === 'weight') renderWeight();
  if (view === 'settings') renderSettings();
}
function renderToday() {
  const list = S.log[day] || [];
  const t = sum(list), g = S.goals;
  const left = g.kcal - t.kcal;
  $('#kcalLeft').textContent = r0(Math.abs(left)).toLocaleString();
  $('#kcalLeftLabel').textContent = left >= 0 ? 'kcal left' : 'kcal over';
  const ring = $('#kcalRing');
  ring.style.strokeDasharray = RING_C;
  ring.style.strokeDashoffset = RING_C * (1 - Math.min(1, g.kcal ? t.kcal / g.kcal : 0));
  ring.classList.toggle('over', left < 0);
  $('#kcalLine').textContent = `${r0(t.kcal).toLocaleString()} / ${r0(g.kcal).toLocaleString()} kcal eaten`;
  for (const k of ['p', 'c', 'f']) {
    const el = $(`.mbar[data-k="${k}"]`);
    $('.mv', el).textContent = `${r0(t[k])} / ${r0(g[k])} g`;
    const fill = $('.fill', el);
    fill.style.width = Math.min(100, g[k] ? (t[k] / g[k]) * 100 : 0) + '%';
    fill.classList.toggle('over', t[k] > g[k] * 1.05);
  }

  const wrap = $('#meals');
  wrap.innerHTML = MEALS.map((m, i) => {
    const items = list.filter(e => e.meal === i);
    const s = sum(items);
    const rows = items.map(e => {
      const mm = entryMacros(e);
      return `<li data-id="${e.id}">
        <div class="grow"><div class="name">${esc(e.food.name)}</div>
        <div class="sub">${esc(amountLabel(e))} · P ${r0(mm.p)} · C ${r0(mm.c)} · F ${r0(mm.f)}</div></div>
        <div class="kcal">${r0(mm.kcal)}</div>
        <button class="del" data-del="${e.id}" aria-label="Remove">✕</button></li>`;
    }).join('');
    return `<div class="card meal">
      <div class="meal-head"><div><h3>${m}</h3>
        <div class="meal-sub">${items.length ? `${r0(s.kcal)} kcal · P ${r0(s.p)} · C ${r0(s.c)} · F ${r0(s.f)}` : 'Nothing logged'}</div></div>
        <button class="add-mini" data-meal="${i}">+ Add</button></div>
      ${rows ? `<ul class="list">${rows}</ul>` : ''}</div>`;
  }).join('') + (list.length ? '' : copyPrevButton());
}
function copyPrevButton() {
  const d = parseYmd(day); d.setDate(d.getDate() - 1);
  const prev = S.log[ymd(d)];
  return prev && prev.length ? `<button class="btn block" id="copyPrev">Copy everything from the previous day (${prev.length} items)</button>` : '';
}
$('#meals').addEventListener('click', e => {
  const del = e.target.closest('[data-del]');
  if (del) {
    const list = S.log[day] || [];
    const idx = list.findIndex(x => x.id === del.dataset.del);
    if (idx >= 0) {
      const [removed] = list.splice(idx, 1); save(); render();
      toastUndo(removed);
    }
    return;
  }
  const add = e.target.closest('[data-meal]');
  if (add) return openAdd(+add.dataset.meal);
  if (e.target.id === 'copyPrev') {
    const d = parseYmd(day); d.setDate(d.getDate() - 1);
    S.log[day] = (S.log[ymd(d)] || []).map(x => ({ ...structuredClone(x), id: uid() }));
    save(); render(); toast('Copied');
    return;
  }
  const li = e.target.closest('li[data-id]');
  if (li) {
    const entry = (S.log[day] || []).find(x => x.id === li.dataset.id);
    if (entry) openFood(entry.food, { entry });
  }
});
let lastRemoved = null;
function toastUndo(entry) {
  lastRemoved = { entry, day };
  const t = $('#toast');
  t.innerHTML = `Removed ${esc(entry.food.name)} · <u id="undoBtn" style="cursor:pointer">Undo</u>`;
  t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 4000);
}
$('#toast').addEventListener('click', e => {
  if (e.target.id !== 'undoBtn' || !lastRemoved) return;
  (S.log[lastRemoved.day] ||= []).push(lastRemoved.entry);
  lastRemoved = null; save(); render(); $('#toast').hidden = true;
});

/* ---------- add sheet ---------- */
const mealOpts = sel => MEALS.map((m, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${m}</option>`).join('');
let addMeal = 0, addTab = 'recent', results = [];
$('#addBtn').addEventListener('click', () => openAdd(defaultMeal()));
function openAdd(meal) {
  addMeal = meal;
  $('#addMeal').innerHTML = mealOpts(meal);
  $('#searchInput').value = '';
  setAddTab('recent');
  openOverlay('addSheet');
}
$('#addMeal').addEventListener('change', e => (addMeal = +e.target.value));
$('#addTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setAddTab(b.dataset.t); });
function setAddTab(t) {
  addTab = t;
  $$('#addTabs button').forEach(b => b.classList.toggle('active', b.dataset.t === t));
  renderFoodList();
}
function foodRow(f, i) {
  const n = f.per100;
  const sub = f.servingOnly
    ? `${r0(n.kcal)} kcal per ${f.servingLabel || 'serving'}`
    : `${r0(n.kcal)} kcal · P ${fmtG(n.p)} · C ${fmtG(n.c)} · F ${fmtG(n.f)} per 100 g`;
  return `<li data-i="${i}">
    ${f.img ? `<img class="thumb" src="${esc(f.img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
    <div class="grow"><div class="name">${esc(f.name)}</div>
    <div class="sub">${f.brand ? esc(f.brand) + ' · ' : ''}${sub}</div></div></li>`;
}
let shown = [];
function renderFoodList(msg) {
  const ul = $('#foodList');
  if (msg) { ul.innerHTML = `<li class="empty">${msg}</li>`; return; }
  const all = Object.values(S.foods);
  if (addTab === 'recent') shown = all.filter(f => f.lastUsed).sort((a, b) => b.lastUsed - a.lastUsed).slice(0, 40);
  else if (addTab === 'mine') shown = all.filter(f => f.custom).sort((a, b) => a.name.localeCompare(b.name));
  else shown = results;
  const empty = {
    recent: 'Foods you log show up here.<br>Scan a barcode or search to get started.',
    mine: 'Foods you create show up here.',
    results: 'Search for a food above.',
  }[addTab];
  ul.innerHTML = shown.length ? shown.map(foodRow).join('') : `<li class="empty">${empty}</li>`;
}
$('#foodList').addEventListener('click', e => {
  const li = e.target.closest('li[data-i]');
  if (li) openFood(shown[+li.dataset.i], { meal: addMeal, stacked: true });
});

$('#searchForm').addEventListener('submit', async e => {
  e.preventDefault();
  const q = $('#searchInput').value.trim();
  if (!q) return;
  $('#searchInput').blur();
  if (/^\d{6,14}$/.test(q)) return lookupBarcode(q, false);
  // local matches first
  const ql = q.toLowerCase();
  const local = Object.values(S.foods).filter(f => (f.name + ' ' + (f.brand || '')).toLowerCase().includes(ql));
  setAddTab('results');
  renderFoodList('Searching…');
  try {
    const remote = await searchOFF(q);
    const seen = new Set(local.map(f => f.key));
    results = local.concat(remote.filter(f => !seen.has(f.key)));
  } catch (err) {
    results = local;
    if (!results.length) return renderFoodList('Search failed. Check your connection and try again.');
    toast('Online search failed — showing saved foods only');
  }
  if (!results.length) return renderFoodList('No results. Try different words, or create the food yourself.');
  renderFoodList();
});

/* ---------- Open Food Facts ---------- */
const OFF = 'https://world.openfoodfacts.org';
const OFF_FIELDS = 'code,product_name,product_name_en,generic_name,brands,nutriments,serving_size,serving_quantity,image_front_small_url';
function offToFood(p) {
  const n = p.nutriments || {};
  let kcal = n['energy-kcal_100g'];
  if (kcal == null && n.energy_100g != null) kcal = n.energy_100g / 4.184; // kJ -> kcal
  const per100 = { kcal: num(kcal), p: num(n.proteins_100g), c: num(n.carbohydrates_100g), f: num(n.fat_100g) };
  const hasData = kcal != null || n.proteins_100g != null || n.carbohydrates_100g != null || n.fat_100g != null;
  if (!hasData) return null;
  if (!per100.kcal) per100.kcal = per100.p * 4 + per100.c * 4 + per100.f * 9;
  const sq = num(p.serving_quantity);
  const name = (p.product_name_en || p.product_name || p.generic_name || '').trim() || 'Unnamed product';
  return {
    key: 'b:' + p.code,
    code: p.code,
    name,
    brand: (p.brands || '').split(',')[0].trim(),
    img: p.image_front_small_url || '',
    per100,
    servingG: sq > 0 ? sq : null,
    servingLabel: sq > 0 ? (p.serving_size || `${sq} g`) : '',
  };
}
async function fetchJSON(url, ms = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
async function getProduct(code) {
  const j = await fetchJSON(`${OFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  if (!j || j.status !== 1 || !j.product) return { found: false };
  j.product.code = j.product.code || code;
  const food = offToFood(j.product);
  return food ? { found: true, food } : { found: true, food: null, name: j.product.product_name };
}
async function searchOFF(q) {
  const url = `${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=30&fields=${OFF_FIELDS}`;
  const j = await fetchJSON(url, 20000);
  return ((j && j.products) || []).map(offToFood).filter(Boolean);
}
const codeVariants = c => [...new Set([c, c.padStart(13, '0'), c.replace(/^0+/, '')])];
function localByCode(code) {
  const vs = codeVariants(code);
  return Object.values(S.foods).find(f => f.code && vs.includes(f.code));
}
async function lookupBarcode(code, fromScanner) {
  const local = localByCode(code);
  if (local) return foundFood(local, fromScanner);
  if (fromScanner) $('#scanMsg').textContent = `Looking up ${code}…`;
  else renderFoodList('Looking up barcode…');
  let res;
  try {
    res = await getProduct(code);
    if (!res.found && code.length === 12) res = await getProduct('0' + code); // UPC-A -> EAN-13
  } catch (e) {
    toast('Lookup failed — check your connection');
    if (fromScanner) closeTop(); else renderFoodList();
    return;
  }
  if (res.food) return foundFood(res.food, fromScanner);
  toast(res.found ? 'Product found, but it has no nutrition data. Add it once and it will be remembered.'
    : 'Not in the database yet. Add it once and it will be remembered.');
  const pre = { code, name: res.name || '' };
  if (fromScanner) { fillEdit(null, pre); replaceTop('editSheet'); }
  else { renderFoodList(); openEdit(null, pre); }
}
function foundFood(food, fromScanner) {
  if (navigator.vibrate) navigator.vibrate(60);
  if (fromScanner) openFood(food, { meal: addMeal, replace: true });
  else { renderFoodList(); openFood(food, { meal: addMeal, stacked: true }); }
}

/* ---------- food detail sheet ---------- */
let fd = null; // { food, entry? }
function openFood(food, opts = {}) {
  fd = { food: structuredClone(food), entry: opts.entry || null };
  const e = fd.entry;
  $('#fdMeal').innerHTML = mealOpts(e ? e.meal : (opts.meal ?? defaultMeal()));
  fillFoodSheet(e ? e.qty : null, e ? e.unit : null);
  $('#fdSave').textContent = e ? 'Update' : 'Add';
  $('#fdDelete').hidden = !e;
  $('#fdEditFood').hidden = !!fd.food.quick;
  if (opts.replace) replaceTop('foodSheet'); else openOverlay('foodSheet');
}
function fillFoodSheet(qty, unit) {
  const f = fd.food;
  $('#fdName').textContent = f.name;
  $('#fdBrand').textContent = [f.brand, f.code].filter(Boolean).join(' · ');
  const units = [];
  if (f.servingG) units.push(['serving', f.servingOnly ? (f.servingLabel || 'serving') : `serving (${f.servingLabel || r0(f.servingG) + ' g'})`]);
  if (!f.servingOnly) units.push(['g', 'grams / ml']);
  $('#fdUnit').innerHTML = units.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  const u = unit && units.some(x => x[0] === unit) ? unit : units[0][0];
  $('#fdUnit').value = u;
  $('#fdQty').value = qty ?? (u === 'serving' ? 1 : 100);
  $('#fdPer').textContent = f.servingOnly
    ? `Per ${f.servingLabel || 'serving'}: ${r0(f.per100.kcal)} kcal`
    : `Per 100 g: ${r0(f.per100.kcal)} kcal · P ${fmtG(f.per100.p)} · C ${fmtG(f.per100.c)} · F ${fmtG(f.per100.f)}`;
  updateFdMacros();
}
function updateFdMacros() {
  const e = { food: fd.food, qty: num($('#fdQty').value), unit: $('#fdUnit').value };
  const m = entryMacros(e);
  $('#fdMacros').innerHTML = `
    <div class="chip"><b>${r0(m.kcal)}</b><span>kcal</span></div>
    <div class="chip p"><b>${fmtG(m.p)}</b><span>protein</span></div>
    <div class="chip c"><b>${fmtG(m.c)}</b><span>carbs</span></div>
    <div class="chip f"><b>${fmtG(m.f)}</b><span>fat</span></div>`;
}
$('#fdQty').addEventListener('input', updateFdMacros);
$('#fdUnit').addEventListener('change', e => {
  // keep the same amount of food when switching units
  const f = fd.food, q = num($('#fdQty').value);
  if (f.servingG && !f.servingOnly) {
    $('#fdQty').value = e.target.value === 'g' ? r1(q * f.servingG) : r1(q / f.servingG) || 1;
  }
  updateFdMacros();
});
$('#fdQty').addEventListener('focus', e => e.target.select());
function rememberFood(food) {
  const prev = S.foods[food.key] || {};
  S.foods[food.key] = { ...prev, ...food, lastUsed: Date.now() };
}
$('#fdSave').addEventListener('click', () => {
  const qty = num($('#fdQty').value);
  if (qty <= 0) return toast('Enter an amount');
  const unit = $('#fdUnit').value, meal = +$('#fdMeal').value;
  if (!fd.food.key) fd.food.key = 'c:' + uid();
  const list = (S.log[day] ||= []);
  if (fd.entry) {
    const e = list.find(x => x.id === fd.entry.id);
    if (e) Object.assign(e, { qty, unit, meal, food: fd.food });
  } else {
    list.push({ id: uid(), meal, food: fd.food, qty, unit });
  }
  if (!fd.food.quick) rememberFood(fd.food);
  save(); closeAll(); render();
  toast(fd.entry ? 'Updated' : `Added to ${MEALS[meal]}`);
});
$('#fdDelete').addEventListener('click', () => {
  const list = S.log[day] || [];
  const idx = list.findIndex(x => x.id === fd.entry.id);
  if (idx >= 0) { const [r] = list.splice(idx, 1); save(); closeAll(); render(); toastUndo(r); }
});
$('#fdEditFood').addEventListener('click', () => openEdit(fd.food, null, true));

/* ---------- create / edit food ---------- */
let ef = null; // { food (existing) | null, fromDetail }
function openEdit(food, pre, fromDetail) {
  fillEdit(food, pre, fromDetail);
  openOverlay('editSheet');
}
function fillEdit(food, pre = {}, fromDetail = false) {
  ef = { food, fromDetail };
  pre = pre || {};
  $('#efTitle').textContent = food ? 'Edit food' : 'Create food';
  $('#efName').value = food ? food.name : (pre.name || '');
  $('#efBrand').value = food ? (food.brand || '') : '';
  $('#efCode').value = food ? (food.code || '') : (pre.code || '');
  const so = food && food.servingOnly;
  $('#efBasis').value = so ? 'serving' : '100';
  $('#efServing').value = food && food.servingG && !so ? r1(food.servingG) : '';
  const n = food ? food.per100 : null;
  $('#efKcal').value = n ? r1(n.kcal) : '';
  $('#efP').value = n ? r1(n.p) : '';
  $('#efC').value = n ? r1(n.c) : '';
  $('#efF').value = n ? r1(n.f) : '';
}
$('#editForm').addEventListener('submit', e => {
  e.preventDefault();
  const basis = $('#efBasis').value;
  const sg = num($('#efServing').value);
  const vals = { kcal: num($('#efKcal').value), p: num($('#efP').value), c: num($('#efC').value), f: num($('#efF').value) };
  const code = $('#efCode').value.trim();
  const old = ef.food;
  const food = {
    key: old && old.key ? old.key : (code ? 'b:' + code : 'c:' + uid()),
    code,
    name: $('#efName').value.trim(),
    brand: $('#efBrand').value.trim(),
    img: old ? old.img || '' : '',
    custom: true,
  };
  if (basis === 'serving' && sg > 0) {
    food.per100 = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, (v * 100) / sg]));
    food.servingG = sg; food.servingLabel = `${r1(sg)} g`;
  } else if (basis === 'serving') {
    food.per100 = vals; food.servingG = 100; food.servingOnly = true; food.servingLabel = 'serving';
  } else {
    food.per100 = vals; food.servingG = sg > 0 ? sg : null; food.servingLabel = sg > 0 ? `${r1(sg)} g` : '';
  }
  if (old && old.key && old.key !== food.key) delete S.foods[old.key];
  S.foods[food.key] = { ...(S.foods[food.key] || {}), ...food };
  save();
  if (ef.fromDetail) {
    // back to the detail sheet with the updated food
    closeTop();
    fd.food = structuredClone(food);
    fillFoodSheet(num($('#fdQty').value), $('#fdUnit').value);
  } else {
    openFood(food, { meal: addMeal, replace: true });
  }
  toast('Food saved');
});
$('#createFoodBtn').addEventListener('click', () => openEdit(null, { name: $('#searchInput').value.trim().replace(/^\d+$/, '') }));

/* ---------- quick add ---------- */
$('#quickAddBtn').addEventListener('click', () => {
  $('#quickForm').reset();
  replaceTop('quickSheet');
});
$('#quickForm').addEventListener('submit', e => {
  e.preventDefault();
  const p = num($('#qP').value), c = num($('#qC').value), f = num($('#qF').value);
  let kcal = num($('#qKcal').value);
  if (!kcal) kcal = p * 4 + c * 4 + f * 9;
  if (!kcal) return toast('Enter calories or macros');
  const food = { key: 'q:' + uid(), name: $('#qName').value.trim() || 'Quick add', per100: { kcal, p, c, f }, servingG: 100, servingOnly: true, servingLabel: 'serving', quick: true };
  (S.log[day] ||= []).push({ id: uid(), meal: addMeal, food, qty: 1, unit: 'serving' });
  save(); closeAll(); render();
  toast(`Added to ${MEALS[addMeal]}`);
});

/* ---------- barcode scanner ---------- */
let scan = null; // { stream, timer, controls, track }
$('#scanBtn').addEventListener('click', startScan);
$('#scanClose').addEventListener('click', closeTop);
async function startScan() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return toast('Camera not available. Open the app over https in Chrome.');
  }
  $('#scanMsg').textContent = 'Starting camera…';
  $('#torchBtn').hidden = true;
  openOverlay('scanner');
  const session = (scan = { done: false });
  const video = $('#scanVideo');
  const onCode = code => {
    if (session.done) return;
    session.done = true;
    stopScan();
    lookupBarcode(code, true);
  };
  try {
    if ('BarcodeDetector' in window) {
      const supported = await BarcodeDetector.getSupportedFormats();
      const want = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'].filter(f => supported.includes(f));
      if (want.length) return await nativeScan(session, video, want, onCode);
    }
    await zxingScan(session, video, onCode);
  } catch (err) {
    if (session !== scan) return;
    console.error(err);
    const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
    toast(denied ? 'Camera permission denied. Allow it in the browser site settings.' : 'Could not start the scanner. Type the barcode in the search box instead.');
    closeTop();
  }
}
async function openCamera() {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
  });
}
async function nativeScan(session, video, formats, onCode) {
  const stream = await openCamera();
  if (session !== scan || session.done) { stream.getTracks().forEach(t => t.stop()); return; }
  session.stream = stream;
  const track = stream.getVideoTracks()[0];
  session.track = track;
  try {
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (caps.focusMode && caps.focusMode.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
    if (caps.torch) $('#torchBtn').hidden = false;
  } catch (e) { /* optional */ }
  video.srcObject = stream;
  await video.play();
  $('#scanMsg').textContent = 'Point the camera at a barcode';
  const detector = new BarcodeDetector({ formats });
  let last = '', hits = 0;
  const tick = async () => {
    if (session.done || session !== scan) return;
    try {
      const codes = await detector.detect(video);
      const c = codes.find(x => /^\d{6,14}$/.test(x.rawValue)) || codes[0];
      if (c) {
        // require two consistent reads to avoid misreads
        if (c.rawValue === last) hits++; else { last = c.rawValue; hits = 1; }
        if (hits >= 2) return onCode(c.rawValue);
      }
    } catch (e) { /* frame not ready */ }
    session.timer = setTimeout(tick, 120);
  };
  tick();
}
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}
async function zxingScan(session, video, onCode) {
  if (!window.ZXingBrowser) await loadScript('vendor/zxing-browser.min.js');
  if (session !== scan || session.done) return;
  const reader = new ZXingBrowser.BrowserMultiFormatReader();
  $('#scanMsg').textContent = 'Point the camera at a barcode';
  session.controls = await reader.decodeFromConstraints(
    { audio: false, video: { facingMode: { ideal: 'environment' } } }, video,
    result => { if (result) onCode(result.getText()); });
  if (session !== scan || session.done) session.controls.stop();
}
function stopScan() {
  const s = scan;
  if (!s) return;
  s.done = true;
  clearTimeout(s.timer);
  if (s.controls) { try { s.controls.stop(); } catch (e) { /* ignore */ } }
  if (s.stream) s.stream.getTracks().forEach(t => t.stop());
  const v = $('#scanVideo'); v.pause(); v.srcObject = null;
  scan = null;
}
let torchOn = false;
$('#torchBtn').addEventListener('click', async () => {
  if (!scan || !scan.track) return;
  torchOn = !torchOn;
  try { await scan.track.applyConstraints({ advanced: [{ torch: torchOn }] }); } catch (e) { torchOn = false; }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && scan) closeTop(); });

/* ---------- weight ---------- */
$('#weightForm').addEventListener('submit', e => {
  e.preventDefault();
  const v = num($('#weightInput').value);
  if (v <= 0) return;
  S.weights[day] = Math.round(fromDisp(v) * 100) / 100;
  save(); $('#weightInput').value = ''; renderWeight(); toast('Weight logged');
});
function weightSeries() {
  const days = Object.keys(S.weights).sort();
  let trend = null;
  return days.map(d => {
    const w = S.weights[d];
    trend = trend == null ? w : trend + 0.1 * (w - trend);
    return { d, w, t: trend };
  });
}
function renderWeight() {
  const u = S.unit;
  $('#weightUnit').textContent = u;
  $('#weightInput').placeholder = S.weights[day] ? `Logged ${r1(toDisp(S.weights[day]))}` : `Weight (${dayLabel().toLowerCase()})`;
  const ser = weightSeries();
  const list = $('#weightList');
  list.innerHTML = ser.length ? ser.slice().reverse().slice(0, 60).map(x =>
    `<li data-d="${x.d}"><div class="grow"><div class="name">${parseYmd(x.d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
     <div class="sub">Trend ${r1(toDisp(x.t))} ${u}</div></div><div class="kcal">${r1(toDisp(x.w))} ${u}</div>
     <button class="del" data-wdel="${x.d}" aria-label="Delete">✕</button></li>`).join('')
    : '<li class="empty">No weigh-ins yet.</li>';

  const svg = $('#weightChart');
  const pts = ser.slice(-60);
  if (pts.length < 2) {
    svg.innerHTML = `<text x="160" y="85" text-anchor="middle" fill="currentColor" opacity=".5" font-size="12">Log at least 2 weigh-ins to see your trend</text>`;
    $('#trendStat').textContent = '';
    return;
  }
  const vals = pts.flatMap(p => [p.w, p.t]).map(toDisp);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
  const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
  const t0 = parseYmd(pts[0].d).getTime(), t1 = parseYmd(pts[pts.length - 1].d).getTime() || t0 + 1;
  const X = d => 8 + ((parseYmd(d).getTime() - t0) / (t1 - t0 || 1)) * 304;
  const Y = v => 150 - ((toDisp(v) - lo) / (hi - lo)) * 140;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.d).toFixed(1)},${Y(p.t).toFixed(1)}`).join('');
  svg.innerHTML =
    `<text x="4" y="12" font-size="10" fill="currentColor" opacity=".5">${r1(hi)}</text>
     <text x="4" y="156" font-size="10" fill="currentColor" opacity=".5">${r1(lo)}</text>` +
    pts.map(p => `<circle cx="${X(p.d).toFixed(1)}" cy="${Y(p.w).toFixed(1)}" r="2.5" fill="var(--muted)" opacity=".7"/>`).join('') +
    `<path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  // weekly rate from trend over last ~14 days
  const last = ser[ser.length - 1];
  const ref = ser.slice().reverse().find(x => (parseYmd(last.d) - parseYmd(x.d)) / 864e5 >= 7) || ser[0];
  const daysSpan = (parseYmd(last.d) - parseYmd(ref.d)) / 864e5;
  if (daysSpan >= 3) {
    const perWeek = toDisp(last.t - ref.t) / daysSpan * 7;
    $('#trendStat').textContent = `${perWeek >= 0 ? '+' : ''}${r1(perWeek)} ${u}/week`;
  } else $('#trendStat').textContent = '';
}
$('#weightList').addEventListener('click', e => {
  const del = e.target.closest('[data-wdel]');
  if (del) { delete S.weights[del.dataset.wdel]; save(); renderWeight(); return; }
  const li = e.target.closest('li[data-d]');
  if (li) { day = li.dataset.d; render(); $('#weightInput').focus(); }
});

/* ---------- settings ---------- */
function renderSettings() {
  const g = S.goals;
  $('#gKcal').value = r0(g.kcal); $('#gP').value = r0(g.p); $('#gC').value = r0(g.c); $('#gF').value = r0(g.f);
  goalCheck();
  $('#unitSel').value = S.unit;
  $$('.wu').forEach(x => (x.textContent = S.unit));
  const pr = S.profile;
  if (pr.sex) $('#cSex').value = pr.sex;
  if (pr.age) $('#cAge').value = pr.age;
  if (pr.height) $('#cHeight').value = pr.height;
  if (pr.act) $('#cAct').value = pr.act;
  if (pr.goal) $('#cGoal').value = pr.goal;
  const lastW = Object.keys(S.weights).sort().pop();
  if (lastW) $('#cWeight').value = r1(toDisp(S.weights[lastW]));
  else if (pr.weightKg) $('#cWeight').value = r1(toDisp(pr.weightKg));
}
function goalCheck() {
  const k = num($('#gP').value) * 4 + num($('#gC').value) * 4 + num($('#gF').value) * 9;
  $('#goalCheck').textContent = `Your macros add up to ${r0(k)} kcal (protein & carbs 4 kcal/g, fat 9 kcal/g).`;
}
['#gP', '#gC', '#gF'].forEach(s => $(s).addEventListener('input', goalCheck));
$('#goalForm').addEventListener('submit', e => {
  e.preventDefault();
  S.goals = { kcal: num($('#gKcal').value), p: num($('#gP').value), c: num($('#gC').value), f: num($('#gF').value) };
  save(); toast('Targets saved');
});
$('#calcForm').addEventListener('submit', e => {
  e.preventDefault();
  const sex = $('#cSex').value, age = num($('#cAge').value), h = num($('#cHeight').value);
  const w = fromDisp(num($('#cWeight').value)), act = num($('#cAct').value), goal = $('#cGoal').value;
  S.profile = { sex, age, height: h, weightKg: w, act: $('#cAct').value, goal };
  // Mifflin-St Jeor
  const bmr = 10 * w + 6.25 * h - 5 * age + (sex === 'm' ? 5 : -161);
  const tdee = bmr * act;
  const adj = { cut: -550, slowcut: -275, maintain: 0, leanbulk: 275, bulk: 550 }[goal];
  const kcal = Math.round((tdee + adj) / 10) * 10;
  const p = Math.round(w * (goal.includes('cut') ? 2.2 : 2.0));
  const f = Math.round((kcal * 0.25) / 9);
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
  S.goals = { kcal, p, c, f };
  save(); renderSettings();
  $('#calcOut').textContent = `Estimated maintenance: ${r0(tdee)} kcal/day. Targets set to ${kcal} kcal · P ${p} g · C ${c} g · F ${f} g. Re-check every few weeks using your weight trend.`;
  toast('Targets updated');
});
$('#unitSel').addEventListener('change', e => { S.unit = e.target.value; save(); renderSettings(); });
const native = () => !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
$('#exportBtn').addEventListener('click', async () => {
  const name = `macros-backup-${ymd(new Date())}.json`;
  const json = JSON.stringify(S, null, 1);
  if (native()) {
    // Android app: downloads don't work in the WebView, so save to a file and open the share sheet
    try {
      const { Filesystem, Share } = Capacitor.Plugins;
      const { uri } = await Filesystem.writeFile({ path: name, data: json, directory: 'CACHE', encoding: 'utf8' });
      await Share.share({ title: 'Macros backup', files: [uri] });
    } catch (e) {
      if (!/cancel/i.test(String(e && e.message))) toast('Export failed');
    }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
$('#importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== 'object' || !data.goals || !data.log) throw new Error('bad file');
    if (!confirm('Replace all current data with this backup?')) return;
    S = Object.assign(structuredClone(DEFAULT), data);
    save(); render(); toast('Backup restored');
  } catch (err) { toast('That file is not a valid backup'); }
  e.target.value = '';
});
$('#resetBtn').addEventListener('click', () => {
  if (!confirm('Erase ALL food logs, foods, weights and settings from this phone?')) return;
  S = structuredClone(DEFAULT); save(); render(); toast('All data erased');
});

/* ---------- boot ---------- */
// roll over to the new day if the app is left open overnight
let bootDay = ymd(new Date());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  const now = ymd(new Date());
  if (now !== bootDay) { if (day === bootDay) day = now; bootDay = now; render(); }
});
render();
if ('serviceWorker' in navigator && location.protocol === 'https:' && !native()) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
