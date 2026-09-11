/* =============================================================================
   vines.js — Capa vegetal perimetral
   Hotel La Gruta · Arequipa

   Idea
   ----
   La página empieza limpia. A medida que se baja, enredaderas doradas muy
   tenues nacen desde los bordes izquierdo y derecho y se van metiendo hacia el
   interior de la interfaz. Lo que se dibuja SE QUEDA: el jardín se acumula, no
   se recicla. Al final del recorrido la página está envuelta en vegetación.

   Decisiones que conviene entender antes de tocar esto
   ---------------------------------------------------
   1. El SVG es ABSOLUTO sobre el documento entero (no `fixed`), y sus unidades
      de usuario son píxeles CSS (viewBox = 0 0 anchoViewport altoDocumento).
      Así la vegetación está anclada al contenido: una rama que bordea un título
      sigue bordeándolo al hacer scroll. Con `position: fixed` la capa sería un
      marco estático y se perdería justamente la sensación de crecimiento.
   2. El reloj de la animación NO es un porcentaje global de la página, sino la
      posición en el documento de cada trazo. Cada planta se dibuja cuando el
      usuario llega a su altura. Eso da el efecto "va creciendo conmigo" en vez
      de "todo crece a la vez en algún punto del scroll".
   3. El crecimiento es REVERSIBLE: al subir el scroll la vegetación se
      repliega por donde vino. Es una decisión de diseño, no una limitación —
      ver la perilla PERSISTENTE más abajo si algún día se quiere lo contrario
      (que lo dibujado se quede acumulado).
   4. `pointer-events: none` en la capa: jamás debe bloquear un clic.
   ============================================================================= */
