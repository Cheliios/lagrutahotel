/* =============================================================================
   botanic.js — Sección "El jardín": composición botánica vertical en grafito
   Hotel La Gruta · Arequipa

   Es la pieza editorial del sitio: una sola planta, grande, que se mira de
   frente y se dibuja mientras se recorre la sección. La geometría de las
   especies vive en botanic-lib.js; aquí solo están la COMPOSICIÓN (dónde nace
   cada rama), el RITMO (qué se dibuja en qué tramo de scroll) y la PALETA.
   ============================================================================= */
(function () {
  'use strict';

  var B = window.Botanic;
  var svg = document.getElementById('garden-svg');
  var sec = document.getElementById('garden');
  if (!B || !svg || !sec) return;

  var W = 860, H = 1520;                                   // igual al viewBox
  var MOBILE = window.matchMedia('(max-width: 760px)').matches;

  // Semilla fija: la planta es la misma en cada visita y en cada resize. Un
  // dibujo que cambia al rotar el celular se siente roto.
  var rand = B.makeRng(0x6C41757);
  function rnd(a, b) { return a + rand() * (b - a); }
  var clamp = B.clamp, E = B.EASE;

  /* ── Paleta: solo grafito ───────────────────────────────────────────────── */
  var TONE = {
    stem:   { c: '#252525', o: 0.94 },
    leaf:   { c: '#3A3A3A', o: 0.88 },
    vein:   { c: '#606060', o: 0.66 },
    flower: { c: '#252525', o: 0.88 },
    detail: { c: '#606060', o: 0.68 }
  };

  var items = [], frag = document.createDocumentFragment();

  function group(name) {
    var g = document.createElementNS(B.NS, 'g');
    g.setAttribute('data-part', name);
    frag.appendChild(g);
    return g;
  }

  var P = {
    rand: rand,
    rnd: rnd,
    detail: MOBILE ? 0.75 : 1,
    draw: function (g, d, w, tone, sch, ease) {
      if (!d) return;
      var t = TONE[tone] || TONE.leaf;
      var p = document.createElementNS(B.NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('stroke', t.c);
      p.setAttribute('stroke-width', w.toFixed(2));
      p.setAttribute('opacity', t.o.toFixed(2));
      g.appendChild(p);
      items.push({ el: p, s: sch.s, e: Math.min(1, Math.max(sch.e, sch.s + 0.012)),
                   ease: ease || E.out, k: -1, len: 0 });
    }
  };

  /* ── Ventanas de aparición por etapa (progreso de scroll 0→1) ───────────── */
  var T = {
    stem: { s: 0.00, e: 0.14 },   // 1. tallo principal
    main: { s: 0.07, e: 0.23 },   // 2. ramas principales
    sec:  { s: 0.13, e: 0.30 },   // 3. ramas secundarias
    twig: { s: 0.19, e: 0.36 },   // 3b. ramillas
    leaf: { s: 0.23, e: 0.58 },   // 4. hojas
    fern: { s: 0.30, e: 0.64 },   // 5. helechos
    bud:  { s: 0.42, e: 0.73 },   // 6. capullos
    hyd:  { s: 0.48, e: 0.87 },   // 7. hortensias
    rose: { s: 0.58, e: 0.95 },   // 8. rosas
    ten:  { s: 0.64, e: 1.00 }    // 9. zarcillos y detalles
  };

  // Reparte el inicio dentro de la etapa según la altura (abajo primero) y
  // nunca antes de que el padre haya llegado a ese punto.
  function slot(tier, y, dur, after) {
    var t = T[tier];
    var span = Math.max(0.005, (t.e - t.s) - dur);
    var h = clamp(1 - (y / H), 0, 1);
    var st = t.s + span * clamp(h * 0.55 + rnd(0.00, 0.48), 0, 1);
    if (after != null && st < after + 0.008) st = after + 0.008;
    return { s: Math.min(st, 0.97), e: Math.min(1, st + dur) };
  }

  // Momento en que un trazo padre "pasa" por su parámetro t.
  function reach(sch, t) { return sch.s + (sch.e - sch.s) * clamp(t, 0, 1); }

  /* =========================================================================
     Composición: tallo → ramas → ramillas → follaje → flores → detalles
     ========================================================================= */

  var gStem = group('tallo'),          gMain = group('ramas-principales'),
      gSec  = group('ramas-secundarias'), gTwig = group('ramillas'),
      gLeaf = group('hojas'),          gFern = group('helechos'),
      gBud  = group('capullos'),       gHyd  = group('hortensias'),
      gRose = group('rosas'),          gTen  = group('zarcillos');

  // 1. TALLO PRINCIPAL — sube de abajo hacia arriba derivando de lado a lado.
  var stemPts = [];
  (function () {
    var N = 24;
    for (var i = 0; i <= N; i++) {
      var t = i / N;
      stemPts.push([
        446 + Math.sin(t * Math.PI * 1.55 + 0.30) * (76 + t * 72) - t * t * 46 + rnd(-4, 4),
        1535 - t * 1385
      ]);
    }
  })();
  var stemSch = { s: T.stem.s, e: T.stem.e };
  P.draw(gStem, B.catmull(stemPts), 1.45, 'stem', stemSch, E.inout);

  var branches = [];

  // 2. DOS RAMAS PRINCIPALES
  [[0.16, -1], [0.40, 1]].forEach(function (cfg) {
    var ti = cfg[0] + rnd(-0.02, 0.02), side = cfg[1];
    var pt = B.along(stemPts, ti);
    var pts = B.grow(P, pt.x, pt.y, pt.a + side * rnd(0.85, 1.15), rnd(330, 420),
                     -side * rnd(0.30, 0.60), 0.05, 13);
    var sch = slot('main', pt.y, 0.11, reach(stemSch, ti));
    P.draw(gMain, B.catmull(pts), 1.20, 'stem', sch, E.out);
    branches.push({ pts: pts, sch: sch, lvl: 1 });
  });

  // 3. CUATRO RAMAS SECUNDARIAS
  [[0.06, 1], [0.58, -1], [0.74, 1], [0.88, -1]].forEach(function (cfg) {
    var ti = cfg[0] + rnd(-0.02, 0.02), side = cfg[1];
    var pt = B.along(stemPts, ti);
    var pts = B.grow(P, pt.x, pt.y, pt.a + side * rnd(0.75, 1.05), rnd(235, 310),
                     -side * rnd(0.25, 0.55), 0.05, 12);
    var sch = slot('sec', pt.y, 0.10, reach(stemSch, ti));
    P.draw(gSec, B.catmull(pts), 0.98, 'leaf', sch, E.out);
    branches.push({ pts: pts, sch: sch, lvl: 2 });
  });

  // 3b. RAMILLAS — cada rama emite 2-3; son las que llevan las flores.
  var twigs = [];
  branches.slice().forEach(function (b) {
    var nT = MOBILE ? 2 : (b.lvl === 1 ? 3 : 2);
    for (var i = 0; i < nT; i++) {
      var ti = 0.34 + (0.52 / nT) * i + rnd(-0.05, 0.05);
      var pt = B.along(b.pts, ti);
      var side = (i % 2) ? 1 : -1;
      var pts = B.grow(P, pt.x, pt.y, pt.a + side * rnd(0.45, 0.80), rnd(110, 185),
                       -side * rnd(0.30, 0.70), 0.04, 8);
      var sch = slot('twig', pt.y, 0.08, reach(b.sch, ti));
      P.draw(gTwig, B.catmull(pts), 0.72, 'leaf', sch, E.out);
      twigs.push({ pts: pts, sch: sch });
    }
  });
  var all = branches.concat(twigs);

  // 4. HOJAS — repartidas por todas las ramas, alternando lados, nunca iguales.
  all.forEach(function (b, bi) {
    var n = b.lvl ? (MOBILE ? 3 : 4) : 2;
    for (var i = 0; i < n; i++) {
      var ti = 0.14 + (0.78 / n) * i + rnd(-0.05, 0.05);
      var pt = B.along(b.pts, ti);
      var side = ((i + bi) % 2) ? 1 : -1;
      var len = rnd(46, 92) * (b.lvl === 1 ? 1.15 : 1);
      B.leaf(P, gLeaf, pt.x, pt.y, pt.a + side * rnd(0.60, 1.15), len, len * rnd(0.21, 0.30),
             slot('leaf', pt.y, 0.085, reach(b.sch, ti)));
    }
  });

  // 5. HELECHOS — pocos, grandes: dan densidad sin ruido.
  (function () {
    var hosts = branches.concat(twigs.slice(0, 4));
    for (var i = 0, n = MOBILE ? 3 : 5; i < n; i++) {
      var b = hosts[(i * 2 + 1) % hosts.length];
      var ti = 0.30 + rnd(0, 0.45);
      var pt = B.along(b.pts, ti);
      B.fern(P, gFern, pt.x, pt.y, pt.a + ((i % 2) ? 1 : -1) * rnd(0.35, 0.85), rnd(105, 165),
             slot('fern', pt.y, 0.125, reach(b.sch, ti)));
    }
  })();

  // Reparto de focos: barajado determinista para que ninguna ramilla cargue dos
  // flores encima. Es lo que evita los amontonamientos.
  var pool = twigs.slice();
  for (var q = pool.length - 1; q > 0; q--) {
    var w2 = Math.floor(rand() * (q + 1)), tmp = pool[q];
    pool[q] = pool[w2]; pool[w2] = tmp;
  }
  var hydSpots  = pool.splice(0, MOBILE ? 3 : 4);
  var roseSpots = pool.splice(0, MOBILE ? 2 : 3);
  var budSpots  = pool.slice(0, MOBILE ? 4 : 6);

  // 6. CAPULLOS
  budSpots.forEach(function (b) {
    var ti = 0.62 + rnd(0, 0.34), pt = B.along(b.pts, ti);
    B.bud(P, gBud, pt.x, pt.y, pt.a + rnd(-0.45, 0.45), rnd(24, 36),
          slot('bud', pt.y, 0.075, reach(b.sch, ti)));
  });

  // 7. HORTENSIAS
  hydSpots.forEach(function (b) {
    var pt = B.along(b.pts, 0.97);
    B.hydrangea(P, gHyd, pt.x + rnd(-6, 6), pt.y - rnd(12, 26), rnd(44, 58),
                slot('hyd', pt.y, 0.145, reach(b.sch, 1)));
  });

  // 8. ROSAS — los puntos de mayor peso visual.
  roseSpots.forEach(function (b) {
    var pt = B.along(b.pts, 0.95);
    B.rose(P, gRose, pt.x + rnd(-8, 8), pt.y - rnd(10, 24), rnd(46, 60),
           slot('rose', pt.y, 0.155, reach(b.sch, 1)));
  });

  // 9. ZARCILLOS — el último tramo del scroll; rematan la composición.
  for (var z = 0, nz = MOBILE ? 7 : 12; z < nz; z++) {
    var bz = all[(z * 5 + 2) % all.length];
    var tz = 0.60 + rnd(0, 0.38), pz = B.along(bz.pts, tz);
    B.tendril(P, gTen, pz.x, pz.y, pz.a + rnd(-1.1, 1.1), rnd(12, 22),
              slot('ten', pz.y, 0.09, reach(bz.sch, tz)));
  }

  svg.appendChild(frag);
  B.measure(items);

  /* ── Motor de scroll ────────────────────────────────────────────────────── */

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    B.render(items, 1, false);
    return;
  }

  var target = 0, shown = 0, running = false, visible = false;

  function progress() {
    var r = sec.getBoundingClientRect();
    var span = r.height - window.innerHeight;
    if (span <= 0) return r.top <= 0 ? 1 : 0;
    return clamp(-r.top / span, 0, 1);
  }

  function frame() {
    shown += (target - shown) * 0.18;                     // suavizado del scrub
    if (Math.abs(target - shown) < 0.0005) shown = target;
    B.render(items, shown, false);
    if (visible && shown !== target) requestAnimationFrame(frame);
    else running = false;
  }

  function kick() {
    target = progress();
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible) kick();
    }, { rootMargin: '120px 0px' }).observe(sec);
  } else {
    visible = true;
  }

  window.addEventListener('scroll', function () { if (visible) kick(); }, { passive: true });
  window.addEventListener('resize', function () { shown = target = progress(); B.render(items, shown, false); }, { passive: true });

  // La navegación del sitio es una SPA falsa: al cambiar de página el tramo
  // cambia de sitio (o desaparece), así que hay que recalcular el progreso.
  window.gardenRefresh = function () { shown = target = progress(); B.render(items, shown, false); };

  kick();
  B.render(items, 0, false);
})();
