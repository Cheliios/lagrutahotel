/* =============================================================================
   botanic.js — Ilustración botánica vectorial dibujada por scroll
   Hotel La Gruta · Arequipa

   Qué hace
   --------
   Genera por código (no es un SVG exportado) una composición botánica vertical
   en línea fina monocroma, y la "dibuja" a medida que el usuario baja: cada
   trazo tiene su propia ventana de scroll, de modo que la planta crece desde el
   tallo hasta las flores en un orden orgánico.

   Decisiones técnicas
   -------------------
   1. Sin dependencias. Es SVG + requestAnimationFrame. Se eliminó GSAP:
      la técnica real (stroke-dasharray / stroke-dashoffset) no la necesita, y
      cargarlo con `defer` ya nos costó un bug de carrera en producción.
   2. RNG con semilla fija: la planta es la misma en cada visita y en cada
      resize. Un dibujo que cambia al rotar el celular se siente roto.
   3. getTotalLength() se mide UNA sola vez, al construir. Durante el scroll
      solo se escribe strokeDashoffset, y únicamente en los paths que cambiaron.
   4. Todo vive en el sistema de coordenadas del viewBox: el responsive lo
      resuelve el propio SVG, no JavaScript.
   ============================================================================= */
(function () {
  'use strict';

  var NS   = 'http://www.w3.org/2000/svg';
  var svg  = document.getElementById('garden-svg');
  var sec  = document.getElementById('garden');
  if (!svg || !sec) return;

  var W = 860, H = 1520;                                   // igual al viewBox
  var MOBILE = window.matchMedia('(max-width: 760px)').matches;

  /* ── RNG determinista (LCG) ─────────────────────────────────────────────── */
  function makeRng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  var rand = makeRng(0x6C41757);
  function rnd(a, b) { return a + rand() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function nn(v) { return Math.round(v * 10) / 10; }

  /* ── Easings ────────────────────────────────────────────────────────────── */
  var E = {
    out:   function (t) { return 1 - Math.pow(1 - t, 3); },
    soft:  function (t) { return 1 - Math.pow(1 - t, 2); },
    inout: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  };

  /* ── Paleta: solo grafito ───────────────────────────────────────────────── */
  var INK = '#252525', MID = '#3A3A3A', SOFT = '#606060';

  /* ── Geometría ──────────────────────────────────────────────────────────── */

  // Catmull-Rom → cúbicas. Convierte una polilínea en una curva orgánica.
  function catmull(pts) {
    if (pts.length < 2) return '';
    var d = 'M' + nn(pts[0][0]) + ',' + nn(pts[0][1]);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || pts[i + 1];
      d += 'C' + nn(p1[0] + (p2[0] - p0[0]) / 6) + ',' + nn(p1[1] + (p2[1] - p0[1]) / 6) +
           ' '  + nn(p2[0] - (p3[0] - p1[0]) / 6) + ',' + nn(p2[1] - (p3[1] - p1[1]) / 6) +
           ' '  + nn(p2[0]) + ',' + nn(p2[1]);
    }
    return d;
  }

  // Crecimiento: ángulo 0 = hacia arriba. `curve` es la curvatura total
  // acumulada a lo largo del tramo; `wob` el temblor por segmento.
  function grow(x, y, ang, len, curve, wob, segs) {
    var pts = [[x, y]], a = ang, step = len / segs;
    for (var i = 1; i <= segs; i++) {
      a += curve / segs + rnd(-wob, wob);
      x += Math.sin(a) * step;
      y -= Math.cos(a) * step;
      pts.push([x, y]);
    }
    return pts;
  }

  // Punto + tangente a lo largo de una polilínea (parametrizado por longitud).
  function along(pts, t) {
    var segs = [], total = 0, i, dx, dy, L;
    for (i = 0; i < pts.length - 1; i++) {
      dx = pts[i + 1][0] - pts[i][0]; dy = pts[i + 1][1] - pts[i][1];
      L = Math.sqrt(dx * dx + dy * dy); segs.push(L); total += L;
    }
    var target = total * clamp(t, 0, 1), acc = 0;
    for (i = 0; i < segs.length; i++) {
      if (acc + segs[i] >= target || i === segs.length - 1) {
        var u = segs[i] ? (target - acc) / segs[i] : 0;
        var p = pts[i], q = pts[i + 1];
        return {
          x: p[0] + (q[0] - p[0]) * u,
          y: p[1] + (q[1] - p[1]) * u,
          a: Math.atan2(q[0] - p[0], -(q[1] - p[1]))
        };
      }
      acc += segs[i];
    }
    return { x: pts[0][0], y: pts[0][1], a: 0 };
  }

  /* ── Registro de trazos animables ───────────────────────────────────────── */
  var items = [];
  var frag  = document.createDocumentFragment();

  function group(name) {
    var g = document.createElementNS(NS, 'g');
    g.setAttribute('data-part', name);
    frag.appendChild(g);
    return g;
  }

  function stroke(g, d, w, color, op, s, e, ease) {
    if (!d) return null;
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('stroke', color);
    p.setAttribute('stroke-width', w.toFixed(2));
    p.setAttribute('opacity', op.toFixed(2));
    g.appendChild(p);
    items.push({ el: p, s: s, e: Math.min(1, Math.max(e, s + 0.012)), ease: ease || E.out, k: -1, len: 0 });
    return p;
  }

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
     Biblioteca de especies
     ========================================================================= */

  // Perfil de ancho de una hoja: 0 en la base, máximo antes del medio, 0 en punta.
  function widthAt(t, w) { return Math.sin(Math.pow(t, 0.70) * Math.PI) * w; }

  // Contorno de una lámina (hoja / folíolo) como UN solo trazo continuo:
  // sube por un borde, dobla en la punta y baja por el otro.
  function bladeD(mid, w, wob) {
    var L = [], R = [], i, t, p, q, o, tx, ty, m, nx, ny, wp;
    for (i = 0; i < mid.length; i++) {
      t = i / (mid.length - 1);
      wp = widthAt(t, w) * (1 + rnd(-wob, wob));
      p = mid[i]; q = mid[Math.min(i + 1, mid.length - 1)]; o = mid[Math.max(i - 1, 0)];
      tx = q[0] - o[0]; ty = q[1] - o[1]; m = Math.sqrt(tx * tx + ty * ty) || 1;
      nx = -ty / m; ny = tx / m;
      L.push([p[0] + nx * wp, p[1] + ny * wp]);
      R.push([p[0] - nx * wp, p[1] - ny * wp]);
    }
    R.reverse();
    return catmull(L) + catmull(R).replace('M', 'L');
  }

  // 4. HOJA — contorno + nervio central + nervaduras laterales.
  function leaf(g, x, y, ang, len, wid, sch) {
    var mid = grow(x, y, ang, len, rnd(-0.55, 0.55), 0.035, 10);
    var d = sch.e - sch.s;
    stroke(g, bladeD(mid, wid, 0.07), 0.85, MID, 0.88, sch.s, sch.s + d * 0.62, E.out);
    stroke(g, catmull(mid), 0.62, MID, 0.72, sch.s + d * 0.22, sch.s + d * 0.80, E.soft);
    var nv = MOBILE ? 3 : 4;
    for (var v = 0; v < nv; v++) {
      var t = 0.22 + (0.62 / nv) * v + rnd(-0.03, 0.03);
      var pt = along(mid, t);
      var side = (v % 2) ? 1 : -1;
      var reachW = widthAt(t, wid) * 0.80;
      var vp = grow(pt.x, pt.y, pt.a + side * (Math.PI / 2) - side * 0.60, reachW, side * 0.40, 0.01, 4);
      stroke(g, catmull(vp), 0.45, SOFT, 0.62,
             sch.s + d * (0.45 + v * 0.08), sch.s + d * (0.78 + v * 0.06), E.soft);
    }
  }

  // 5. HELECHO — raquis ligero con muchos folíolos ligeramente irregulares.
  function fern(g, x, y, ang, len, sch) {
    var rachis = grow(x, y, ang, len, rnd(-0.70, 0.70), 0.02, 14);
    var d = sch.e - sch.s;
    stroke(g, catmull(rachis), 0.75, MID, 0.85, sch.s, sch.s + d * 0.42, E.out);
    var pairs = MOBILE ? 8 : 11;
    for (var i = 0; i < pairs; i++) {
      var t = 0.07 + (i / (pairs - 1)) * 0.90;
      var pt = along(rachis, t);
      var sc = Math.sin(Math.pow(t, 0.55) * Math.PI * 0.95);
      var ll = len * 0.215 * sc * rnd(0.82, 1.14);
      if (ll < 3) continue;
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        var a = pt.a + s2 * (Math.PI / 2) - s2 * (0.62 + t * 0.30);
        var lf = grow(pt.x, pt.y, a, ll, s2 * rnd(0.25, 0.55), 0.02, 6);
        var st = sch.s + d * (0.30 + 0.62 * t) + rnd(0, d * 0.05);
        stroke(g, bladeD(lf, ll * 0.26, 0.10), 0.55, MID, 0.80, st, st + d * 0.22, E.soft);
      }
    }
  }

  // 7. HORTENSIA — racimo compacto de florecillas de 4-5 pétalos.
  function floretD(cx, cy, r, np, rot) {
    var d = '', step = (Math.PI * 2) / np, i;
    var inner = r * 0.20;
    for (i = 0; i < np; i++) {
      var a1 = rot + i * step, a2 = a1 + step, am = a1 + step / 2;
      var p1 = [cx + Math.cos(a1) * inner, cy + Math.sin(a1) * inner];
      var p2 = [cx + Math.cos(a2) * inner, cy + Math.sin(a2) * inner];
      var rr = r * rnd(0.88, 1.06);
      var tip = [cx + Math.cos(am) * rr, cy + Math.sin(am) * rr];
      var q1 = [cx + Math.cos(a1 + step * 0.16) * rr * 0.90, cy + Math.sin(a1 + step * 0.16) * rr * 0.90];
      var q2 = [cx + Math.cos(a2 - step * 0.16) * rr * 0.90, cy + Math.sin(a2 - step * 0.16) * rr * 0.90];
      if (i === 0) d += 'M' + nn(p1[0]) + ',' + nn(p1[1]);
      d += 'Q' + nn(q1[0]) + ',' + nn(q1[1]) + ' ' + nn(tip[0]) + ',' + nn(tip[1]) +
           'Q' + nn(q2[0]) + ',' + nn(q2[1]) + ' ' + nn(p2[0]) + ',' + nn(p2[1]);
    }
    return d;
  }

  function hydrangea(g, x, y, r, sch) {
    var nF = MOBILE ? 11 : 17;
    var GA = Math.PI * (3 - Math.sqrt(5));            // ángulo áureo: relleno natural
    var d = sch.e - sch.s, rot0 = rnd(0, 6.28);
    for (var i = 0; i < nF; i++) {
      var rr = r * Math.sqrt((i + 0.55) / nF);
      var th = i * GA + rot0;
      var cx = x + Math.cos(th) * rr * rnd(0.86, 1.14);
      var cy = y + Math.sin(th) * rr * rnd(0.86, 1.14) * 0.88;
      var fr = r * rnd(0.19, 0.27);
      var st = sch.s + d * (0.05 + 0.70 * (i / nF)) + rnd(0, d * 0.06);
      stroke(g, floretD(cx, cy, fr, rand() < 0.45 ? 4 : 5, rnd(0, 6.28)),
             0.65, i < nF * 0.4 ? INK : MID, 0.86, st, st + d * 0.20, E.soft);
      if (i % 2 === 0) {
        stroke(g, floretD(cx, cy, fr * 0.26, 3, rnd(0, 6.28)),
               0.45, SOFT, 0.70, st + d * 0.10, st + d * 0.24, E.soft);
      }
    }
  }

  // 8. ROSA — corazón enrollado + anillos de pétalos en ARCO ABIERTO.
  // Clave del dibujo: el pétalo NO vuelve al centro por los dos extremos (eso
  // cerraba el trazo en círculo y se veía como un ovillo de aros). Es un arco
  // casi concéntrico, con las puntas apenas recogidas: una "C". Anillos de C
  // anidadas y rotadas al azar = rosa de línea.
  function petalD(cx, cy, rad, a, span, squash, tuck) {
    var pts = [], i, u, th, rr;
    for (i = 0; i <= 11; i++) {
      u = i / 11;
      th = a + (u - 0.5) * 2 * span;
      rr = rad * (1 - tuck * Math.pow(Math.abs(u - 0.5) * 2, 1.9));
      pts.push([cx + Math.cos(th) * rr, cy + Math.sin(th) * rr * squash]);
    }
    return catmull(pts);
  }

  function rose(g, x, y, r, sch) {
    var squash = rnd(0.86, 1.0);
    //           radio    nº   semiapertura  recogido de puntas
    var rings = MOBILE
      ? [[0.20, 3, 1.50, 0.26], [0.42, 4, 1.32, 0.24], [0.66, 5, 1.18, 0.22], [0.92, 6, 1.00, 0.14]]
      : [[0.16, 3, 1.52, 0.28], [0.30, 4, 1.38, 0.26], [0.46, 5, 1.26, 0.24],
         [0.64, 5, 1.16, 0.21], [0.84, 6, 1.04, 0.16], [1.00, 6, 0.92, 0.08]];
    var d = sch.e - sch.s, done = 0, tot = 0, i, k;
    for (i = 0; i < rings.length; i++) tot += rings[i][1];

    // corazón: espiral corta y apretada
    var sp = [], turns = rnd(1.4, 1.8);
    for (i = 0; i <= 16; i++) {
      var t = i / 16, th = t * turns * Math.PI * 2, rr = r * 0.11 * t + r * 0.02;
      sp.push([x + Math.cos(th) * rr, y + Math.sin(th) * rr * squash]);
    }
    stroke(g, catmull(sp), 0.62, INK, 0.90, sch.s, sch.s + d * 0.18, E.soft);

    // Cada anillo se descentra un poco: el solape asimétrico es lo que hace
    // que la flor parezca dibujada a mano y no generada.
    var dA = rnd(0, 6.28);
    for (i = 0; i < rings.length; i++) {
      var rad = rings[i][0], np = rings[i][1], sw = rings[i][2], tuck = rings[i][3];
      var off = rnd(0, 6.28);
      var ox = Math.cos(dA) * r * 0.04 * i, oy = Math.sin(dA) * r * 0.04 * i;
      for (k = 0; k < np; k++) {
        var ang = off + k * (Math.PI * 2 / np) + rnd(-0.14, 0.14);
        var st = sch.s + d * (0.10 + 0.74 * (done / tot)) + rnd(0, d * 0.03);
        stroke(g, petalD(x + ox, y + oy, r * rad * rnd(0.93, 1.07), ang,
                         sw * 0.5 * rnd(0.88, 1.12), squash, tuck),
               0.82 - i * 0.04, i < 2 ? INK : MID, 0.88, st, st + d * 0.16, E.soft);
        done++;
      }
    }
    // sépalos que asoman por detrás
    for (i = 0; i < 3; i++) {
      var sa = rnd(0, 6.28);
      var spts = grow(x + Math.cos(sa) * r * 0.95, y + Math.sin(sa) * r * 0.95 * squash,
                      sa + Math.PI / 2, r * 0.40, rnd(-0.6, 0.6), 0.02, 5);
      stroke(g, catmull(spts), 0.50, SOFT, 0.65, sch.s + d * 0.80, sch.s + d * 0.98, E.soft);
    }
  }

  // 6. CAPULLO — lámina cerrada + dos sépalos.
  function bud(g, x, y, ang, size, sch) {
    var mid = grow(x, y, ang, size, rnd(-0.25, 0.25), 0.01, 7);
    var d = sch.e - sch.s;
    stroke(g, bladeD(mid, size * 0.30, 0.05), 0.72, INK, 0.88, sch.s, sch.s + d * 0.55, E.out);
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      var sp2 = grow(x, y, ang + s2 * 0.55, size * 0.52, -s2 * 0.55, 0.01, 5);
      stroke(g, catmull(sp2), 0.52, SOFT, 0.72, sch.s + d * 0.45, sch.s + d * 0.90, E.soft);
    }
  }

  // 9. ZARCILLO — pequeño rizo que enrolla hacia adentro. Da la sensación de vida.
  function tendril(g, x, y, ang, size, sch) {
    var dir = rand() < 0.5 ? 1 : -1, pts = [], i;
    var cx = x - Math.cos(ang) * size, cy = y - Math.sin(ang) * size;
    var turns = rnd(1.5, 2.3);
    for (i = 0; i <= 30; i++) {
      var t = i / 30;
      var rr = size * (1 - t * 0.86);
      var th = ang + dir * t * turns * Math.PI * 2;
      pts.push([cx + Math.cos(th) * rr, cy + Math.sin(th) * rr]);
    }
    stroke(g, catmull(pts), 0.50, SOFT, 0.70, sch.s, sch.e, E.soft);
  }

  /* =========================================================================
     Composición: tallo → ramas → ramillas → follaje → flores → detalles
     ========================================================================= */

  var gStem = group('tallo'),   gMain = group('ramas-principales'),
      gSec  = group('ramas-secundarias'), gTwig = group('ramillas'),
      gLeaf = group('hojas'),   gFern = group('helechos'),
      gBud  = group('capullos'), gHyd  = group('hortensias'),
      gRose = group('rosas'),   gTen  = group('zarcillos');

  // 1. TALLO PRINCIPAL — sube de abajo hacia arriba derivando de lado a lado.
  var stemPts = [];
  (function () {
    var N = 24;
    for (var i = 0; i <= N; i++) {
      var t = i / N;
      var y = 1535 - t * 1385;
      var x = 446 + Math.sin(t * Math.PI * 1.55 + 0.30) * (76 + t * 72) - t * t * 46 + rnd(-4, 4);
      stemPts.push([x, y]);
    }
  })();
  var stemSch = { s: T.stem.s, e: T.stem.e };
  stroke(gStem, catmull(stemPts), 1.45, INK, 0.94, stemSch.s, stemSch.e, E.inout);

  var branches = [];   // ramas capaces de sostener follaje

  // 2. DOS RAMAS PRINCIPALES
  [[0.16, -1], [0.40, 1]].forEach(function (cfg) {
    var ti = cfg[0] + rnd(-0.02, 0.02), side = cfg[1];
    var pt = along(stemPts, ti);
    var len = rnd(330, 420);
    var pts = grow(pt.x, pt.y, pt.a + side * rnd(0.85, 1.15), len, -side * rnd(0.30, 0.60), 0.05, 13);
    var sch = slot('main', pt.y, 0.11, reach(stemSch, ti));
    stroke(gMain, catmull(pts), 1.20, INK, 0.92, sch.s, sch.e, E.out);
    branches.push({ pts: pts, sch: sch, lvl: 1 });
  });

  // 3. TRES RAMAS SECUNDARIAS
  [[0.06, 1], [0.58, -1], [0.74, 1], [0.88, -1]].forEach(function (cfg) {
    var ti = cfg[0] + rnd(-0.02, 0.02), side = cfg[1];
    var pt = along(stemPts, ti);
    var len = rnd(235, 310);
    var pts = grow(pt.x, pt.y, pt.a + side * rnd(0.75, 1.05), len, -side * rnd(0.25, 0.55), 0.05, 12);
    var sch = slot('sec', pt.y, 0.10, reach(stemSch, ti));
    stroke(gSec, catmull(pts), 0.98, MID, 0.90, sch.s, sch.e, E.out);
    branches.push({ pts: pts, sch: sch, lvl: 2 });
  });

  // 3b. RAMILLAS — cada rama emite 2-3; son las que llevan las flores.
  var twigs = [];
  branches.slice().forEach(function (b) {
    var nT = MOBILE ? 2 : (b.lvl === 1 ? 3 : 2);
    for (var i = 0; i < nT; i++) {
      var ti = 0.34 + (0.52 / nT) * i + rnd(-0.05, 0.05);
      var pt = along(b.pts, ti);
      var side = (i % 2) ? 1 : -1;
      var len = rnd(110, 185);
      var pts = grow(pt.x, pt.y, pt.a + side * rnd(0.45, 0.80), len, -side * rnd(0.30, 0.70), 0.04, 8);
      var sch = slot('twig', pt.y, 0.08, reach(b.sch, ti));
      stroke(gTwig, catmull(pts), 0.72, MID, 0.86, sch.s, sch.e, E.out);
      twigs.push({ pts: pts, sch: sch });
    }
  });
  var all = branches.concat(twigs);

  // 4. HOJAS — repartidas por todas las ramas, alternando lados, nunca iguales.
  (function () {
    all.forEach(function (b, bi) {
      var perBranch = b.lvl ? (MOBILE ? 3 : 4) : 2;
      for (var i = 0; i < perBranch; i++) {
        var ti = 0.14 + (0.78 / perBranch) * i + rnd(-0.05, 0.05);
        var pt = along(b.pts, ti);
        var side = ((i + bi) % 2) ? 1 : -1;
        var len = rnd(46, 92) * (b.lvl === 1 ? 1.15 : 1);
        leaf(gLeaf, pt.x, pt.y, pt.a + side * rnd(0.60, 1.15), len, len * rnd(0.21, 0.30),
             slot('leaf', pt.y, 0.085, reach(b.sch, ti)));
      }
    });
  })();

  // 5. HELECHOS — pocos, grandes, en la mitad baja: dan densidad sin ruido.
  (function () {
    var hosts = branches.concat(twigs.slice(0, 4));
    var nF = MOBILE ? 3 : 5;
    for (var i = 0; i < nF; i++) {
      var b = hosts[(i * 2 + 1) % hosts.length];
      var ti = 0.30 + rnd(0, 0.45);
      var pt = along(b.pts, ti);
      var side = (i % 2) ? 1 : -1;
      fern(gFern, pt.x, pt.y, pt.a + side * rnd(0.35, 0.85), rnd(105, 165),
           slot('fern', pt.y, 0.125, reach(b.sch, ti)));
    }
  })();

  // Reparto de focos: barajado determinista para que ninguna ramilla cargue
  // dos flores encima. Es lo que evita los amontonamientos.
  var pool = twigs.slice();
  for (var q = pool.length - 1; q > 0; q--) {
    var w2 = Math.floor(rand() * (q + 1));
    var tmp = pool[q]; pool[q] = pool[w2]; pool[w2] = tmp;
  }
  var nH = MOBILE ? 3 : 4, nR = MOBILE ? 2 : 3;
  var hydSpots  = pool.splice(0, nH);
  var roseSpots = pool.splice(0, nR);
  var budSpots  = pool.slice(0, MOBILE ? 4 : 6);

  // 6. CAPULLOS — en puntas de ramillas libres.
  budSpots.forEach(function (b) {
    var ti = 0.62 + rnd(0, 0.34);
    var pt = along(b.pts, ti);
    bud(gBud, pt.x, pt.y, pt.a + rnd(-0.45, 0.45), rnd(24, 36),
        slot('bud', pt.y, 0.075, reach(b.sch, ti)));
  });

  // 7. HORTENSIAS — racimos focales.
  hydSpots.forEach(function (b) {
    var pt = along(b.pts, 0.97);
    hydrangea(gHyd, pt.x + rnd(-6, 6), pt.y - rnd(12, 26), rnd(44, 58),
              slot('hyd', pt.y, 0.145, reach(b.sch, 1)));
  });

  // 8. ROSAS — los puntos de mayor peso visual.
  roseSpots.forEach(function (b) {
    var pt = along(b.pts, 0.95);
    rose(gRose, pt.x + rnd(-8, 8), pt.y - rnd(10, 24), rnd(46, 60),
         slot('rose', pt.y, 0.155, reach(b.sch, 1)));
  });

  // 9. ZARCILLOS — el último 30% del scroll; rematan la composición.
  (function () {
    var nT = MOBILE ? 7 : 12;
    for (var i = 0; i < nT; i++) {
      var b = all[(i * 5 + 2) % all.length];
      var ti = 0.60 + rnd(0, 0.38);
      var pt = along(b.pts, ti);
      tendril(gTen, pt.x, pt.y, pt.a + rnd(-1.1, 1.1), rnd(12, 22),
              slot('ten', pt.y, 0.09, reach(b.sch, ti)));
    }
  })();

  svg.appendChild(frag);

  /* =========================================================================
     Motor de dibujo
     ========================================================================= */

  // Medición única. Nunca se vuelve a llamar getTotalLength().
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var L = it.el.getTotalLength();
    it.len = L;
    it.el.style.strokeDasharray  = L.toFixed(2);
    it.el.style.strokeDashoffset = L.toFixed(2);
  }

  function render(p) {
    for (var i = 0, it, k; i < items.length; i++) {
      it = items[i];
      k = (p - it.s) / (it.e - it.s);
      k = k <= 0 ? 0 : (k >= 1 ? 1 : it.ease(k));
      k = Math.round(k * 400) / 400;                 // evita escrituras inútiles
      if (k === it.k) continue;
      it.k = k;
      it.el.style.strokeDashoffset = (it.len * (1 - k)).toFixed(2);
    }
  }

  // Accesibilidad: si el usuario pidió menos movimiento, se muestra completa.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    render(1);
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
    shown += (target - shown) * 0.18;                // suavizado del scrub
    if (Math.abs(target - shown) < 0.0005) shown = target;
    render(shown);
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
  window.addEventListener('resize', function () { shown = target = progress(); render(shown); }, { passive: true });

  // La navegación del sitio es una SPA falsa: al cambiar de página el tramo
  // cambia de sitio (o desaparece), así que hay que recalcular el progreso.
  window.gardenRefresh = function () { shown = target = progress(); render(shown); };

  kick();
  render(0);
})();
