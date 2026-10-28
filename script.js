(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const clone = c => { const n = mk(c.width, c.height); n.getContext('2d').drawImage(c, 0, 0); return n; };
const DEF = { br: 100, co: 100, sa: 100, gr: 0, se: 0, iv: 0, vi: 0 };
const ADJ = [['br','Brightness',0,200],['co','Contrast',0,200],['sa','Saturation',0,200],['gr','Grayscale',0,100],['se','Sepia',0,100],['iv','Invert',0,100],['vi','Vignette',0,100]];
const PRE = { Original: {}, 'B&W': { gr: 100, co: 110 }, Sepia: { se: 100 }, Vivid: { sa: 155, co: 110 }, Fade: { br: 110, co: 85, sa: 80 }, Noir: { gr: 100, co: 140, vi: 60 } };
const EMO = ['😀','😎','😍','🥳','😂','🤩','🔥','⭐','❤️','👍','🎉','✨','🌈','☀️','🌙','🍕','🐱','🐶','🌸','🚀','💎','👑','🎈','📍'];
const vp = $('#vp'), pz = $('#pz'), cv = $('#cv'), cb = $('#cb');
const HAS_F = 'filter' in CanvasRenderingContext2D.prototype, mc = mk(1, 1).getContext('2d');
let S = { base: null, ink: null, L: [], a: { ...DEF }, sel: -1 }, hist = [], hi = -1, mode = 'move', name = 'image', K = null, drag = null, space = false, raf = 0, dims = '';
const V = { z: 1, x: 0, y: 0, f: 1 };

/* ---------- Rendering ---------- */
const filt = a => `brightness(${a.br}%) contrast(${a.co}%) saturate(${a.sa}%) grayscale(${a.gr}%) sepia(${a.se}%) invert(${a.iv}%)`;
function pxFilter(c, w, h, a) { // fallback for browsers without canvas filters (Safari)
  const im = c.getImageData(0, 0, w, h), d = im.data, br = a.br / 100, co = a.co / 100, sa = a.sa / 100, gr = a.gr / 100, se = a.se / 100, iv = a.iv / 100;
  for (let i = 0; i < d.length; i += 4) {
    let r = (d[i] * br - 128) * co + 128, g = (d[i + 1] * br - 128) * co + 128, b = (d[i + 2] * br - 128) * co + 128, l = .2126 * r + .7152 * g + .0722 * b;
    r = l + (r - l) * sa; g = l + (g - l) * sa; b = l + (b - l) * sa;
    l = .2126 * r + .7152 * g + .0722 * b; r += (l - r) * gr; g += (l - g) * gr; b += (l - b) * gr;
    const sr = .393 * r + .769 * g + .189 * b, sg = .349 * r + .686 * g + .168 * b, sb = .272 * r + .534 * g + .131 * b;
    r += (sr - r) * se; g += (sg - g) * se; b += (sb - b) * se;
    d[i] = r + (255 - 2 * r) * iv; d[i + 1] = g + (255 - 2 * g) * iv; d[i + 2] = b + (255 - 2 * b) * iv;
  }
  c.putImageData(im, 0, 0);
}
const font = L => L.k === 's' ? `${L.sz}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif` : `${L.wt} ${L.sz}px ${L.ff}`;
function bbox(L) {
  if (L.k === 's') return { w: L.sz * 1.25, h: L.sz * 1.25 };
  mc.font = font(L); const ls = L.t.split('\n');
  return { w: Math.max(...ls.map(l => mc.measureText(l).width)), h: ls.length * L.sz * 1.2 };
}
function drawLayer(c, L) {
  c.globalAlpha = L.o / 100; c.font = font(L); c.textBaseline = 'middle';
  if (L.k === 's') { c.textAlign = 'center'; c.fillText(L.t, L.x, L.y); }
  else {
    const ls = L.t.split('\n'), lh = L.sz * 1.2, w = bbox(L).w, left = L.x - w / 2; c.fillStyle = L.col; c.textAlign = L.al;
    ls.forEach((l, i) => c.fillText(l, L.al === 'left' ? left : L.al === 'center' ? L.x : left + w, L.y - ls.length * lh / 2 + lh / 2 + i * lh));
  }
  c.globalAlpha = 1;
}
function render(t, s, prev) {
  const W = S.base.width, H = S.base.height, w = Math.round(W * s), h = Math.round(H * s), c = t.getContext('2d');
  if (t.width !== w || t.height !== h) { t.width = w; t.height = h; } else c.clearRect(0, 0, w, h);
  const act = ADJ.some(([k]) => k !== 'vi' && S.a[k] !== DEF[k]);
  if (HAS_F && act) c.filter = filt(S.a);
  c.drawImage(S.base, 0, 0, w, h); c.filter = 'none';
  if (!HAS_F && act) pxFilter(c, w, h, S.a);
  if (S.a.vi) {
    const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .25, w / 2, h / 2, Math.hypot(w, h) / 2);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${S.a.vi / 100 * .9})`); c.fillStyle = g; c.fillRect(0, 0, w, h);
  }
  c.drawImage(S.ink, 0, 0, w, h);
  c.save(); c.scale(s, s); S.L.forEach(L => drawLayer(c, L));
  if (prev && S.L[S.sel]) { const L = S.L[S.sel], b = bbox(L); c.setLineDash([6 / s, 4 / s]); c.lineWidth = 2 / s; c.strokeStyle = '#fff'; c.strokeRect(L.x - b.w / 2 - 6, L.y - b.h / 2 - 6, b.w + 12, b.h + 12); }
  c.restore();
}
const draw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => render(cv, Math.min(1, 2400 / Math.max(S.base.width, S.base.height)), true)); };

/* ---------- View: zoom and pan ---------- */
function view() { pz.style.transform = `translate(${V.x}px,${V.y}px) scale(${V.z})`; pz.style.setProperty('--z', V.z); $('#zl').textContent = Math.round(V.f * V.z * 100) + '%'; }
function fitView() {
  const r = vp.getBoundingClientRect(), W = S.base.width, H = S.base.height;
  V.f = Math.min((r.width - 40) / W, (r.height - 40) / H, 4); V.z = 1;
  pz.style.width = W * V.f + 'px'; pz.style.height = H * V.f + 'px';
  V.x = (r.width - W * V.f) / 2; V.y = (r.height - H * V.f) / 2; dims = W + 'x' + H; view();
}
function zoomAt(x, y, nz) {
  const r = vp.getBoundingClientRect(), px = x - r.left, py = y - r.top; nz = clamp(nz, .2, 20);
  V.x = px - (px - V.x) * nz / V.z; V.y = py - (py - V.y) * nz / V.z; V.z = nz; view();
}
const zc = k => { const r = vp.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, V.z * k); };
$('#zi').onclick = () => zc(1.25); $('#zo').onclick = () => zc(.8); $('#fit').onclick = () => S.base && fitView();
vp.addEventListener('wheel', e => { if (!S.base) return; e.preventDefault(); zoomAt(e.clientX, e.clientY, V.z * Math.exp(-e.deltaY * .0015)); }, { passive: false });
addEventListener('resize', () => S.base && fitView());
const toImg = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * S.base.width, y: (e.clientY - r.top) / r.height * S.base.height }; };

/* ---------- History ---------- */
const snap = () => ({ b: S.base, i: S.ink, L: JSON.stringify(S.L), a: JSON.stringify(S.a) });
const btns = () => { $('#undo').disabled = hi <= 0; $('#redo').disabled = hi >= hist.length - 1; };
function commit() { hist = hist.slice(0, hi + 1); hist.push(snap()); if (hist.length > 20) hist.shift(); hi = hist.length - 1; btns(); }
function go(n) {
  if (n < 0 || n >= hist.length) return; hi = n; const s = hist[n];
  S.base = s.b; S.ink = s.i; S.L = JSON.parse(s.L); S.a = JSON.parse(s.a); S.sel = -1; syncAll(); refresh(); btns();
}
$('#undo').onclick = () => go(hi - 1); $('#redo').onclick = () => go(hi + 1);
function refresh() { if (dims !== S.base.width + 'x' + S.base.height) fitView(); if (mode === 'crop') initK(); syncSize(); draw(); }

/* ---------- Geometry: crop, resize, rotate, flip ---------- */
function geo(nw, nh, fn, mapL) {
  const nb = mk(nw, nh), ni = mk(nw, nh); fn(nb.getContext('2d'), S.base); fn(ni.getContext('2d'), S.ink);
  S.L.forEach(mapL); S.base = nb; S.ink = ni; S.sel = -1; commit(); syncAll(); refresh();
}
const W_ = () => S.base.width, H_ = () => S.base.height;
$('#rr').onclick = () => { const W = W_(), H = H_(); geo(H, W, (c, s) => { c.translate(H, 0); c.rotate(Math.PI / 2); c.drawImage(s, 0, 0); }, L => { const x = L.x; L.x = H - L.y; L.y = x; }); };
$('#rl').onclick = () => { const W = W_(), H = H_(); geo(H, W, (c, s) => { c.translate(0, W); c.rotate(-Math.PI / 2); c.drawImage(s, 0, 0); }, L => { const x = L.x; L.x = L.y; L.y = W - x; }); };
$('#fh').onclick = () => { const W = W_(); geo(W, H_(), (c, s) => { c.translate(W, 0); c.scale(-1, 1); c.drawImage(s, 0, 0); }, L => { L.x = W - L.x; }); };
$('#fv').onclick = () => { const H = H_(); geo(W_(), H, (c, s) => { c.translate(0, H); c.scale(1, -1); c.drawImage(s, 0, 0); }, L => { L.y = H - L.y; }); };
const rw = $('#rw'), rh = $('#rh'), rp = $('#rp'), lk = $('#lk');
rw.oninput = () => { if (lk.checked) rh.value = Math.round(rw.value * H_() / W_()); rp.value = Math.round(rw.value / W_() * 100); };
rh.oninput = () => { if (lk.checked) rw.value = Math.round(rh.value * W_() / H_()); rp.value = Math.round(rh.value / H_() * 100); };
rp.oninput = () => { rw.value = Math.round(W_() * rp.value / 100); rh.value = Math.round(H_() * rp.value / 100); };
$('#rap').onclick = () => {
  const W = W_(), H = H_(), nw = clamp(Math.round(rw.value) || 1, 1, 6000), nh = clamp(Math.round(rh.value) || 1, 1, 6000);
  geo(nw, nh, (c, s) => { c.imageSmoothingQuality = 'high'; c.drawImage(s, 0, 0, nw, nh); }, L => { L.x *= nw / W; L.y *= nh / H; L.sz *= (nw / W + nh / H) / 2; });
};

/* ---------- Crop box ---------- */
const ratio = () => { const v = $('#cr').value; return v === 'free' ? 0 : v === 'orig' ? W_() / H_() : v.split(':').map(Number).reduce((a, b) => a / b); };
function paintK() {
  const W = W_(), H = H_();
  Object.assign(cb.style, { left: K.x / W * 100 + '%', top: K.y / H * 100 + '%', width: K.w / W * 100 + '%', height: K.h / H * 100 + '%' });
  $('#ci').textContent = Math.round(K.w) + ' × ' + Math.round(K.h) + ' px';
}
function fitR() { const r = ratio(); if (!r) return; let w = K.w, h = w / r; if (h > K.h) { h = K.h; w = h * r; } K = { x: K.x + (K.w - w) / 2, y: K.y + (K.h - h) / 2, w, h }; }
function initK() { const W = W_(), H = H_(); K = { x: W * .1, y: H * .1, w: W * .8, h: H * .8 }; fitR(); paintK(); }
function resizeR(hd, s, dx, dy) {
  const W = W_(), H = H_(), MIN = 16, r = ratio(), hw = hd.includes('w'), he = hd.includes('e'), hn = hd.includes('n'), hs = hd.includes('s');
  let L = s.x, T = s.y, R = s.x + s.w, B = s.y + s.h;
  if (hw) L = clamp(L + dx, 0, R - MIN); if (he) R = clamp(R + dx, L + MIN, W);
  if (hn) T = clamp(T + dy, 0, B - MIN); if (hs) B = clamp(B + dy, T + MIN, H);
  if (!r) return { x: L, y: T, w: R - L, h: B - T };
  const hx = hw || he, hy = hn || hs; let w = R - L, h = B - T;
  if (hx && hy) { w = Math.max(w, h * r); h = w / r; } else if (hx) h = w / r; else w = h * r;
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  const k = Math.min(1, (hw ? s.x + s.w : he ? W - s.x : 2 * Math.min(cx, W - cx)) / w, (hn ? s.y + s.h : hs ? H - s.y : 2 * Math.min(cy, H - cy)) / h);
  w *= k; h *= k; if (w < MIN || h < MIN) return s;
  return { x: hw ? s.x + s.w - w : he ? s.x : cx - w / 2, y: hn ? s.y + s.h - h : hs ? s.y : cy - h / 2, w, h };
}
cb.addEventListener('pointerdown', e => {
  e.stopPropagation(); e.preventDefault(); cb.setPointerCapture(e.pointerId);
  drag = { t: 'crop', h: e.target.dataset.h || 'move', x: e.clientX, y: e.clientY, s: { ...K }, k: W_() / cv.getBoundingClientRect().width };
});
cb.addEventListener('pointermove', e => {
  if (drag?.t !== 'crop') return; const dx = (e.clientX - drag.x) * drag.k, dy = (e.clientY - drag.y) * drag.k, s = drag.s;
  K = drag.h === 'move' ? { x: clamp(s.x + dx, 0, W_() - s.w), y: clamp(s.y + dy, 0, H_() - s.h), w: s.w, h: s.h } : resizeR(drag.h, s, dx, dy); paintK();
});
cb.addEventListener('pointerup', () => { drag = null; });
$('#cr').onchange = () => { fitR(); paintK(); }; $('#cc').onclick = initK;
$('#ca').onclick = () => {
  const W = W_(), H = H_(), x = clamp(Math.round(K.x), 0, W - 1), y = clamp(Math.round(K.y), 0, H - 1), w = clamp(Math.round(K.w), 1, W - x), h = clamp(Math.round(K.h), 1, H - y);
  geo(w, h, (c, s) => c.drawImage(s, -x, -y), L => { L.x -= x; L.y -= y; });
};

/* ---------- Pointer: move layers, draw, pan ---------- */
function hit(p) { for (let i = S.L.length - 1; i >= 0; i--) { const L = S.L[i], b = bbox(L); if (Math.abs(p.x - L.x) <= b.w / 2 + 8 && Math.abs(p.y - L.y) <= b.h / 2 + 8) return i; } return -1; }
function inkSeg(a, b) {
  const c = S.ink.getContext('2d'); c.globalCompositeOperation = $('#er').checked ? 'destination-out' : 'source-over';
  c.strokeStyle = $('#bc').value; c.lineWidth = +$('#bs').value; c.lineCap = c.lineJoin = 'round'; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x + .01, b.y); c.stroke();
}
vp.addEventListener('pointerdown', e => {
  if (!S.base) return; vp.setPointerCapture(e.pointerId);
  const pan = () => { drag = { t: 'pan', x: e.clientX, y: e.clientY }; vp.classList.add('pan'); };
  if (e.button === 1 || space) return pan();
  const p = toImg(e);
  if (mode === 'draw') { S.ink = clone(S.ink); drag = { t: 'ink', lx: p.x, ly: p.y }; inkSeg(p, p); return draw(); }
  if (mode === 'move') {
    const i = hit(p); S.sel = i; syncL(); draw();
    if (i >= 0) { drag = { t: 'layer', ox: p.x - S.L[i].x, oy: p.y - S.L[i].y }; return; }
  }
  pan();
});
vp.addEventListener('pointermove', e => {
  if (!drag) return;
  if (drag.t === 'pan') { V.x += e.clientX - drag.x; V.y += e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; view(); }
  else if (drag.t === 'layer') { const p = toImg(e), L = S.L[S.sel]; L.x = p.x - drag.ox; L.y = p.y - drag.oy; draw(); }
  else if (drag.t === 'ink') { const p = toImg(e); inkSeg({ x: drag.lx, y: drag.ly }, p); drag.lx = p.x; drag.ly = p.y; draw(); }
});
['pointerup', 'pointercancel'].forEach(t => vp.addEventListener(t, () => { if (drag && (drag.t === 'layer' || drag.t === 'ink')) commit(); drag = null; vp.classList.remove('pan'); }));

/* ---------- Filters ---------- */
$('#adj').innerHTML = ADJ.map(([k, l, a, b]) => `<div><label class="lbl" for="r_${k}">${l} <span class="hint" id="v_${k}">${DEF[k]}</span></label><input type="range" id="r_${k}" min="${a}" max="${b}" value="${DEF[k]}"></div>`).join('');
$('#pre').innerHTML = Object.keys(PRE).map(n => `<button data-p="${n}">${n}</button>`).join('');
const syncAdj = () => ADJ.forEach(([k]) => { $('#r_' + k).value = S.a[k]; $('#v_' + k).textContent = S.a[k]; });
$('#adj').addEventListener('input', e => { const k = e.target.id.slice(2); S.a[k] = +e.target.value; $('#v_' + k).textContent = e.target.value; draw(); });
$('#adj').addEventListener('change', commit);
$('#pre').addEventListener('click', e => { const p = PRE[e.target.dataset.p]; if (!p) return; S.a = { ...DEF, ...p }; syncAdj(); commit(); draw(); });

/* ---------- Text and stickers ---------- */
$('#em').innerHTML = EMO.map(s => `<button aria-label="Add sticker ${s}">${s}</button>`).join('');
const addL = L => { S.L.push({ x: W_() / 2, y: H_() / 2, o: 100, ...L }); S.sel = S.L.length - 1; commit(); syncL(); draw(); };
$('#at').onclick = () => addL({ k: 't', t: 'Your text', sz: Math.round(Math.min(W_(), H_()) / 8), ff: 'Sora, sans-serif', wt: 600, col: '#ffffff', al: 'center' });
$('#em').addEventListener('click', e => { const b = e.target.closest('button'); if (b) addL({ k: 's', t: b.textContent, sz: Math.round(Math.min(W_(), H_()) / 4) }); });
function syncL() {
  const L = S.L[S.sel]; $('#lp').hidden = !L; $('#lp').style.display = L ? 'grid' : 'none'; if (!L) return;
  $('#tx').style.display = L.k === 't' ? 'grid' : 'none';
  if (L.k === 't') { $('#tt').value = L.t; $('#tf').value = L.ff; $('#tw').value = L.wt; $('#tc').value = L.col; $$('.al').forEach(b => b.classList.toggle('on', b.dataset.a === L.al)); }
  $('#tz').max = Math.round(Math.max(W_(), H_()) / 2); $('#tz').value = L.sz; $('#to').value = L.o;
}
const upd = f => e => { const L = S.L[S.sel]; if (L) { f(L, e.target); draw(); } };
$('#tt').oninput = upd((L, t) => L.t = t.value || ' '); $('#tf').onchange = upd((L, t) => L.ff = t.value); $('#tw').onchange = upd((L, t) => L.wt = t.value);
$('#tc').oninput = upd((L, t) => L.col = t.value); $('#tz').oninput = upd((L, t) => L.sz = +t.value); $('#to').oninput = upd((L, t) => L.o = +t.value);
$('#lp').addEventListener('change', commit);
$$('.al').forEach(b => b.onclick = () => { const L = S.L[S.sel]; if (L) { L.al = b.dataset.a; syncL(); commit(); draw(); } });
$('#td').onclick = () => { if (S.sel < 0) return; S.L.splice(S.sel, 1); S.sel = -1; commit(); syncL(); draw(); };
$('#bs').oninput = e => { $('#bv').textContent = e.target.value; };

/* ---------- Modes, sync ---------- */
function setMode(m) { mode = m; vp.dataset.mode = m; cb.hidden = m !== 'crop'; if (m === 'crop' && S.base) initK(); }
$$('details.sec').forEach(d => d.addEventListener('toggle', () => {
  if (d.open) { $$('details.sec').forEach(o => o !== d && (o.open = false)); setMode(d.dataset.t); }
  else if (!$$('details.sec').some(x => x.open)) setMode('move');
}));
function syncSize() { rw.value = W_(); rh.value = H_(); rp.value = 100; $('#ei').textContent = `Output: ${W_()} × ${H_()} px`; }
function syncAll() { syncAdj(); syncL(); syncSize(); }

/* ---------- Load and export ---------- */
function load(file) {
  if (!file || !/^image\/(png|jpe?g|webp)$/.test(file.type)) return alert('Unsupported file. Choose a JPG, PNG or WEBP image.');
  name = file.name.replace(/\.[^.]+$/, '') || 'image';
  const u = URL.createObjectURL(file), im = new Image();
  im.onload = () => {
    const k = Math.min(1, 4096 / Math.max(im.naturalWidth, im.naturalHeight)), b = mk(Math.round(im.naturalWidth * k), Math.round(im.naturalHeight * k));
    b.getContext('2d').drawImage(im, 0, 0, b.width, b.height);
    S = { base: b, ink: mk(b.width, b.height), L: [], a: { ...DEF }, sel: -1 }; hist = []; hi = -1; commit();
    document.body.classList.add('has'); vp.classList.add('has'); pz.hidden = false; $('#drop').hidden = true;
    fitView(); syncAll(); setMode(mode); draw(); URL.revokeObjectURL(u);
  };
  im.onerror = () => alert('That image could not be read. Try a different file.'); im.src = u;
}
const pick = () => $('#file').click();
$('#open').onclick = pick; $('#drop').onclick = pick;
$('#drop').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
$('#file').onchange = e => { load(e.target.files[0]); e.target.value = ''; };
['dragenter', 'dragover'].forEach(t => vp.addEventListener(t, e => { e.preventDefault(); $('#drop').classList.add('over'); }));
['dragleave', 'drop'].forEach(t => vp.addEventListener(t, e => { e.preventDefault(); $('#drop').classList.remove('over'); }));
vp.addEventListener('drop', e => load(e.dataTransfer.files[0]));
document.addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/')); if (f) load(f); });
$('#fmt').onchange = () => { $('#qw').hidden = $('#fmt').value === 'image/png'; }; $('#qw').hidden = true;
$('#q').oninput = e => { $('#qv').textContent = e.target.value; };
$('#dl').onclick = () => {
  let t = mk(1, 1); render(t, 1, false); const fmt = $('#fmt').value;
  if (fmt === 'image/jpeg') { const f = mk(t.width, t.height), c = f.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, f.width, f.height); c.drawImage(t, 0, 0); t = f; }
  t.toBlob(b => {
    if (!b) return alert('Export failed. The image may be too large for this browser.');
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${name}-edited.${b.type === 'image/jpeg' ? 'jpg' : b.type === 'image/webp' ? 'webp' : 'png'}`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, fmt, $('#q').value / 100);
};

/* ---------- Keyboard ---------- */
addEventListener('keydown', e => {
  if (e.code === 'Space' && e.target === document.body && S.base) { space = true; e.preventDefault(); }
  const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && e.target.type !== 'range';
  if (!S.base || typing) return;
  const m = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (m && k === 'z') { e.preventDefault(); go(hi + (e.shiftKey ? 1 : -1)); }
  else if (m && k === 'y') { e.preventDefault(); go(hi + 1); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel >= 0) $('#td').click();
});
addEventListener('keyup', e => { if (e.code === 'Space') space = false; });
document.fonts?.load('600 20px Sora');
})();
