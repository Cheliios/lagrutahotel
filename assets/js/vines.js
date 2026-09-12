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
      ver la perilla PERSISTENTE más abajo — hoy en true: el crecimiento se
      acumula, y lo que da la sensación de scroll continuo en desktop es el
      suavizado (raw → objetivo → mostrado → trazos), no el replegado.
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
  // Ahora vale 1: los números de TONE son las opacidades FINALES, las que se
  // ven. Antes había un multiplicador de 1.8 encima y había que hacer la
  // cuenta mentalmente para saber con qué opacidad se estaba dibujando.
  var INTENSIDAD = 1;

  // false = reversible: al subir el scroll la planta se repliega por donde
  //         vino, como si el crecimiento rebobinara. Ata la animación al
  //         gesto del usuario y hace que se note que responde al scroll.
  // true  = persistente: lo dibujado se queda y el jardín se acumula.
  var PERSISTENTE = true;
  // Dorado apagado / champagne. Se le quitó la carga verde que tenía antes:
  // más cálido y un punto más claro, pero desaturado — un champagne envejecido,
  // no un dorado metálico. El tono oscuro se mantiene profundo a propósito: a
  // opacidad 0.35 sobre papel crema, un champagne claro desaparecería.
  var GOLD = '#A89468', GOLD_D = '#7A6739';
  // Cuatro niveles: la estructura sostiene, las flores puntúan, y el
  // microdetalle solo se percibe de cerca. La capa puede ser abundante
  // mientras cada trazo suelto sea tenue.
  var TONE = {
    stem:   { c: GOLD_D, o: 0.35 },   // estructura      (rango pedido 0.20–0.35)
    leaf:   { c: GOLD,   o: 0.25 },   // hojas, helechos (rango pedido 0.12–0.25)
    flower: { c: GOLD_D, o: 0.40 },   // flores          (rango pedido 0.22–0.40)
    vein:   { c: GOLD,   o: 0.15 },   // microdetalle    (rango pedido 0.08–0.16)
    detail: { c: GOLD,   o: 0.16 }    // microdetalle    (rango pedido 0.08–0.16)
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
     'hortensias', 'rosas', 'zarcillos', 'acentos'].forEach(function (n) {
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
        p.setAttribute('stroke-width', (w * 0.95).toFixed(2));
        p.setAttribute('opacity', Math.min(1, t.o * INTENSIDAD).toFixed(2));
        g.appendChild(p);
        items.push({ el: p, s: sch.s, e: Math.max(sch.e, sch.s + 0.004),
                     ease: ease || B.EASE.out, k: -1, len: 0 });
      }
    };
    var rnd = P.rnd, E = B.EASE, clamp = B.clamp;

    // Baja el nivel de detalle solo para una llamada concreta. Una hortensia
    // diminuta con 11 florecillas es un borrón; con 7 sigue siendo un racimo.
    function conDetalle(v, fn) {
      var prev = P.detail;
      P.detail = v;
      fn();
      P.detail = prev;
    }

    // Orden biológico: una flor nunca antes que su rama. En "pantallas de
    // scroll" (U), contadas desde que la planta asoma por el borde inferior.
    var OFF = { stem: 0, branch: 0.12, twig: 0.20, leaf: 0.28, fern: 0.36,
                bud: 0.44, hyd: 0.50, rose: 0.58, ten: 0.66 };
    var DUR = { stem: 0.34, branch: 0.24, twig: 0.18, leaf: 0.16, fern: 0.24,
                bud: 0.14, hyd: 0.28, rose: 0.30, ten: 0.18 };
    var SPAN = (OFF.ten + DUR.ten) * U;      // lo que tarda una planta entera

    /* ── Una enredadera ───────────────────────────────────────────────────── */
    // Reloj de una planta: se ancla a la planta ENTERA, no a cada trazo, para
    // que crezca como un solo organismo mientras cruza la pantalla. En el
    // último viewport ya no queda scroll por delante, así que la línea de
    // tiempo se comprime (`sq`) para que alcance a dibujarse completa.
    function reloj(y0) {
      var s0 = clamp((y0 - vh * 0.85) / scrollMax, 0, 0.999);
      var sq = clamp((0.995 - s0) / SPAN, 0.28, 1);
      s0 = Math.min(s0, 0.995 - SPAN * sq);
      return function (_y, off, dur) {
        var st = s0 + (off + rnd(0, 0.03)) * U * sq;
        return { s: st, e: st + dur * U * sq };
      };
    }

    // Posición de layout en coordenadas del documento. Se suma la cadena de
    // offsetParent en vez de usar getBoundingClientRect porque los elementos
    // con revelado al hacer scroll (.rv-el) llevan un transform temporal de
    // 30px que falsearía la medida.
    function caja(el) {
      var x = 0, y = 0, n = el;
      while (n) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
    }

    /* ── ARCO NARRATIVO: CIUDAD → CALMA → JARDÍN → REFUGIO ──────────────────
       La página no debe sentirse igual arriba que abajo. Arriba se entra a un
       hotel: limpio, arquitectónico, contenido. Abajo se está dentro de su
       jardín.

       Antes esto estaba mal resuelto: las compuertas por profundidad estaban
       todas entre u=0.06 y u=0.28, así que el vocabulario botánico completo
       —flores incluidas— se desbloqueaba antes del primer tercio y luego solo
       se repetía. Medido: el primer cuarto ya tenía un 38% de flores, y el
       último cuarto tenía MENOS vegetación que el central.

       Ahora cada parámetro sigue una curva a lo largo de toda la página. Se
       INTERPOLA entre actos en vez de saltar de uno a otro: el brief pide que
       no se noten las transiciones, y un salto en cualquiera de estos valores
       se vería como una costura. */
    var DENS = 1, ALCANCE = 2, FOLLAJE = 3, FLORES = 4, FOCAL = 5;
    // El arco REDISTRIBUYE densidad, no la añade: el total de trazos se
    // mantiene en el presupuesto de frame y lo que cambia es dónde está.
    // El pico llega hacia u≈0.75 y se sostiene: el último cuarto de Inicio lo
    // ocupa casi entero la banda fotográfica a sangre, que es zona dura, así
    // que llevar el máximo más abajo sería sembrar donde no se ve.
    var ACTOS = [
      //  u     densidad  alcance  follaje  flores  focal
      // CIUDAD no es vacío: es contenido. Tiene que haber un hilo de verde
      // asomando desde el borde, o no hay nada de donde crezca el resto.
      // El primer cuarto es además casi todo hero (zona dura), así que quedan
      // pocas bandas sembrables y el sorteo puede dejarlo en cero si el valor
      // es demasiado bajo.
      [ 0.00,   0.32,     0.36,    0.32,    0.00,   0.00 ],  // CIUDAD  · un hilo
      [ 0.28,   0.40,     0.50,    0.54,    0.05,   0.00 ],  // CALMA   · hojas, brotes
      [ 0.56,   0.56,     0.66,    0.78,    0.45,   0.10 ],  // JARDÍN  · helechos, flores
      [ 0.78,   0.72,     0.76,    0.90,    0.85,   0.60 ],
      [ 1.00,   0.78,     0.80,    0.94,    1.10,   1.00 ]   // REFUGIO · envolvente
    ];
    function arco(u, i) {
      for (var k = 1; k < ACTOS.length; k++) {
        if (u <= ACTOS[k][0] || k === ACTOS.length - 1) {
          var a = ACTOS[k - 1], b = ACTOS[k];
          var t = clamp((u - a[0]) / (b[0] - a[0] || 1), 0, 1);
          return a[i] + (b[i] - a[i]) * t;
        }
      }
      return ACTOS[ACTOS.length - 1][i];
    }

    function vine(y0, side, u, shy) {
      // `rich` ya no es una rampa lineal genérica: es el arco de follaje, que
      // arranca casi plano en CIUDAD y se dispara en REFUGIO.
      var rich = clamp(arco(u, FOLLAJE), 0, 1.1);
      var vFlor = arco(u, FLORES);
      var inward = side < 0 ? 1 : -1;
      var x0 = side < 0 ? -12 : W + 12;
      var down = rand() < 0.62;               // mayoría diagonal descendente
      var ang = inward * (down ? rnd(1.85, 2.45) : rnd(0.85, 1.35));
      // Alcance base 25-30% más corto que la ronda anterior: ahí estaba el
      // exceso de "rama grande" — un tallo llegaba a ocupar el 44% del ancho
      // del viewport desde un solo lado. La cobertura perdida se recupera con
      // MÁS ramas y follaje, no con tallos más largos.
      var reach = W * (MOBILE ? rnd(0.14, 0.25) : rnd(0.19, 0.35)) * arco(u, ALCANCE);
      if (shy) reach *= 0.42;                 // zona suave: se queda en el borde

      var when = reloj(y0);

      /* ── ESTRUCTURA ──
         El tallo es soporte, no protagonista: corto y fino. El peso visual se
         lo lleva lo que cuelga de él, no él mismo. */
      var stem = B.growS(P, x0, y0, ang, reach, rnd(0.45, 0.90), 16);
      P.draw(groups.tallos, B.catmull(stem), 0.62, 'stem',
             when(y0, OFF.stem, DUR.stem), E.inout);

      var carriers = [{ pts: stem, main: true, hot: rnd(0.35, 0.80) }];

      // Más puntos de anclaje que antes (hasta 7-8 en vez de 5-7): con el
      // tallo más corto, cada rama tiene que hacer menos trabajo de cobertura
      // por sí sola.
      var nB = Math.max(3, Math.round(3 + rich * (MOBILE ? 1.8 : 3.2)));
      for (var i = 0; i < nB; i++) {
        var ti = 0.16 + (0.72 / nB) * i + rnd(-0.05, 0.05);
        var bp = B.along(stem, ti);
        var bs = (i % 2) ? 1 : -1;
        var blen = reach * rnd(0.20, 0.40);
        var bpts = B.growS(P, bp.x, bp.y, bp.a + bs * rnd(0.45, 1.05), blen, rnd(0.35, 0.80), 10);
        P.draw(groups.ramas, B.catmull(bpts), 0.42, 'stem',
               when(bp.y, OFF.branch + ti * 0.10, DUR.branch), E.out);
        carriers.push({ pts: bpts, main: false, hot: rnd(0.40, 0.90) });

        // Ramificación terciaria: ahora habitual, no excepcional. Es lo que
        // convierte una rama en una mata.
        if (rand() < 0.32 + rich * 0.45) {
          var tj = rnd(0.35, 0.75), sp = B.along(bpts, tj);
          var spts = B.growS(P, sp.x, sp.y, sp.a + (rand() < 0.5 ? 1 : -1) * rnd(0.40, 0.95),
                             blen * rnd(0.35, 0.60), rnd(0.30, 0.75), 8);
          P.draw(groups.ramillas, B.catmull(spts), 0.32, 'leaf',
                 when(sp.y, OFF.twig, DUR.twig), E.out);
          carriers.push({ pts: spts, main: false, hot: rnd(0.40, 0.92) });
        }
      }

      /* ── TEXTURA ──
         Aquí vive la presencia visual de la capa: muchos elementos chicos.
         Las hojas ya no se reparten uniformemente — cada rama tiene un punto
         caliente donde se agrupan y el resto queda aireado. Un reparto regular
         se lee como patrón; uno agrupado, como planta. */
      var scale = (MOBILE ? 0.80 : 1) * (0.74 + 0.40 * rich);

      function puntoEn(c, k, n) {
        return rand() < 0.55
          ? clamp(c.hot + rnd(-0.15, 0.15), 0.08, 0.99)      // agrupado
          : clamp(0.12 + (0.84 / n) * k + rnd(-0.05, 0.05), 0.05, 0.99);
      }

      carriers.forEach(function (c, ci) {
        var n = Math.max(3, Math.round((c.main ? 3 : 5) * (0.66 + 0.66 * rich) * (MOBILE ? 0.62 : 1)));
        for (var k = 0; k < n; k++) {
          var t = puntoEn(c, k, n);
          var pt = B.along(c.pts, t);
          var sd = ((k + ci) % 2) ? 1 : -1;
          var len = rnd(12, 25) * scale;
          B.leaf(P, groups.hojas, pt.x, pt.y, pt.a + sd * rnd(0.55, 1.20),
                 len, len * rnd(0.24, 0.34),
                 when(pt.y, OFF.leaf + t * 0.10, DUR.leaf));
        }
      });

      // Helechos: más frecuentes y bastante más chicos. Algunos cuelgan.
      for (var nf = 0, maxf = MOBILE ? 2 : 3; nf < maxf; nf++) {
        if (rand() > 0.72 * rich) continue;
        var cf = carriers[1 + Math.floor(rand() * (carriers.length - 1))] || carriers[0];
        var tf = rnd(0.30, 0.85), pf = B.along(cf.pts, tf);
        var af = rand() < 0.4 ? (Math.PI + rnd(-0.45, 0.45))
                              : pf.a + (rand() < 0.5 ? 1 : -1) * rnd(0.40, 0.90);
        B.fern(P, groups.helechos, pf.x, pf.y, af, rnd(19, 37) * scale,
               when(pf.y, OFF.fern + nf * 0.04, DUR.fern));
      }

      // Brotes: pequeños y abundantes, rematando puntas de rama.
      for (var nb = 0, maxb = 3 + Math.round(rich * 5); nb < maxb; nb++) {
        if (rand() > 0.46 + 0.62 * rich) continue;
        var cb = carriers[Math.floor(rand() * carriers.length)];
        var pb = B.along(cb.pts, rnd(0.60, 0.99));
        B.bud(P, groups.capullos, pb.x, pb.y, pb.a + rnd(-0.6, 0.6), rnd(5, 9) * scale,
              when(pb.y, OFF.bud + nb * 0.04, DUR.bud));
      }

      /* ── FLORES ──
         Tres escalas en vez de una. La presencia floral sale de la CANTIDAD
         de flores chicas, no del tamaño de unas pocas: así se nota que hay
         flores sin que ninguna pese demasiado. */

      // a) Florecillas sueltas: racimos diminutos de 4-5 pétalos. Son las más
      //    numerosas y aparecen desde muy arriba de la página.
      for (var nm = 0, maxm = 3 + Math.round(rich * 5); nm < maxm; nm++) {
        if (rand() > 0.80 * vFlor) continue;
        var cm = carriers[Math.floor(rand() * carriers.length)];
        var pm = B.along(cm.pts, rnd(0.45, 1.0));
        (function (pm, nm) {
          conDetalle(0.32, function () {
            B.hydrangea(P, groups.hortensias, pm.x, pm.y, rnd(6, 10) * scale,
                        when(pm.y, OFF.hyd + nm * 0.04, DUR.hyd));
          });
        })(pm, nm);
      }

      // b) Hortensia: el racimo reconocible. Bastante más chica que antes.
      if (rand() < 0.74 * vFlor) {
        var ch = carriers[1 + Math.floor(rand() * (carriers.length - 1))] || carriers[0];
        var ph = B.along(ch.pts, rnd(0.78, 1.0));
        B.hydrangea(P, groups.hortensias, ph.x, ph.y, rnd(10, 15) * scale,
                    when(ph.y, OFF.hyd, DUR.hyd));
      }

      // c) Mini rosa: frecuente y pequeña, con menos anillos de pétalos para
      //    que a ese tamaño siga leyéndose como rosa.
      if (rand() < 0.62 * vFlor) {
        var cr = carriers[1 + Math.floor(rand() * (carriers.length - 1))] || carriers[0];
        var pr = B.along(cr.pts, rnd(0.82, 1.0));
        conDetalle(0.35, function () {
          B.rose(P, groups.rosas, pr.x, pr.y, rnd(8, 12) * scale,
                 when(pr.y, OFF.rose, DUR.rose));
        });
      }

      // d) Rosa protagonista: rara a propósito. Si aparecen muchas dejan de
      //    ser punto focal y se vuelven ruido.
      if (rand() < 0.22 * arco(u, FOCAL)) {
        var cR = carriers[1 + Math.floor(rand() * (carriers.length - 1))] || carriers[0];
        var pR = B.along(cR.pts, rnd(0.85, 1.0));
        B.rose(P, groups.rosas, pR.x, pR.y, rnd(15, 21) * scale,
               when(pR.y, OFF.rose + 0.04, DUR.rose));
      }

      // Zarcillos: baratos en trazos, carísimos en sensación de vida.
      var nT = Math.max(2, Math.round(3 + rich * 4));
      for (var z = 0; z < nT; z++) {
        var cz = carriers[Math.floor(rand() * carriers.length)];
        var tz = rnd(0.55, 1.0), pz = B.along(cz.pts, tz);
        B.tendril(P, groups.zarcillos, pz.x, pz.y, pz.a + rnd(-1.2, 1.2),
                  rnd(4, 9) * scale, when(pz.y, OFF.ten, DUR.ten));
      }
    }

    /* ── Acentos anclados al contenido ──────────────────────────────────────
       Esto es lo que separa "una capa decorativa detrás" de "el jardín está
       entrando en la interfaz". Las enredaderas de los costados se siembran a
       ciegas, solo por altura. Estos acentos, en cambio, CONSULTAN EL DOM:
       nacen pegados a un elemento real —un rótulo, el nombre de una
       habitación, un botón— y crecen hacia el margen, nunca hacia adentro del
       texto. Son pequeños y no salen en todos los elementos: si aparecieran
       siempre y en todos, volverían a leerse como un patrón. */
    function acento(el) {
      var c = caja(el);
      if (!c.w || !c.h) return;
      var mid = c.x + c.w / 2;
      // Nace por el lado que da al margen de página y crece hacia afuera.
      var side = mid < W / 2 ? -1 : 1;
      var x = side < 0 ? c.x - rnd(4, 16) : c.x + c.w + rnd(4, 16);
      var y = c.y + c.h * rnd(0.10, 0.90);
      if (y >= Hdoc - 30 || inside(Z.hard, y)) return;

      var when = reloj(y);
      var sube = rand() < 0.5;
      var ang = (sube ? 0 : Math.PI) + side * rnd(0.30, 0.80);
      var len = rnd(30, 62) * (MOBILE ? 0.72 : 1);
      var tallo = B.growS(P, x, y, ang, len, rnd(0.40, 0.85), 9);
      P.draw(groups.acentos, B.catmull(tallo), 0.48, 'stem',
             when(y, OFF.branch, DUR.branch), E.out);

      var nh = MOBILE ? 2 : 3;
      for (var i = 0; i < nh; i++) {
        var t = 0.28 + (0.62 / nh) * i + rnd(-0.06, 0.06);
        var pt = B.along(tallo, t);
        var sd = (i % 2) ? 1 : -1;
        var lh = rnd(11, 21) * (MOBILE ? 0.78 : 1);
        B.leaf(P, groups.acentos, pt.x, pt.y, pt.a + sd * rnd(0.60, 1.15),
               lh, lh * rnd(0.26, 0.36), when(pt.y, OFF.leaf + t * 0.08, DUR.leaf));
      }

      // El zarcillo del final es lo que hace que el acento parezca agarrarse
      // al elemento en vez de estar simplemente apoyado al lado.
      var pz = B.along(tallo, rnd(0.80, 1.0));
      B.tendril(P, groups.acentos, pz.x, pz.y, pz.a + rnd(-1.1, 1.1),
                rnd(4, 8), when(pz.y, OFF.ten, DUR.ten));

      if (rand() < 0.42) {
        var pf = B.along(tallo, rnd(0.55, 0.95));
        conDetalle(0.32, function () {
          B.hydrangea(P, groups.acentos, pf.x, pf.y, rnd(6, 10),
                      when(pf.y, OFF.hyd, DUR.hyd));
        });
      }
    }

    /* ── Siembra por bandas ───────────────────────────────────────────────── */
    var Z      = zones(page);
    // Bandas más juntas que antes: más puntos de origen, cada uno con una
    // planta más chica. La cobertura sale de la cantidad, no del tamaño.
    var bandH  = MOBILE ? 146 : 100;
    var hero   = page.querySelector('.hero');
    var yStart = hero ? hero.getBoundingClientRect().bottom + window.scrollY + 40 : 120;
    var yEnd   = Hdoc - 40;
    var side   = rand() < 0.5 ? -1 : 1;

    // Densidad variable a lo largo de la página: dos ondas lentas de distinta
    // frecuencia y fase aleatoria. Produce tramos densos, tramos medios y
    // tramos que respiran, sin que se lea como un patrón regular. Un reparto
    // uniforme delata que la vegetación está generada.
    var fase1 = rnd(0, 6.28), fase2 = rnd(0, 6.28);
    // Dos componentes: una TENDENCIA que crece con la profundidad (el arco
    // narrativo) y una ONDULACIÓN local que mantiene tramos densos y tramos
    // de respiro. Antes solo existía la ondulación, alrededor de un valor
    // constante: variaba, pero no evolucionaba.
    function densidad(u) {
      var tendencia = arco(u, DENS);
      var onda = 0.26 * Math.sin(u * Math.PI * 3.1 + fase1)
               + 0.14 * Math.sin(u * Math.PI * 8.3 + fase2);
      return clamp(tendencia + onda, 0.03, 1);
    }

    for (var y = yStart; y < yEnd; y += bandH) {
      var u = clamp(y / Hdoc, 0, 1);
      var d = densidad(u);
      // Alternancia con excepciones: dos seguidas del mismo lado de vez en
      // cuando. Es lo que rompe la simetría de espejo.
      side = (rand() < 0.78) ? -side : side;

      // Tramos de respiro: algunas bandas se saltan enteras.
      if (rand() > d + 0.20) continue;

      // En las zonas densas nacen grupos: dos o tres plantas juntas, y las
      // extra salen del lado contrario para que el racimo abrace el contenido
      // en vez de apilarse en un solo costado.
      var n = 1 + (d > 0.60 && rand() < d - 0.32 ? 1 : 0)
                + (!MOBILE && d > 0.84 && rand() < 0.38 ? 1 : 0);
      for (var k = 0; k < n; k++) {
        var yy = y + rnd(0.05, 0.85) * bandH;
        if (yy >= yEnd || inside(Z.hard, yy)) continue;
        vine(yy, k % 2 ? -side : side, clamp(yy / Hdoc, 0, 1), inside(Z.soft, yy));
      }
    }

    // Elementos del contenido que reciben acento. No todos lo reciben: la
    // probabilidad evita que se lea como un adorno aplicado por regla.
    //
    // El sorteo usa un generador PROPIO, no el de las enredaderas. Compartirlo
    // era un error: cualquier cambio en la siembra de los costados (más
    // bandas, otra altura de página) desplazaba la secuencia y alteraba en
    // silencio cuántos acentos salían. Con un flujo aparte, la decoración
    // anclada al contenido es estable frente a cambios de layout.
    var randA = B.makeRng(seed ^ 0x5BF03635);
    [['.statement .eye', 0.95], ['.statement h2', 0.75], ['.rooms-count', 0.85],
     ['.room-card-name', 0.55], ['.rc-book', 0.45], ['.rc-more', 0.45],
     ['.loc-head .eye', 0.95], ['.loc-sub', 0.7], ['.loc-badge', 0.85],
     ['.rv-info h2', 0.85], ['.rv-submit', 0.6], ['.ft-logo', 0.95],
     ['.welcome .wc-script', 0.95]
    ].forEach(function (cfg) {
      page.querySelectorAll(cfg[0]).forEach(function (el) {
        if (randA() < cfg[1]) acento(el);
      });
    });

    svg.appendChild(frag);
    B.measure(items);
    objetivo = mostrado = REDUCED ? 1 : progress();
    B.render(items, mostrado, false);
  }

  /* ── Motor de scroll ────────────────────────────────────────────────────── */

  function progress() {
    // Se cierra en 1 un poco antes del tope real: las últimas plantas deben
    // quedar terminadas al llegar al pie, no justo en el último píxel.
    return B.clamp(window.scrollY / (scrollMax * 0.96), 0, 1);
  }

  // La rueda del mouse entrega el scroll a saltos; el táctil, con inercia
  // propia. Para que el dibujo se sienta igual de continuo en los dos, el
  // progreso del scroll NO alimenta directamente a los trazos: alimenta un
  // objetivo, y el dibujo persigue ese objetivo un poco en cada frame.
  //
  //   scroll crudo → objetivo → mostrado (interpolado) → trazos
  //
  // SUAVIZADO es la fracción de la distancia restante que se recorre en un
  // frame de 60Hz. 0.22 ≈ 95% del camino en unos 200ms: continuo, sin lag
  // perceptible. Subirlo lo hace más directo; bajarlo, más flotante.
  var SUAVIZADO = 0.22;

  var objetivo = 0, mostrado = 0, corriendo = false, ultimo = 0;

  function frame(ahora) {
    // El paso se normaliza por tiempo real: en una pantalla de 120Hz el
    // suavizado debe tardar lo mismo que en una de 60Hz, no la mitad.
    var dt = ultimo ? Math.min(64, ahora - ultimo) : 16.7;
    ultimo = ahora;
    mostrado += (objetivo - mostrado) * (1 - Math.pow(1 - SUAVIZADO, dt / 16.7));
    if (Math.abs(objetivo - mostrado) < 0.0002) mostrado = objetivo;
    B.render(items, mostrado, PERSISTENTE);
    if (mostrado !== objetivo) requestAnimationFrame(frame);
    else { corriendo = false; ultimo = 0; }
  }
  function kick() {
    if (REDUCED) return;
    objetivo = progress();
    if (!corriendo) { corriendo = true; ultimo = 0; requestAnimationFrame(frame); }
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
