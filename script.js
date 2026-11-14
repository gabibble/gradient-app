(function () {
  'use strict';

  var STORE = 'gradient-generator:v1';
  var MAX_STOPS = 8;
  var MIN_STOPS = 2;

  var defaults = {
    type: 'linear',
    angle: 160,
    shape: 'circle',
    x: 50,
    y: 50,
    auto: true,
    stops: [
      { c: '#FF3D77', p: 0 },
      { c: '#FF9A3D', p: 50 },
      { c: '#FFE66D', p: 100 }
    ]
  };

  var state = load() || JSON.parse(JSON.stringify(defaults));

  var $ = function (id) { return document.getElementById(id); };
  var preview = $('preview');
  var cssOut = $('css');
  var stripesEl = $('stripes');
  var copyBtn = $('copy');
  var copyLabel = $('copy-label');
  var angleInput = $('angle');
  var dial = $('dial');
  var hand = $('hand');
  var pad = $('pad');
  var dot = $('dot');
  var centerOut = $('center-out');

  /* ---------- persistence ---------- */

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE));
      if (!s || !Array.isArray(s.stops) || s.stops.length < MIN_STOPS) return null;
      var ok = s.stops.every(function (st) {
        return /^#[0-9A-F]{6}$/i.test(st.c) && typeof st.p === 'number';
      });
      if (!ok || ['linear', 'radial', 'conic'].indexOf(s.type) < 0) return null;
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

  function isLight(hex) { return luminance(hex) > 0.55; }

  function rotateHue(hex, deg) {
    var c = rgb(hex).map(function (v) { return v / 255; });
    var max = Math.max.apply(null, c), min = Math.min.apply(null, c);
    var l = (max + min) / 2, d = max - min, h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === c[0]) h = ((c[1] - c[2]) / d) % 6;
      else if (max === c[1]) h = (c[2] - c[0]) / d + 2;
      else h = (c[0] - c[1]) / d + 4;
      h *= 60;
    } else {
      s = 0.7; l = clamp(l, 0.35, 0.65);
    }
    h = (h + deg + 360) % 360;
    var k = function (n) { return (n + h / 30) % 12; };
    var a = s * Math.min(l, 1 - l);
    var f = function (n) {
      var v = l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
      return ('0' + Math.round(v * 255).toString(16)).slice(-2);
    };
    return ('#' + f(0) + f(8) + f(4)).toUpperCase();
  }

  /* ---------- gradient ---------- */

  function evenPos(i, n) { return Math.round((i / (n - 1)) * 100); }

  function spreadEvenly() {
    var n = state.stops.length;
    state.stops.forEach(function (s, i) { s.p = evenPos(i, n); });
  }

  function gradient() {
    var n = state.stops.length;
    var even = state.stops.every(function (s, i) { return s.p === evenPos(i, n); });
    var list = state.stops.map(function (s) {
      return even ? s.c : s.c + ' ' + s.p + '%';
    }).join(', ');
    var centered = state.x === 50 && state.y === 50;
    var at = centered ? '' : 'at ' + state.x + '% ' + state.y + '%';

    if (state.type === 'radial') {
      var head = [state.shape === 'circle' || at ? state.shape : '', at].join(' ').trim();
      return 'radial-gradient(' + (head ? head + ', ' : '') + list + ')';
    }
    if (state.type === 'conic') {
      return 'conic-gradient(' + ['from ' + state.angle + 'deg', at].join(' ').trim() + ', ' + list + ')';
    }
    return 'linear-gradient(' + state.angle + 'deg, ' + list + ')';
  }

  /* ---------- rendering ---------- */

  function render() {
    stripesEl.textContent = '';
    var n = state.stops.length;

    state.stops.forEach(function (stop, i) {
      var el = document.createElement('div');
      el.className = 'stripe';
      el.innerHTML =
        '<input type="color" aria-label="Pick color ' + (i + 1) + '">' +
        (n > MIN_STOPS ? '<button type="button" class="rm" aria-label="Remove color ' + (i + 1) + '">×</button>' : '') +
        '<div class="meta">' +
          '<input class="hex" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Hex code for color ' + (i + 1) + '">' +
          '<label class="pos"><input type="number" min="0" max="100" step="1" aria-label="Position of color ' + (i + 1) + ' in percent"><span>%</span></label>' +
        '</div>';

      var picker = el.querySelector('input[type="color"]');
      var hex = el.querySelector('.hex');
      var pos = el.querySelector('.pos input');
      var rm = el.querySelector('.rm');

      picker.addEventListener('input', function () {
        stop.c = picker.value.toUpperCase();
        update();
      });

      hex.addEventListener('change', function () {
        var v = parseHex(hex.value);
        if (v) stop.c = v;
        hex.value = stop.c;
        update();
      });
      hex.addEventListener('keydown', function (e) { if (e.key === 'Enter') hex.blur(); });

      pos.addEventListener('input', function () {
        if (pos.value === '') return;
        var lo = i > 0 ? state.stops[i - 1].p : 0;
        var hi = i < state.stops.length - 1 ? state.stops[i + 1].p : 100;
        stop.p = clamp(Math.round(Number(pos.value)) || 0, lo, hi);
        state.auto = false;
        update();
      });
      pos.addEventListener('change', function () { pos.value = stop.p; });

      if (rm) rm.addEventListener('click', function () {
        state.stops.splice(i, 1);
        if (state.auto) spreadEvenly();
        render();
      });

      stripesEl.appendChild(el);
    });

    if (n < MAX_STOPS) {
      var add = document.createElement('button');
      add.type = 'button';
      add.className = 'add';
      add.setAttribute('aria-label', 'Add color');
      add.textContent = '+';
      add.addEventListener('click', addStop);
      stripesEl.appendChild(add);
    }

    update();
  }

  function addStop() {
    var stops = state.stops;
    var last = stops[stops.length - 1];
    if (!state.auto && last.p === 100) {
      last.p = Math.round((stops[stops.length - 2].p + 100) / 2);
    }
    stops.push({ c: rotateHue(last.c, 40), p: 100 });
    if (state.auto) spreadEvenly();
    render();
  }

  function update() {
    var g = gradient();
    preview.style.background = g;
    cssOut.textContent = 'background: ' + g + ';';

    var avg = state.stops.reduce(function (t, s) { return t + luminance(s.c); }, 0) / state.stops.length;
    preview.classList.toggle('on-light', avg > 0.55);

    var els = stripesEl.querySelectorAll('.stripe');
    state.stops.forEach(function (s, i) {
      var el = els[i];
      if (!el) return;
      el.style.background = s.c;
      el.classList.toggle('on-light', isLight(s.c));
      var picker = el.querySelector('input[type="color"]');
      var hex = el.querySelector('.hex');
      var pos = el.querySelector('.pos input');
      if (picker.value.toUpperCase() !== s.c) picker.value = s.c;
      if (document.activeElement !== hex) hex.value = s.c;
      if (document.activeElement !== pos) pos.value = s.p;
      pos.style.width = Math.max(1, pos.value.length) + 'ch';
    });

    document.querySelectorAll('[data-type]').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.type === state.type));
    });
    document.querySelectorAll('[data-shape]').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.shape === state.shape));
    });

    $('opt-angle').hidden = state.type === 'radial';
    $('opt-center').hidden = state.type === 'linear';
    $('opt-shape').hidden = state.type !== 'radial';

    hand.style.transform = 'rotate(' + state.angle + 'deg)';
    dial.setAttribute('aria-valuenow', state.angle);
    if (document.activeElement !== angleInput) angleInput.value = state.angle;

    dot.style.left = state.x + '%';
    dot.style.top = state.y + '%';
    centerOut.textContent = state.x + '% ' + state.y + '%';

    save();
  }

  /* ---------- controls ---------- */

  document.querySelectorAll('[data-type]').forEach(function (b) {
    b.addEventListener('click', function () { state.type = b.dataset.type; update(); });
  });

  document.querySelectorAll('[data-shape]').forEach(function (b) {
    b.addEventListener('click', function () { state.shape = b.dataset.shape; update(); });
  });

  function setAngle(a) {
    state.angle = ((Math.round(a) % 360) + 360) % 360;
    update();
  }

  angleInput.addEventListener('input', function () {
    if (angleInput.value !== '') setAngle(Number(angleInput.value) || 0);
  });
  angleInput.addEventListener('change', function () { angleInput.value = state.angle; });

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

  /* ---------- copy ---------- */

  var copyTimer;

  function copied(ok) {
    copyLabel.textContent = ok ? 'Copied' : 'Press ⌘C to copy';
    clearTimeout(copyTimer);
    copyTimer = setTimeout(function () { copyLabel.textContent = 'Copy CSS'; }, 1600);
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
    copied(ok);
  }

  copyBtn.addEventListener('click', function () {
    var text = cssOut.textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { copied(true); }, function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  });

  render();
})();
