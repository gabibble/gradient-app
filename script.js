(function () {
  'use strict';

  var STORE = 'gradient-generator:v2';
  var MAX_STOPS = 8;
  var MIN_STOPS = 2;

  var DEFAULT_COLORS = ['#FFB199', '#FF7EB3', '#8F7BFF'];

  var PRESETS = [
    { name: 'Aurora', colors: DEFAULT_COLORS },
    { name: 'Citrus', colors: ['#FFE29A', '#FF9F6B'], type: 'radial', x: 25, y: 25 },
    { name: 'Matcha', colors: ['#D9F99D', '#5EC4A1'] },
    { name: 'Lagoon', colors: ['#A8EDEA', '#4A90D9'] },
    { name: 'Iris', colors: ['#C4B5FD', '#6366F1'], type: 'radial', x: 75, y: 25 },
    { name: 'Midnight', colors: ['#7F7FD5', '#232946'], type: 'radial', x: 50, y: 100 }
  ];

  // A preset sets the colors and the gradient type. Linear presets use the
  // default angle; radial ones carry their own center.
  var PRESET_ANGLE = 160;

  function presetSwatch(p) {
    var list = p.colors.join(', ');
    return p.type === 'radial'
      ? 'radial-gradient(circle at ' + p.x + '% ' + p.y + '%, ' + list + ')'
      : 'linear-gradient(' + PRESET_ANGLE + 'deg, ' + list + ')';
  }

  function applyPreset(p) {
    state.stops = evenStops(p.colors);
    state.type = p.type || 'linear';
    if (state.type === 'radial') {
      state.x = p.x;
      state.y = p.y;
    } else {
      state.angle = PRESET_ANGLE;
      state.x = 50;
      state.y = 50;
    }
  }

  function evenStops(colors) {
    return colors.map(function (c) { return { c: c, w: 1 / colors.length }; });
  }

  var state = load() || {
    type: 'linear',
    angle: 160,
    x: 50,
    y: 50,
    legacy: false,
    stops: evenStops(DEFAULT_COLORS)
  };

  var $ = function (id) { return document.getElementById(id); };
  var preview = $('preview');
  var cssOut = $('css');
  var blocksEl = $('blocks');
  var addBtn = $('add');
  var angleInput = $('angle');
  var dial = $('dial');
  var hand = $('hand');
  var pad = $('pad');
  var dot = $('dot');
  var centerOut = $('center-out');
  var legacyBtn = $('legacy');
  var picker = $('picker');
  var sv = $('sv');
  var svDot = $('sv-dot');
  var hue = $('hue');
  var pickerHex = $('picker-hex');
  var pngBtn = $('png');
  var pngMenu = $('png-menu');

  var mobile = window.matchMedia('(max-width: 760px)');

  /* ---------- persistence ---------- */

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE));
      if (!s || !Array.isArray(s.stops) || s.stops.length < MIN_STOPS) return null;
      if (['linear', 'radial', 'conic'].indexOf(s.type) < 0) return null;
      var ok = s.stops.every(function (st) {
        return /^#[0-9A-F]{6}$/i.test(st.c) && typeof st.w === 'number' && st.w > 0;
      });
      if (!ok) return null;
      normalize(s.stops);
      return s;
    } catch (e) { return null; }
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------- color helpers ---------- */

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  function parseHex(v) {
    v = String(v).trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(v)) v = v.replace(/./g, '$&$&');
    return /^[0-9a-f]{6}$/i.test(v) ? '#' + v.toUpperCase() : null;
  }

  function rgb(hex) {
    return [1, 3, 5].map(function (i) { return parseInt(hex.substr(i, 2), 16); });
  }

  function luminance(hex) {
    var c = rgb(hex).map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function hexToHsv(hex) {
    var c = rgb(hex).map(function (v) { return v / 255; });
    var max = Math.max(c[0], c[1], c[2]), min = Math.min(c[0], c[1], c[2]);
    var d = max - min, h = 0;
    if (d) {
      if (max === c[0]) h = ((c[1] - c[2]) / d) % 6;
      else if (max === c[1]) h = (c[2] - c[0]) / d + 2;
      else h = (c[0] - c[1]) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    return { h: h, s: max ? d / max : 0, v: max };
  }

  function hsvToHex(h, s, v) {
    var f = function (n) {
      var k = (n + h / 60) % 6;
      var val = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
      return ('0' + Math.round(val * 255).toString(16)).slice(-2);
    };
    return ('#' + f(5) + f(3) + f(1)).toUpperCase();
  }

  function nextColor(hex) {
    var c = hexToHsv(hex);
    if (c.s < 0.15) { c.s = 0.6; c.v = clamp(c.v, 0.6, 0.95); }
    return hsvToHex((c.h + 40) % 360, c.s, c.v);
  }

  /* ---------- gradient model ----------
     Each color has a weight (its share of the block row). A color's stop
     position is the center of its block, rescaled so the first color sits
     at 0% and the last at 100%. */

  function normalize(stops) {
    var total = stops.reduce(function (t, s) { return t + s.w; }, 0);
    stops.forEach(function (s) { s.w /= total; });
  }

  function minWeight() { return Math.min(0.08, 0.5 / state.stops.length); }

  function positions() {
    var centers = [], acc = 0;
    state.stops.forEach(function (s) { centers.push(acc + s.w / 2); acc += s.w; });
    var first = centers[0], span = centers[centers.length - 1] - first;
    return centers.map(function (c) { return Math.round(((c - first) / span) * 100); });
  }

  function isEven() {
    var ws = state.stops.map(function (s) { return s.w; });
    return Math.max.apply(null, ws) - Math.min.apply(null, ws) < 0.002;
  }

  function colorList() {
    var p = positions(), n = state.stops.length, even = isEven();
    return state.stops.map(function (s, i) {
      return even || i === 0 || i === n - 1 ? s.c : s.c + ' ' + p[i] + '%';
    }).join(', ');
  }

  function centered() { return state.x === 50 && state.y === 50; }

  function gradient() {
    var list = colorList();
    var at = centered() ? '' : ' at ' + state.x + '% ' + state.y + '%';
    if (state.type === 'radial') return 'radial-gradient(circle' + at + ', ' + list + ')';
    if (state.type === 'conic') return 'conic-gradient(from ' + state.angle + 'deg' + at + ', ' + list + ')';
    return 'linear-gradient(' + state.angle + 'deg, ' + list + ')';
  }

  // The old -webkit- syntax measures angles counter-clockwise from the right,
  // and puts a radial gradient's position before its shape. Conic has no
  // prefixed form.
  function legacyGradient() {
    var list = colorList();
    if (state.type === 'linear') {
      return '-webkit-linear-gradient(' + ((450 - state.angle) % 360) + 'deg, ' + list + ')';
    }
    if (state.type === 'radial') {
      var at = centered() ? '' : state.x + '% ' + state.y + '%, ';
      return '-webkit-radial-gradient(' + at + 'circle, ' + list + ')';
    }
    return null;
  }

  function cssText() {
    var lines = [];
    if (state.legacy) {
      lines.push('background: ' + state.stops[0].c + ';');
      var old = legacyGradient();
      if (old) lines.push('background: ' + old + ';');
    }
    lines.push('background: ' + gradient() + ';');
    return lines.join('\n');
  }

  /* ---------- rendering ---------- */

  function render() {
    closePicker();
    blocksEl.textContent = '';
    var n = state.stops.length;
    blocksEl.style.setProperty('--n', n);

    state.stops.forEach(function (stop, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'block';
      b.innerHTML = '<span class="hex"></span><span class="pct"></span>';
      b.addEventListener('click', function (e) {
        var r = b.getBoundingClientRect();
        var fromKeyboard = e.detail === 0;
        openPicker(i, fromKeyboard ? r.left + r.width / 2 : e.clientX, fromKeyboard ? r.top + r.height / 2 : e.clientY);
      });
      blocksEl.appendChild(b);
    });

    for (var i = 0; i < n - 1; i++) blocksEl.appendChild(makeGrip(i));

    if (n > MIN_STOPS) {
      state.stops.forEach(function (stop, i) {
        var rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'rm';
        rm.textContent = '×';
        rm.setAttribute('aria-label', 'Remove color ' + (i + 1));
        rm.addEventListener('click', function () { removeStop(i); });
        blocksEl.appendChild(rm);
      });
    }

    addBtn.hidden = n >= MAX_STOPS;
    update();
  }

  function makeGrip(i) {
    var g = document.createElement('div');
    g.className = 'grip';
    g.tabIndex = 0;
    g.setAttribute('role', 'separator');
    g.setAttribute('aria-label', 'Drag to change the blend between color ' + (i + 1) + ' and color ' + (i + 2));

    function moveTo(frac) {
      var before = 0;
      for (var k = 0; k < i; k++) before += state.stops[k].w;
      var end = before + state.stops[i].w + state.stops[i + 1].w;
      var m = minWeight();
      var edge = clamp(frac, before + m, end - m);
      state.stops[i].w = edge - before;
      state.stops[i + 1].w = end - edge;
      update();
    }

    function edgeNow() {
      var acc = 0;
      for (var k = 0; k <= i; k++) acc += state.stops[k].w;
      return acc;
    }

    var active = false;
    g.addEventListener('pointerdown', function (e) {
      active = true;
      g.classList.add('dragging');
      g.setPointerCapture(e.pointerId);
      closePicker();
      e.preventDefault();
    });
    g.addEventListener('pointermove', function (e) {
      if (!active) return;
      var r = blocksEl.getBoundingClientRect();
      moveTo(mobile.matches ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width);
    });
    ['pointerup', 'pointercancel'].forEach(function (t) {
      g.addEventListener(t, function () { active = false; g.classList.remove('dragging'); });
    });
    g.addEventListener('dblclick', function () {
      var half = (state.stops[i].w + state.stops[i + 1].w) / 2;
      state.stops[i].w = half;
      state.stops[i + 1].w = half;
      update();
    });
    g.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 0.05 : 0.01;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') moveTo(edgeNow() + step);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') moveTo(edgeNow() - step);
      else return;
      e.preventDefault();
    });
    return g;
  }

  function update() {
    var g = gradient();
    preview.style.background = g;
    cssOut.textContent = cssText();

    var avg = state.stops.reduce(function (t, s) { return t + luminance(s.c); }, 0) / state.stops.length;
    preview.classList.toggle('on-light', avg > 0.55);

    var p = positions();
    var blocks = blocksEl.querySelectorAll('.block');
    var grips = blocksEl.querySelectorAll('.grip');
    var rms = blocksEl.querySelectorAll('.rm');
    var acc = 0;
    state.stops.forEach(function (s, i) {
      var b = blocks[i];
      if (!b) return;
      b.style.setProperty('--size', (s.w * 100).toFixed(3) + '%');
      b.style.background = s.c;
      b.classList.toggle('on-light', luminance(s.c) > 0.55);
      b.querySelector('.hex').textContent = s.c;
      b.querySelector('.pct').textContent = p[i] + '%';
      b.setAttribute('aria-label', 'Color ' + (i + 1) + ', ' + s.c + ', at ' + p[i] + ' percent. Change color.');
      if (rms[i]) {
        rms[i].style.setProperty('--mid', ((acc + s.w / 2) * 100).toFixed(3) + '%');
        rms[i].style.setProperty('--end', ((acc + s.w) * 100).toFixed(3) + '%');
        rms[i].classList.toggle('on-light', luminance(s.c) > 0.55);
      }
      acc += s.w;
      if (grips[i]) grips[i].style.setProperty('--at', (acc * 100).toFixed(3) + '%');
    });

    document.querySelectorAll('[data-type]').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.type === state.type));
    });

    $('opt-angle').hidden = state.type === 'radial';
    $('opt-center').hidden = state.type === 'linear';

    hand.style.transform = 'rotate(' + state.angle + 'deg)';
    dial.setAttribute('aria-valuenow', state.angle);
    if (document.activeElement !== angleInput) angleInput.value = state.angle;

    dot.style.left = state.x + '%';
    dot.style.top = state.y + '%';
    centerOut.textContent = state.x + '% ' + state.y + '%';

    legacyBtn.setAttribute('aria-checked', String(!!state.legacy));

    save();
  }

  /* ---------- colors: add, remove, presets ---------- */

  addBtn.addEventListener('click', function () {
    var n = state.stops.length;
    if (n >= MAX_STOPS) return;
    state.stops.forEach(function (s) { s.w *= n / (n + 1); });
    state.stops.push({ c: nextColor(state.stops[n - 1].c), w: 1 / (n + 1) });
    normalize(state.stops);
    render();
  });

  function removeStop(i) {
    if (state.stops.length <= MIN_STOPS) return;
    state.stops.splice(i, 1);
    normalize(state.stops);
    render();
  }

  PRESETS.forEach(function (preset) {
    var b = document.createElement('button');
    b.type = 'button';
    b.title = preset.name;
    b.style.background = presetSwatch(preset);
    b.setAttribute('aria-label', preset.name + ' preset');
    b.addEventListener('click', function () {
      applyPreset(preset);
      render();
    });
    $('presets').appendChild(b);
  });

  /* ---------- color picker ---------- */

  var pick = { index: -1, h: 0, s: 0, v: 0 };

  function openPicker(i, clientX, clientY) {
    var c = hexToHsv(state.stops[i].c);
    pick.index = i;
    if (c.s > 0 && c.v > 0) pick.h = c.h;
    pick.s = c.s;
    pick.v = c.v;
    picker.hidden = false;
    syncPicker();

    var w = picker.offsetWidth, h = picker.offsetHeight, gap = 12, edge = 8;
    var x = clientX + gap, y = clientY + gap;
    if (x + w > window.innerWidth - edge) x = clientX - gap - w;
    if (y + h > window.innerHeight - edge) y = clientY - gap - h;
    x = clamp(x, edge, Math.max(edge, window.innerWidth - w - edge));
    y = clamp(y, edge, Math.max(edge, window.innerHeight - h - edge));
    picker.style.left = x + window.scrollX + 'px';
    picker.style.top = y + window.scrollY + 'px';
  }

  function closePicker() {
    if (picker.hidden) return;
    picker.hidden = true;
    pick.index = -1;
  }

  function syncPicker() {
    sv.style.background =
      'linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(' + Math.round(pick.h) + ', 100%, 50%))';
    svDot.style.left = pick.s * 100 + '%';
    svDot.style.top = (1 - pick.v) * 100 + '%';
    hue.value = Math.round(pick.h);
    if (document.activeElement !== pickerHex && pick.index >= 0) pickerHex.value = state.stops[pick.index].c;
  }

  function applyPick() {
    if (pick.index < 0) return;
    state.stops[pick.index].c = hsvToHex(pick.h, pick.s, pick.v);
    syncPicker();
    update();
  }

  hue.addEventListener('input', function () {
    pick.h = Number(hue.value) % 360;
    applyPick();
  });

  pickerHex.addEventListener('input', function () {
    var v = parseHex(pickerHex.value);
    if (!v || pick.index < 0) return;
    state.stops[pick.index].c = v;
    var c = hexToHsv(v);
    if (c.s > 0 && c.v > 0) pick.h = c.h;
    pick.s = c.s;
    pick.v = c.v;
    syncPicker();
    update();
  });
  pickerHex.addEventListener('change', function () {
    if (pick.index >= 0) pickerHex.value = state.stops[pick.index].c;
  });
  pickerHex.addEventListener('keydown', function (e) { if (e.key === 'Enter') pickerHex.blur(); });

  sv.addEventListener('keydown', function (e) {
    var step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowRight') pick.s = clamp(pick.s + step, 0, 1);
    else if (e.key === 'ArrowLeft') pick.s = clamp(pick.s - step, 0, 1);
    else if (e.key === 'ArrowUp') pick.v = clamp(pick.v + step, 0, 1);
    else if (e.key === 'ArrowDown') pick.v = clamp(pick.v - step, 0, 1);
    else return;
    e.preventDefault();
    applyPick();
  });

  document.addEventListener('pointerdown', function (e) {
    if (!picker.hidden && !picker.contains(e.target)) closePicker();
    if (!pngMenu.hidden && !pngMenu.contains(e.target) && !pngBtn.contains(e.target)) closeMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!picker.hidden) {
      var i = pick.index;
      closePicker();
      var b = blocksEl.querySelectorAll('.block')[i];
      if (b) b.focus();
    }
    if (!pngMenu.hidden) { closeMenu(); pngBtn.focus(); }
  });

  window.addEventListener('resize', closePicker);

  /* ---------- dragging helper ---------- */

  function drag(el, onMove) {
    var active = false;
    el.addEventListener('pointerdown', function (e) {
      active = true;
      el.setPointerCapture(e.pointerId);
      onMove(e, el.getBoundingClientRect());
    });
    el.addEventListener('pointermove', function (e) {
      if (active) onMove(e, el.getBoundingClientRect());
    });
    ['pointerup', 'pointercancel'].forEach(function (t) {
      el.addEventListener(t, function () { active = false; });
    });
  }

  drag(sv, function (e, r) {
    pick.s = clamp((e.clientX - r.left) / r.width, 0, 1);
    pick.v = 1 - clamp((e.clientY - r.top) / r.height, 0, 1);
    applyPick();
  });

  /* ---------- type, angle, center ---------- */

  document.querySelectorAll('[data-type]').forEach(function (b) {
    b.addEventListener('click', function () { state.type = b.dataset.type; update(); });
  });

  function setAngle(a) {
    state.angle = ((Math.round(a) % 360) + 360) % 360;
    update();
  }

  angleInput.addEventListener('input', function () {
    if (angleInput.value !== '') setAngle(Number(angleInput.value) || 0);
  });
  angleInput.addEventListener('change', function () { angleInput.value = state.angle; });

  drag(dial, function (e, r) {
    var dx = e.clientX - (r.left + r.width / 2);
    var dy = e.clientY - (r.top + r.height / 2);
    var a = Math.atan2(dx, -dy) * 180 / Math.PI;
    if (e.shiftKey) a = Math.round(a / 15) * 15;
    setAngle(a);
  });

  dial.addEventListener('keydown', function (e) {
    var step = e.shiftKey ? 15 : 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setAngle(state.angle + step);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setAngle(state.angle - step);
    else return;
    e.preventDefault();
  });

  drag(pad, function (e, r) {
    state.x = Math.round(clamp((e.clientX - r.left) / r.width, 0, 1) * 100);
    state.y = Math.round(clamp((e.clientY - r.top) / r.height, 0, 1) * 100);
    update();
  });

  pad.addEventListener('dblclick', function () { state.x = 50; state.y = 50; update(); });

  pad.addEventListener('keydown', function (e) {
    var step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowRight') state.x = clamp(state.x + step, 0, 100);
    else if (e.key === 'ArrowLeft') state.x = clamp(state.x - step, 0, 100);
    else if (e.key === 'ArrowDown') state.y = clamp(state.y + step, 0, 100);
    else if (e.key === 'ArrowUp') state.y = clamp(state.y - step, 0, 100);
    else return;
    e.preventDefault();
    update();
  });

  legacyBtn.addEventListener('click', function () {
    state.legacy = !state.legacy;
    update();
  });

  /* ---------- copy ---------- */

  function flash(label, text, original) {
    label.textContent = text;
    clearTimeout(label._t);
    label._t = setTimeout(function () { label.textContent = original; }, 1600);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    flash($('copy-label'), ok ? 'Copied' : 'Press ⌘C to copy', 'Copy CSS');
  }

  $('copy').addEventListener('click', function () {
    var text = cssText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { flash($('copy-label'), 'Copied', 'Copy CSS'); },
        function () { fallbackCopy(text); }
      );
    } else {
      fallbackCopy(text);
    }
  });

  /* ---------- PNG download ---------- */

  function closeMenu() {
    pngMenu.hidden = true;
    pngBtn.setAttribute('aria-expanded', 'false');
  }

  pngBtn.addEventListener('click', function () {
    var open = pngMenu.hidden;
    pngMenu.hidden = !open;
    pngBtn.setAttribute('aria-expanded', String(open));
  });

  // Draws the same gradient the CSS describes onto a canvas of the given size.
  function drawCanvas(W, H) {
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    var cx = W * state.x / 100, cy = H * state.y / 100, g;

    if (state.type === 'radial') {
      var r = Math.max(
        Math.hypot(cx, cy), Math.hypot(W - cx, cy),
        Math.hypot(cx, H - cy), Math.hypot(W - cx, H - cy)
      );
      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    } else if (state.type === 'conic') {
      if (!ctx.createConicGradient) return null;
      g = ctx.createConicGradient((state.angle - 90) * Math.PI / 180, cx, cy);
    } else {
      var t = state.angle * Math.PI / 180;
      var dx = Math.sin(t), dy = -Math.cos(t);
      var len = Math.abs(W * dx) + Math.abs(H * dy);
      g = ctx.createLinearGradient(
        W / 2 - dx * len / 2, H / 2 - dy * len / 2,
        W / 2 + dx * len / 2, H / 2 + dy * len / 2
      );
    }

    var p = positions();
    state.stops.forEach(function (s, i) { g.addColorStop(p[i] / 100, s.c); });
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return canvas;
  }

  pngMenu.querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () {
      var w = Number(b.dataset.w), h = Number(b.dataset.h);
      closeMenu();
      var canvas = drawCanvas(w, h);
      if (!canvas) {
        flash($('png-label'), 'Not supported in this browser', 'Download PNG');
        return;
      }
      canvas.toBlob(function (blob) {
        if (!blob) return;
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'gradient-' + w + 'x' + h + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }, 'image/png');
    });
  });

  render();
})();