(function () {
  'use strict';

  var B = window.Botanic;
  if (!B) return;

  var MOBILE = window.matchMedia('(max-width: 760px)').matches;

  // Dorado envejecido, no brillante. Todo el peso visual lo lleva la opacidad:
  // el usuario debe descubrir la vegetación, no tropezarse con ella.
  //
  // INTENSIDAD es la única perilla para subir o bajar TODA la capa de golpe.
  // 1 = los valores base de abajo. 1.5 = un 50% más de presencia.
  // Si algún día se quiere más discreta, se baja aquí y no en cinco sitios.
  var INTENSIDAD = 1.8;

  // false = reversible: al subir el scroll la planta se repliega por donde
  //         vino, como si el crecimiento rebobinara. Ata la animación al
  //         gesto del usuario y hace que se note que responde al scroll.
  // true  = persistente: lo dibujado se queda y el jardín se acumula.
  var PERSISTENTE = false;
  // Verde oliva tirando a dorado: mezcla del dorado anterior (#C5A059) con el
  // verde de marca del sitio (--green: #3A5236), 65% dorado / 35% verde para
  // que siga leyéndose cálido y no se apague en caqui.
  var GOLD = '#948550', GOLD_D = '#6E611F';
  var TONE = {
    stem:   { c: GOLD_D, o: 0.34 },
    leaf:   { c: GOLD,   o: 0.26 },
    vein:   { c: GOLD,   o: 0.13 },
    flower: { c: GOLD_D, o: 0.38 },
    detail: { c: GOLD,   o: 0.17 }
  };

  var layer = document.createElement('div');
  layer.className = 'vines-layer';
  layer.setAttribute('aria-hidden', 'true');
  var svg = document.createElementNS(B.NS, 'svg');
  svg.setAttribute('preserveAspectRatio', 'xMidYMin slice');
  layer.appendChild(svg);
  document.body.appendChild(layer);

  var items = [], W = 0, Hdoc = 0, vh = 0, scrollMax = 1, U = 0.1;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Zonas donde no se siembra ──────────────────────────────────────────── */
  // Las fotos a sangre y el mapa van SIEMPRE por encima de la vegetación, así
  // que dibujar debajo de ellas sería gastar trazos invisibles. Y la sección
  // "El jardín" ya tiene su propia ilustración: meterle enredaderas encima
  // sería ruido, no densidad.
  // DURAS: fotos a sangre y mapa. Van siempre por encima de la vegetación, así
  // que sembrar debajo sería gastar trazos invisibles.
  // SUAVE: la sección "El jardín" ya tiene su propia ilustración de grafito.
  // Bloquearla del todo abría un hueco muerto de 380vh —el 43% de la página— y
  // rompía justamente la continuidad que se busca. Así que ahí sí crece
  // vegetación, pero corta y pegada al borde: acompaña sin competir.
  function zones(page) {
    var hard = [], soft = [];
    page.querySelectorAll('.hero, .band, .loc-map').forEach(function (el) {
      var r = el.getBoundingClientRect();
      hard.push([r.top + window.scrollY - 40, r.bottom + window.scrollY + 40]);
    });
    page.querySelectorAll('.garden').forEach(function (el) {
      var r = el.getBoundingClientRect();
      soft.push([r.top + window.scrollY - 60, r.bottom + window.scrollY + 60]);
    });
    return { hard: hard, soft: soft };
  }
  function inside(ranges, y) {
    for (var i = 0; i < ranges.length; i++) {
      if (y >= ranges[i][0] && y <= ranges[i][1]) return true;
    }
    return false;
  }

  /* ── Construcción ───────────────────────────────────────────────────────── */

  function build() {
    var page = document.querySelector('.page.active');
    if (!page) return;

    // Medir con la capa colapsada para que su propia altura no infle el
    // scrollHeight del documento (si no, cada rebuild haría crecer la página).
    layer.style.height = '0px';
    W    = document.documentElement.clientWidth;
    vh   = window.innerHeight;
    Hdoc = Math.max(document.body.scrollHeight, page.scrollHeight);

    svg.innerHTML = '';
    items.length = 0;
    scrollMax = Math.max(1, Hdoc - vh);
    U = vh / scrollMax;                       // "una pantalla" en unidades de progreso

    layer.style.height = Hdoc + 'px';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Hdoc);
    svg.setAttribute('width', W);
    svg.setAttribute('height', Hdoc);

    // Semilla derivada de la página: cada sección tiene su propio jardín, pero
    // siempre el mismo (no cambia entre visitas ni al redimensionar).
    var seed = 0x9E3779B1;
    for (var c = 0; c < page.id.length; c++) seed = (seed * 31 + page.id.charCodeAt(c)) >>> 0;
    var rand = B.makeRng(seed);

    var frag = document.createDocumentFragment();
    var groups = {};
    ['tallos', 'ramas', 'ramillas', 'hojas', 'helechos', 'capullos',
     'hortensias', 'rosas', 'zarcillos'].forEach(function (n) {
      var g = document.createElementNS(B.NS, 'g');
      g.setAttribute('data-part', n);
      frag.appendChild(g);
      groups[n] = g;
    });

    var P = {
      rand: rand,
      rnd: function (a, b) { return a + rand() * (b - a); },
      detail: MOBILE ? 0.42 : 0.62,           // capa ambiental: menos microdetalle
      draw: function (g, d, w, tone, sch, ease) {
        if (!d || sch.s > 1.02) return;
        var t = TONE[tone] || TONE.leaf;
        var p = document.createElementNS(B.NS, 'path');
        p.setAttribute('d', d);
        p.setAttribute('stroke', t.c);
        p.setAttribute('stroke-width', (w * 1.05).toFixed(2));
        p.setAttribute('opacity', Math.min(1, t.o * INTENSIDAD).toFixed(2));
        g.appendChild(p);
        items.push({ el: p, s: sch.s, e: Math.max(sch.e, sch.s + 0.004),
                     ease: ease || B.EASE.out, k: -1, len: 0 });
      }
    };
    var rnd = P.rnd, E = B.EASE, clamp = B.clamp;

    // Orden biológico: una flor nunca antes que su rama. En "pantallas de
    // scroll" (U), contadas desde que la planta asoma por el borde inferior.
    var OFF = { stem: 0, branch: 0.12, twig: 0.20, leaf: 0.28, fern: 0.36,
                bud: 0.44, hyd: 0.50, rose: 0.58, ten: 0.66 };
    var DUR = { stem: 0.34, branch: 0.24, twig: 0.18, leaf: 0.16, fern: 0.24,
                bud: 0.14, hyd: 0.28, rose: 0.30, ten: 0.18 };
    var SPAN = (OFF.ten + DUR.ten) * U;      // lo que tarda una planta entera

    /* ── Una enredadera ───────────────────────────────────────────────────── */
    function vine(y0, side, u, shy) {
      // `rich` crece con la profundidad: arriba apenas un brote, abajo una mata.
      var rich = clamp((u - 0.05) / 0.75, 0, 1);
      var inward = side < 0 ? 1 : -1;
      var x0 = side < 0 ? -12 : W + 12;
      var down = rand() < 0.62;               // mayoría diagonal descendente
      var ang = inward * (down ? rnd(1.85, 2.45) : rnd(0.85, 1.35));
      var reach = W * (MOBILE ? rnd(0.20, 0.36) : rnd(0.26, 0.50)) * (0.70 + 0.45 * rich);
      if (shy) reach *= 0.42;                 // zona suave: se queda en el borde

      // El reloj se ancla a la planta entera, no a cada trazo: así crece como
      // un solo organismo mientras cruza la pantalla. En el último viewport ya
      // no queda scroll por delante, así que la línea de tiempo se comprime
      // (`sq`) para que la planta alcance a dibujarse entera.
      var s0 = clamp((y0 - vh * 0.85) / scrollMax, 0, 0.999);
      var sq = clamp((0.995 - s0) / SPAN, 0.28, 1);
      s0 = Math.min(s0, 0.995 - SPAN * sq);
      function when(_y, off, dur) {
        var st = s0 + (off + rnd(0, 0.03)) * U * sq;
        return { s: st, e: st + dur * U * sq };
      }

      var stem = B.growS(P, x0, y0, ang, reach, rnd(0.45, 0.90), 16);
      var sSch = when(y0, OFF.stem, DUR.stem);
      P.draw(groups.tallos, B.catmull(stem), 1.15, 'stem', sSch, E.inout);

      var carriers = [{ pts: stem, main: true }];

      // Ramas: de 1 arriba a 4 abajo.
      var nB = Math.max(1, Math.round(1 + rich * (MOBILE ? 1.6 : 3)));
      for (var i = 0; i < nB; i++) {
        var ti = 0.26 + (0.58 / nB) * i + rnd(-0.06, 0.06);
        var bp = B.along(stem, ti);
        var bs = (i % 2) ? 1 : -1;
        var blen = reach * rnd(0.32, 0.62);
        var bpts = B.growS(P, bp.x, bp.y, bp.a + bs * rnd(0.45, 0.95), blen, rnd(0.35, 0.75), 11);
        P.draw(groups.ramas, B.catmull(bpts), 0.85, 'stem',
               when(bp.y, OFF.branch + ti * 0.10, DUR.branch), E.out);
        carriers.push({ pts: bpts, main: false });

        // Ramificación secundaria en las matas más desarrolladas.
        if (rich > 0.45 && rand() < 0.55) {
          var tj = rnd(0.40, 0.75), sp = B.along(bpts, tj);
          var spts = B.growS(P, sp.x, sp.y, sp.a + (rand() < 0.5 ? 1 : -1) * rnd(0.40, 0.85),
                             blen * rnd(0.40, 0.65), rnd(0.30, 0.70), 8);
          P.draw(groups.ramillas, B.catmull(spts), 0.62, 'leaf',
                 when(sp.y, OFF.twig, DUR.twig), E.out);
          carriers.push({ pts: spts, main: false });
        }
      }

      // 4. HOJAS — enganchadas a una rama, nunca sueltas.
      var scale = (MOBILE ? 0.82 : 1) * (0.72 + 0.45 * rich);
      carriers.forEach(function (c, ci) {
        var n = Math.max(1, Math.round((c.main ? 2 : 3) * (0.6 + 0.7 * rich) * (MOBILE ? 0.55 : 1)));
        for (var k = 0; k < n; k++) {
          var t = 0.20 + (0.70 / n) * k + rnd(-0.06, 0.06);
          var pt = B.along(c.pts, t);
          var sd = ((k + ci) % 2) ? 1 : -1;
          var len = rnd(26, 52) * scale;
          B.leaf(P, groups.hojas, pt.x, pt.y, pt.a + sd * rnd(0.55, 1.15),
                 len, len * rnd(0.22, 0.31),
                 when(pt.y, OFF.leaf + t * 0.10, DUR.leaf));
        }
      });

      // 5. HELECHOS — finos y algunos colgando. Aparecen a media página.
      if (u > 0.22 && rand() < 0.30 + rich * 0.40) {
        var cf = carriers[1 + Math.floor(rand() * (carriers.length - 1))] || carriers[0];
        var tf = rnd(0.35, 0.80), pf = B.along(cf.pts, tf);
        // ~40% cuelgan: el ángulo apunta hacia abajo en vez de seguir la rama.
        var af = rand() < 0.4 ? (Math.PI + rnd(-0.45, 0.45))
                              : pf.a + (rand() < 0.5 ? 1 : -1) * rnd(0.40, 0.90);
        B.fern(P, groups.helechos, pf.x, pf.y, af, rnd(48, 92) * scale,
               when(pf.y, OFF.fern, DUR.fern));
      }

      // 6. BROTES
      for (var nb = 0, maxb = 1 + Math.round(rich * 2); nb < maxb; nb++) {
        if (u < 0.12 || rand() > 0.55 + rich * 0.35) continue;
        var cb = carriers[Math.floor(rand() * carriers.length)];
        var pb = B.along(cb.pts, rnd(0.70, 0.99));
        B.bud(P, groups.capullos, pb.x, pb.y, pb.a + rnd(-0.5, 0.5), rnd(11, 19) * scale,
              when(pb.y, OFF.bud + nb * 0.05, DUR.bud));
      }

      // 7. HORTENSIAS — a partir de la mitad de la página.
      if (u > 0.34 && rand() < (u - 0.34) * 1.5) {
        var ch = carriers[1 + Math.floor(rand() * (carriers.length - 1))] || carriers[0];
        var ph = B.along(ch.pts, rnd(0.85, 1.0));
        B.hydrangea(P, groups.hortensias, ph.x, ph.y, rnd(17, 27) * scale,
                    when(ph.y, OFF.hyd, DUR.hyd));
      }

      // 8. ROSAS — puntos focales ocasionales, hacia el final del recorrido.
      if (u > 0.46 && rand() < (u - 0.46) * 1.3) {
        var cr = carriers[1 + Math.floor(rand() * (carriers.length - 1))] || carriers[0];
        var pr = B.along(cr.pts, rnd(0.88, 1.0));
        B.rose(P, groups.rosas, pr.x, pr.y, rnd(15, 24) * scale,
               when(pr.y, OFF.rose, DUR.rose));
      }

      // 9. ZARCILLOS — baratos en trazos, carísimos en sensación de vida.
      var nT = Math.max(1, Math.round(1 + rich * 2.5));
      for (var z = 0; z < nT; z++) {
        var cz = carriers[Math.floor(rand() * carriers.length)];
        var tz = rnd(0.55, 1.0), pz = B.along(cz.pts, tz);
        B.tendril(P, groups.zarcillos, pz.x, pz.y, pz.a + rnd(-1.2, 1.2),
                  rnd(6, 13) * scale, when(pz.y, OFF.ten, DUR.ten));
      }
    }

    /* ── Siembra por bandas ───────────────────────────────────────────────── */
    var Z      = zones(page);
    // Un tercio del espaciado anterior: nace una planta tres veces más
    // seguido a lo largo del documento.
    var bandH  = MOBILE ? 187 : 143;
    var hero   = page.querySelector('.hero');
    var yStart = hero ? hero.getBoundingClientRect().bottom + window.scrollY + 40 : 120;
    var yEnd   = Hdoc - 40;
    var side   = rand() < 0.5 ? -1 : 1;

    for (var y = yStart; y < yEnd; y += bandH) {
      var u = clamp(y / Hdoc, 0, 1);
      // Alternancia con excepciones: dos seguidas del mismo lado de vez en
      // cuando. Es lo que rompe la simetría de espejo.
      side = (rand() < 0.78) ? -side : side;

      var n = 1 + (!MOBILE && u > 0.40 && rand() < (u - 0.30) * 1.1 ? 1 : 0);
      for (var k = 0; k < n; k++) {
        var yy = y + rnd(0.05, 0.80) * bandH;
        if (yy >= yEnd || inside(Z.hard, yy)) continue;
        vine(yy, k ? -side : side, clamp(yy / Hdoc, 0, 1), inside(Z.soft, yy));
      }
    }

    svg.appendChild(frag);
    B.measure(items);
    B.render(items, REDUCED ? 1 : progress(), false);
  }

  /* ── Motor de scroll ────────────────────────────────────────────────────── */

  function progress() {
    // Se cierra en 1 un poco antes del tope real: las últimas plantas deben
    // quedar terminadas al llegar al pie, no justo en el último píxel.
    return B.clamp(window.scrollY / (scrollMax * 0.96), 0, 1);
  }

  var running = false;
  function frame() {
    B.render(items, progress(), PERSISTENTE);
    running = false;
  }
  function kick() {
    if (REDUCED || running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  window.addEventListener('scroll', kick, { passive: true });

  var rT;
  window.addEventListener('resize', function () {
    clearTimeout(rT);
    rT = setTimeout(build, 280);
  }, { passive: true });

  // La SPA cambia de página sin recargar: el documento entero es otro, así que
  // la capa se reconstruye. Se espera un frame a que el layout se asiente.
  window.vinesRefresh = function () { setTimeout(build, 60); };

  function boot() {
    build();
    // Las tipografías web pueden cambiar la altura del documento después del
    // load. Si se mueve de forma apreciable, se reconstruye una sola vez.
    setTimeout(function () {
      if (Math.abs(document.body.scrollHeight - Hdoc) > 120) build();
    }, 1200);
  }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
