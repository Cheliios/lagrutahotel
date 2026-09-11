/* =============================================================================
   botanic-lib.js — Biblioteca botánica vectorial compartida
   Hotel La Gruta · Arequipa

   Por qué existe
   --------------
   El sitio tiene DOS sistemas vegetales distintos que dibujan las mismas
   especies con estéticas diferentes:

     · botanic.js → la sección "El jardín": una composición vertical en grafito,
                    es una pieza editorial y se mira de frente.
     · vines.js   → la capa perimetral: enredaderas doradas muy tenues que
                    crecen desde los bordes a lo largo de toda la página.

   Duplicar el generador de hojas, helechos, hortensias y rosas en los dos
   archivos sería el camino corto y el error caro: cualquier ajuste al dibujo
   habría que hacerlo dos veces y acabarían divergiendo. Así que la geometría
   vive aquí una sola vez, y cada capa aporta su "pintor" (color, opacidad,
   nivel de detalle y ventana de scroll).

   Contrato del pintor (P)
   -----------------------
     P.rnd(a, b)   → aleatorio con la semilla de esa capa
     P.rand()      → aleatorio 0..1
     P.detail      → 0..1, escala la cantidad de nervaduras, folíolos, flores
     P.draw(g, d, width, tone, sch, ease)
                   → crea el path; `tone` es semántico ('stem' | 'leaf' |
                     'vein' | 'flower' | 'detail') y cada capa decide qué
                     color y qué opacidad le corresponde.
     sch           → { s, e } ventana de progreso de scroll de ese trazo
   ============================================================================= */
window.Botanic = (function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  /* ── RNG determinista (LCG). Misma semilla ⇒ misma planta siempre. ─────── */
  function makeRng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function nn(v) { return Math.round(v * 10) / 10; }

  var EASE = {
    out:   function (t) { return 1 - Math.pow(1 - t, 3); },
    soft:  function (t) { return 1 - Math.pow(1 - t, 2); },
    inout: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  };

  /* ── Geometría ──────────────────────────────────────────────────────────── */

  // Catmull-Rom → cúbicas. Convierte una polilínea en una curva orgánica.
  function catmull(pts) {
    if (!pts || pts.length < 2) return '';
    var d = 'M' + nn(pts[0][0]) + ',' + nn(pts[0][1]);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || pts[i + 1];
      d += 'C' + nn(p1[0] + (p2[0] - p0[0]) / 6) + ',' + nn(p1[1] + (p2[1] - p0[1]) / 6) +
           ' '  + nn(p2[0] - (p3[0] - p1[0]) / 6) + ',' + nn(p2[1] - (p3[1] - p1[1]) / 6) +
           ' '  + nn(p2[0]) + ',' + nn(p2[1]);
    }
    return d;
  }

  // Crecimiento recto-curvo. Ángulo 0 = hacia arriba; `curve` es la curvatura
  // TOTAL acumulada en el tramo, `wob` el temblor por segmento.
  function grow(P, x, y, ang, len, curve, wob, segs) {
    var pts = [[x, y]], a = ang, step = len / segs;
    for (var i = 1; i <= segs; i++) {
      a += curve / segs + P.rnd(-wob, wob);
      x += Math.sin(a) * step;
      y -= Math.cos(a) * step;
      pts.push([x, y]);
    }
    return pts;
  }

  // Crecimiento en S: la dirección oscila en vez de curvarse siempre al mismo
  // lado. Es lo que separa una enredadera de un arco de circunferencia.
  function growS(P, x, y, ang, len, amp, segs) {
    var pts = [[x, y]], step = len / segs;
    var f1 = P.rnd(0.9, 1.7), f2 = P.rnd(2.2, 3.6), ph = P.rnd(0, 6.28);
    var sgn = P.rand() < 0.5 ? 1 : -1, a = ang;
    for (var i = 1; i <= segs; i++) {
      var t = i / segs;
      a = ang + sgn * amp * (Math.sin(t * Math.PI * f1 + ph) * 0.78 +
                             Math.sin(t * Math.PI * f2 + ph * 1.7) * 0.22) +
          P.rnd(-0.03, 0.03);
      x += Math.sin(a) * step;
      y -= Math.cos(a) * step;
      pts.push([x, y]);
    }
    return pts;
  }

  // Punto + tangente a lo largo de una polilínea, parametrizado por longitud.
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
        return { x: p[0] + (q[0] - p[0]) * u,
                 y: p[1] + (q[1] - p[1]) * u,
                 a: Math.atan2(q[0] - p[0], -(q[1] - p[1])) };
      }
      acc += segs[i];
    }
    return { x: pts[0][0], y: pts[0][1], a: 0 };
  }

  // Ventana derivada: fracción [f0,f1] de la ventana del elemento padre.
  function win(sch, f0, f1) {
    var d = sch.e - sch.s;
    return { s: sch.s + d * f0, e: sch.s + d * f1 };
  }

  /* ── Perfiles de lámina ─────────────────────────────────────────────────── */

  function widthAt(t, w) { return Math.sin(Math.pow(t, 0.70) * Math.PI) * w; }

  // Contorno de una lámina (hoja / folíolo) como UN trazo continuo: sube por un
  // borde, dobla en la punta y baja por el otro. Un solo path ⇒ se dibuja de
  // corrido, que es lo que hace que parezca trazado a mano.
  function bladeD(P, mid, w, wob) {
    var L = [], R = [], i, t, p, q, o, tx, ty, m, nx, ny, wp;
    for (i = 0; i < mid.length; i++) {
      t = i / (mid.length - 1);
      wp = widthAt(t, w) * (1 + P.rnd(-wob, wob));
      p = mid[i]; q = mid[Math.min(i + 1, mid.length - 1)]; o = mid[Math.max(i - 1, 0)];
      tx = q[0] - o[0]; ty = q[1] - o[1]; m = Math.sqrt(tx * tx + ty * ty) || 1;
      nx = -ty / m; ny = tx / m;
      L.push([p[0] + nx * wp, p[1] + ny * wp]);
      R.push([p[0] - nx * wp, p[1] - ny * wp]);
    }
    R.reverse();
    return catmull(L) + catmull(R).replace('M', 'L');
  }

  /* =========================================================================
     ESPECIES
     ========================================================================= */

  // HOJA — contorno + nervio central + nervaduras laterales.
  function leaf(P, g, x, y, ang, len, wid, sch) {
    var mid = grow(P, x, y, ang, len, P.rnd(-0.55, 0.55), 0.035, 10);
    P.draw(g, bladeD(P, mid, wid, 0.07), 0.85, 'leaf',  win(sch, 0,    0.62), EASE.out);
    P.draw(g, catmull(mid),              0.62, 'vein',  win(sch, 0.22, 0.80), EASE.soft);
    var nv = Math.max(2, Math.round(4 * P.detail));
    for (var v = 0; v < nv; v++) {
      var t = 0.22 + (0.62 / nv) * v + P.rnd(-0.03, 0.03);
      var pt = along(mid, t);
      var side = (v % 2) ? 1 : -1;
      var vp = grow(P, pt.x, pt.y, pt.a + side * (Math.PI / 2) - side * 0.60,
                    widthAt(t, wid) * 0.80, side * 0.40, 0.01, 4);
      P.draw(g, catmull(vp), 0.45, 'vein',
             win(sch, 0.45 + v * 0.08, 0.78 + v * 0.06), EASE.soft);
    }
  }

  // HELECHO — raquis ligero con muchos folíolos ligeramente irregulares.
  function fern(P, g, x, y, ang, len, sch) {
    var rachis = grow(P, x, y, ang, len, P.rnd(-0.70, 0.70), 0.02, 14);
    P.draw(g, catmull(rachis), 0.75, 'stem', win(sch, 0, 0.42), EASE.out);
    var pairs = Math.max(6, Math.round(11 * P.detail));
    for (var i = 0; i < pairs; i++) {
      var t = 0.07 + (i / (pairs - 1)) * 0.90;
      var pt = along(rachis, t);
      var ll = len * 0.215 * Math.sin(Math.pow(t, 0.55) * Math.PI * 0.95) * P.rnd(0.82, 1.14);
      if (ll < 3) continue;
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        var lf = grow(P, pt.x, pt.y, pt.a + s2 * (Math.PI / 2) - s2 * (0.62 + t * 0.30),
                      ll, s2 * P.rnd(0.25, 0.55), 0.02, 6);
        var f0 = 0.30 + 0.62 * t + P.rnd(0, 0.05);
        P.draw(g, bladeD(P, lf, ll * 0.26, 0.10), 0.55, 'leaf', win(sch, f0, f0 + 0.22), EASE.soft);
      }
    }
  }

  // HORTENSIA — racimo compacto de florecillas de 4-5 pétalos.
  function floretD(P, cx, cy, r, np, rot) {
    var d = '', step = (Math.PI * 2) / np, inner = r * 0.20, i;
    for (i = 0; i < np; i++) {
      var a1 = rot + i * step, a2 = a1 + step, am = a1 + step / 2;
      var p1 = [cx + Math.cos(a1) * inner, cy + Math.sin(a1) * inner];
      var p2 = [cx + Math.cos(a2) * inner, cy + Math.sin(a2) * inner];
      var rr = r * P.rnd(0.88, 1.06);
      var tip = [cx + Math.cos(am) * rr, cy + Math.sin(am) * rr];
      var q1 = [cx + Math.cos(a1 + step * 0.16) * rr * 0.90, cy + Math.sin(a1 + step * 0.16) * rr * 0.90];
      var q2 = [cx + Math.cos(a2 - step * 0.16) * rr * 0.90, cy + Math.sin(a2 - step * 0.16) * rr * 0.90];
      if (i === 0) d += 'M' + nn(p1[0]) + ',' + nn(p1[1]);
      d += 'Q' + nn(q1[0]) + ',' + nn(q1[1]) + ' ' + nn(tip[0]) + ',' + nn(tip[1]) +
           'Q' + nn(q2[0]) + ',' + nn(q2[1]) + ' ' + nn(p2[0]) + ',' + nn(p2[1]);
    }
    return d;
  }

  function hydrangea(P, g, x, y, r, sch) {
    var nF = Math.max(7, Math.round(17 * P.detail));
    var GA = Math.PI * (3 - Math.sqrt(5));          // ángulo áureo: relleno natural
    var rot0 = P.rnd(0, 6.28);
    for (var i = 0; i < nF; i++) {
      var rr = r * Math.sqrt((i + 0.55) / nF);
      var th = i * GA + rot0;
      var cx = x + Math.cos(th) * rr * P.rnd(0.86, 1.14);
      var cy = y + Math.sin(th) * rr * P.rnd(0.86, 1.14) * 0.88;
      var fr = r * P.rnd(0.19, 0.27);
      var f0 = 0.05 + 0.70 * (i / nF) + P.rnd(0, 0.06);
      P.draw(g, floretD(P, cx, cy, fr, P.rand() < 0.45 ? 4 : 5, P.rnd(0, 6.28)),
             0.65, 'flower', win(sch, f0, f0 + 0.20), EASE.soft);
      if (i % 2 === 0) {
        P.draw(g, floretD(P, cx, cy, fr * 0.26, 3, P.rnd(0, 6.28)),
               0.45, 'detail', win(sch, f0 + 0.10, f0 + 0.24), EASE.soft);
      }
    }
  }

  // ROSA — corazón enrollado + anillos de pétalos en ARCO ABIERTO.
  // Clave del dibujo: el pétalo NO vuelve al centro por los dos extremos (eso
  // cerraría el trazo en círculo y se vería como un ovillo de aros). Es un arco
  // casi concéntrico con las puntas apenas recogidas: una "C". Anillos de C
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

  function rose(P, g, x, y, r, sch) {
    var squash = P.rnd(0.86, 1.0);
    //          radio  nº  semiapertura  recogido de puntas
    var all = [[0.16, 3, 1.52, 0.28], [0.30, 4, 1.38, 0.26], [0.46, 5, 1.26, 0.24],
               [0.64, 5, 1.16, 0.21], [0.84, 6, 1.04, 0.16], [1.00, 6, 0.92, 0.08]];
    var rings = P.detail > 0.8 ? all : all.filter(function (_, i) { return i % 2 === 0 || i > 3; });
    var done = 0, tot = 0, i, k;
    for (i = 0; i < rings.length; i++) tot += rings[i][1];

    var sp = [], turns = P.rnd(1.4, 1.8);
    for (i = 0; i <= 16; i++) {
      var t = i / 16, th = t * turns * Math.PI * 2, rr = r * 0.11 * t + r * 0.02;
      sp.push([x + Math.cos(th) * rr, y + Math.sin(th) * rr * squash]);
    }
    P.draw(g, catmull(sp), 0.62, 'flower', win(sch, 0, 0.18), EASE.soft);

    // Cada anillo se descentra un poco: el solape asimétrico es lo que hace que
    // la flor parezca dibujada a mano y no generada.
    var dA = P.rnd(0, 6.28);
    for (i = 0; i < rings.length; i++) {
      var rad = rings[i][0], np = rings[i][1], sw = rings[i][2], tuck = rings[i][3];
      var off = P.rnd(0, 6.28);
      var ox = Math.cos(dA) * r * 0.04 * i, oy = Math.sin(dA) * r * 0.04 * i;
      for (k = 0; k < np; k++) {
        var ang = off + k * (Math.PI * 2 / np) + P.rnd(-0.14, 0.14);
        var f0 = 0.10 + 0.74 * (done / tot) + P.rnd(0, 0.03);
        P.draw(g, petalD(x + ox, y + oy, r * rad * P.rnd(0.93, 1.07), ang,
                         sw * 0.5 * P.rnd(0.88, 1.12), squash, tuck),
               0.80 - i * 0.04, 'flower', win(sch, f0, f0 + 0.16), EASE.soft);
        done++;
      }
    }
    for (i = 0; i < 3; i++) {
      var sa = P.rnd(0, 6.28);
      var sep = grow(P, x + Math.cos(sa) * r * 0.95, y + Math.sin(sa) * r * 0.95 * squash,
                     sa + Math.PI / 2, r * 0.40, P.rnd(-0.6, 0.6), 0.02, 5);
      P.draw(g, catmull(sep), 0.50, 'detail', win(sch, 0.80, 0.98), EASE.soft);
    }
  }

  // CAPULLO — lámina cerrada + dos sépalos.
  function bud(P, g, x, y, ang, size, sch) {
    var mid = grow(P, x, y, ang, size, P.rnd(-0.25, 0.25), 0.01, 7);
    P.draw(g, bladeD(P, mid, size * 0.30, 0.05), 0.72, 'flower', win(sch, 0, 0.55), EASE.out);
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      var sp = grow(P, x, y, ang + s2 * 0.55, size * 0.52, -s2 * 0.55, 0.01, 5);
      P.draw(g, catmull(sp), 0.52, 'detail', win(sch, 0.45, 0.90), EASE.soft);
    }
  }

  // ZARCILLO — rizo que enrolla hacia dentro. Barato en trazos y carísimo en
  // sensación de vida: es el detalle que hace que la planta parezca crecer.
  function tendril(P, g, x, y, ang, size, sch) {
    var dir = P.rand() < 0.5 ? 1 : -1, pts = [], i;
    var cx = x - Math.cos(ang) * size, cy = y - Math.sin(ang) * size;
    var turns = P.rnd(1.5, 2.3);
    for (i = 0; i <= 30; i++) {
      var t = i / 30, rr = size * (1 - t * 0.86), th = ang + dir * t * turns * Math.PI * 2;
      pts.push([cx + Math.cos(th) * rr, cy + Math.sin(th) * rr]);
    }
    P.draw(g, catmull(pts), 0.50, 'detail', sch, EASE.soft);
  }

  /* =========================================================================
     Motor de dibujo compartido
     ========================================================================= */

  // getTotalLength() se llama UNA vez por trazo, aquí y solo aquí.
  function measure(items) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i], L = it.el.getTotalLength();
      it.len = L; it.k = -1;
      it.el.style.strokeDasharray  = L.toFixed(2);
      it.el.style.strokeDashoffset = L.toFixed(2);
    }
  }

  // `persist`: una vez dibujado, el trazo se queda aunque se suba el scroll.
  function render(items, p, persist) {
    for (var i = 0, it, k; i < items.length; i++) {
      it = items[i];
      k = (p - it.s) / (it.e - it.s);
      k = k <= 0 ? 0 : (k >= 1 ? 1 : it.ease(k));
      k = Math.round(k * 400) / 400;            // evita escrituras inútiles
      if (persist && k < it.k) continue;         // crecimiento persistente
      if (k === it.k) continue;
      it.k = k;
      it.el.style.strokeDashoffset = (it.len * (1 - k)).toFixed(2);
    }
  }

  return {
    NS: NS, makeRng: makeRng, clamp: clamp, EASE: EASE,
    catmull: catmull, grow: grow, growS: growS, along: along, win: win,
    bladeD: bladeD, leaf: leaf, fern: fern, hydrangea: hydrangea,
    rose: rose, bud: bud, tendril: tendril,
    measure: measure, render: render
  };
})();
