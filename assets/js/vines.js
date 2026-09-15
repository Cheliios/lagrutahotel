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
   3. El crecimiento es REVERSIBLE, y es el comportamiento buscado: bajando,
      el jardín se acumula —un brote que terminó se queda entero mientras los
      siguientes siguen creciendo—; subiendo, se repliega por donde vino. El
      progreso del scroll no es un disparador: es la posición en la línea de
      tiempo del jardín, y se recorre en los dos sentidos.
   4. `pointer-events: none` en la capa: jamás debe bloquear un clic.
   ============================================================================= */
(function () {
  'use strict';

  var B = window.Botanic;
  if (!B) return;

  var MOBILE = window.matchMedia('(max-width: 760px)').matches;

  // ESCALA VISUAL — presencia de la capa, no densidad.
  //
  // Multiplica el TAMAÑO de lo que ya existe, no su cantidad. Alcance:
  //   · reach (L398)     → el esqueleto entero escala con él: tallo, ramas y
  //                        ramillas conservan sus proporciones internas.
  //   · scale (L443)     → hojas, helechos, capullos, hortensias, rosas y
  //                        zarcillos de las enredaderas perimetrales.
  //   · acentos          → tallo, hojas, hortensia y zarcillo anclados al DOM.
  //
  // Por qué es seguro:
  //   · No consume números del RNG: una multiplicación no altera la secuencia
  //     aleatoria, así que la semilla produce EXACTAMENTE las mismas plantas —
  //     mismas posiciones, mismo reparto de especies, mismos trazos. Sólo son
  //     más grandes.
  //   · Los anclajes no se tocan: la raíz nace en ±12 px fuera del borde y el
  //     acento junto a su elemento; al crecer desde ahí hacia adentro, la
  //     planta permanece visualmente unida al borde.
  //   · Los grosores de trazo siguen siendo los de siempre: crecer no significa
  //     engrosar, y la ligereza de la línea se conserva.
  // Mobile lleva más aumento (el viewport es más angosto y las mismas medidas
  // absoluas leen más pequeñas); es prioridad de presencia visual.
  //
  // Desktop sube de 1.30 a 1.95 junto con el recorte de densidad de siembra
  // (ver DENSIDAD_SIEMBRA más abajo): menos plantas, pero cada una bastante
  // más grande, así el volumen visual total no baja aunque sí bajen los
  // trazos que hay que animar por frame — que es lo que causaba el lag.
  var ESCALA = MOBILE ? 1.50 : 1.95;

  // Dorado envejecido, no brillante. Todo el peso visual lo lleva la opacidad:
  // el usuario debe descubrir la vegetación, no tropezarse con ella.
  //
  // INTENSIDAD es la única perilla para subir o bajar TODA la capa de golpe.
  // Ahora vale 1: los números de TONE son las opacidades FINALES, las que se
  // ven. Antes había un multiplicador de 1.8 encima y había que hacer la
  // cuenta mentalmente para saber con qué opacidad se estaba dibujando.
  // Sube de 1 a 1.28 en escritorio y 1.45 en móvil. Es un multiplicador sobre
  // TONE, así que la jerarquía interna entre tallo, hoja, flor y microdetalle
  // se conserva intacta: sube la presencia, no cambia el reparto. Más alto en
  // móvil porque ahí la capa se lee peor —pantalla pequeña, trazo fino— y era
  // donde más se pedía notarla. No toca color ni paleta: sólo cuánto se ve.
  //
  // Ambos suben (1.28→1.50 desktop, 1.45→1.60 móvil) para que las líneas
  // resalten más en las dos plataformas, a pedido.
  var INTENSIDAD = MOBILE ? 1.60 : 1.50;

  // DENSIDAD_SIEMBRA sólo recorta CUÁNTAS plantas nacen en desktop, nunca
  // cuánto follaje/ramas/flores lleva cada una una vez que nace (eso lo
  // deciden `rich`/`arco`, intactos). Multiplica la densidad ANTES de decidir
  // si una banda se siembra y si nace una segunda planta junto a la primera.
  // Con esto el volumen total de trazos a animar por frame baja de verdad
  // (menos plantas = menos <path>), y ESCALA de arriba compensa el volumen
  // visual perdido haciendo cada planta bastante más grande. Móvil no se
  // toca: vale 1 y la fórmula queda igual que antes.
  var DENSIDAD_SIEMBRA = MOBILE ? 1 : 0.62;

  // true  = irreversible: lo dibujado se queda pase lo que pase con el scroll.
  // false = reversible: el dibujo sigue al progreso en los dos sentidos.
  //
  // Va en false, que es lo que se pedía desde el principio. Conviene fijar el
  // vocabulario porque aquí hubo una confusión real: "persistente" NO quería
  // decir "dibujado para siempre", sino que mientras se BAJA, un brote que ya
  // terminó de crecer permanece entero mientras los siguientes crecen — que es
  // justo lo que hace la ventana por planta, no esta perilla. Con esto en true
  // el jardín dejaba de responder al scroll en cuanto se subía: el recorrido
  // sólo se podía hacer una vez, en una dirección.
  //
  // Con false, el dibujo es una función del progreso mostrado, sin memoria:
  //   bajar → cada trazo avanza dentro de su ventana y se queda al 100%
  //           cuando la rebasa, mientras las ventanas siguientes se abren
  //   subir → el mismo recorrido a la inversa, trazo a trazo
  //
  // No cuesta rendimiento: la ventana activa de render() es bidireccional, así
  // que subir recorre los mismos pocos cientos de trazos que bajar.
  var PERSISTENTE = false;
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
  document.body.appendChild(layer);

  // El SVG y sus trazos son ahora los de la PÁGINA ACTIVA, no los únicos del
  // sitio: `svg` e `items` apuntan a la entrada viva y cambian al navegar.
  var svg = null;
  var items = [], W = 0, Hdoc = 0, vh = 0, scrollMax = 1, U = 0.1;

  /* ── Cache de vegetación por página ───────────────────────────────────────
     La SPA cambia de sección sin recargar, y hasta aquí cada cambio tiraba el
     jardín entero y lo generaba otra vez — incluido el jardín EXACTAMENTE
     igual al que se acababa de destruir. Se comprobó midiendo: el jardín de
     Inicio sale con el mismo hash de geometría (e49ec3b9) se llegue directo,
     desde Habitaciones o desde Experiencias.

     Eso es lo que legitima el cache: el dibujo es función pura de cuatro
     entradas, así que guardarlo no es una apuesta.

       page.id → la semilla, y con ella toda la secuencia aleatoria
       W       → el ancho gobierna el alcance de cada planta y el layout
                 entero, del que cuelgan las posiciones de los acentos
       vh      → entra en el reloj de cada planta, y por tanto en qué trazos
                 llegan a existir (P.draw descarta los que empiezan tras 1.02)
       Hdoc    → scrollMax y U, la escala temporal completa

     Las cuatro se guardan CON la entrada y se comparan al volver. Si alguna
     cambió —girar el teléfono, redimensionar la ventana, una fuente que
     mueve la altura— la entrada no sirve y se reconstruye. Es lo que evita un
     cache ciego: la clave no es la página, es la página EN ESAS condiciones.

     El tamaño está acotado por construcción: hay cinco páginas, y volver a
     una con otras medidas reemplaza su entrada en vez de añadir otra. */
  var cache = new Map();
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
    page.querySelectorAll('.hero, .band, .gastro, .loc-map').forEach(function (el) {
      var r = el.getBoundingClientRect();
      hard.push([r.top + window.scrollY - 40, r.bottom + window.scrollY + 40]);
    });
    page.querySelectorAll('.garden, footer').forEach(function (el) {
      var r = el.getBoundingClientRect();
      // El footer se suma a las zonas suaves: es texto denso a todo el ancho
      // (contacto, teléfonos, email) y la vegetación escalada lo cruzaba.
      // Suave, no duro, para que el cierre siga envolviendo — pero corta.
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

  // Engancha un SVG al layer dejándolo como único hijo. Se evita
  // `replaceChildren` a propósito: es DOM de 2020 (Safari 14+) y esta capa ya
  // depende de una compatibilidad que hubo que validar a mano (pathLength).
  // removeChild/appendChild funciona en todo lo que puede abrir este sitio.
  function montar(el) {
    if (layer.firstChild === el && layer.childNodes.length === 1) return;
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    layer.appendChild(el);
  }

  // Deja una entrada del cache como vegetación viva: la engancha al layer y
  // la devuelve a su estado inicial sin dibujar.
  //
  // El repintado NO es opcional. Los trazos guardados conservan el avance que
  // tenían al salir de la página, y al volver el scroll arranca de cero: sin
  // este reinicio el jardín aparecería ya crecido. B.measure() hace justo eso
  // —dejar cada trazo oculto y recolocar los cursores del recorrido— así que
  // la reactivación termina igual que una construcción nueva, que es la razón
  // de que reutilizar sea indistinguible de reconstruir.
  function activar(entrada) {
    svg = entrada.svg; items = entrada.items;
    layer.style.height = Hdoc + 'px';
    montar(svg);
    B.measure(items);
    objetivo = mostrado = REDUCED ? 1 : progress();
    B.render(items, mostrado, false);
  }

  function build() {
    var page = document.querySelector('.page.active');
    if (!page) return;

    // Medir con la capa colapsada para que su propia altura no infle el
    // scrollHeight del documento (si no, cada rebuild haría crecer la página).
    layer.style.height = '0px';
    W    = document.documentElement.clientWidth;
    vh   = window.innerHeight;
    Hdoc = Math.max(document.body.scrollHeight, page.scrollHeight);
    scrollMax = Math.max(1, Hdoc - vh);
    U = vh / scrollMax;

    // ¿Hay un jardín ya hecho para esta página Y para estas medidas?
    var guardado = cache.get(page.id);
    if (guardado && guardado.W === W && guardado.vh === vh && guardado.Hdoc === Hdoc) {
      activar(guardado);
      return;
    }

    // Un contenedor propio por página: al volver se reengancha el nodo
    // entero en lugar de repoblar uno compartido. Así el jardín anterior
    // sobrevive intacto, desenganchado, sin que haya que clonar ni volver a
    // medir nada.
    //
    // Antes esto era UN solo <svg> del alto del documento entero. El coste
    // medido no estaba en el bucle de JS sino en rasterizar ese SVG completo
    // (ver nota más abajo, en PASO_VISUAL): el navegador lo trata como una
    // sola superficie, así que cualquier cambio de un trazo —aunque sea uno
    // solo, aunque esté fuera de pantalla— podía forzar recálculo sobre toda
    // la pieza. Reducir plantas ya bajó ese coste una vez; para bajarlo más
    // SIN sacrificar volumen ni densidad hay que atacar el rasterizado, no
    // el contenido.
    //
    // La solución es partir el documento en BANDAS (`CHUNK_H` px cada una),
    // cada una con su propio <svg> dentro de un <div> con
    // `content-visibility: auto`. Esa propiedad le dice al navegador: si
    // esta banda no está cerca del viewport, no le hagas layout ni paint —
    // trátala como si no existiera hasta que vuelva a acercarse. El
    // contenido sigue estando ahí completo (nada se quita, nada se recorta
    // en densidad), pero sólo se paga el costo de rasterizar las 2-3 bandas
    // que sí importan en cada momento, no el documento entero.
    //
    // El viewBox de cada banda arranca en su propio offset documental
    // (`0 top W h`, no `0 0 W h`): así el <path> de cada planta conserva
    // exactamente las mismas coordenadas absolutas que ya calculaba
    // botanic-lib —cero cambios ahí— y sólo cambia EN QUÉ <svg> vive. Y cada
    // <svg> lleva `overflow: visible`: una rama puede nacer cerca del borde
    // de su banda y asomar a la vecina sin que la banda la recorte; eso
    // sólo importa cuando la banda con la rama está pintándose, así que no
    // cuesta nada en las bandas que content-visibility ya está saltándose.
    items = [];
    layer.style.height = Hdoc + 'px';

    var CHUNK_H = 900;
    var nChunks = Math.max(1, Math.ceil(Hdoc / CHUNK_H));
    var root = document.createElement('div');
    root.className = 'vines-doc';
    root.style.cssText = 'position:absolute;top:0;left:0;width:' + W + 'px;height:' + Hdoc + 'px;';

    var PARTES = ['tallos', 'ramas', 'ramillas', 'hojas', 'helechos', 'capullos',
                  'hortensias', 'rosas', 'zarcillos', 'acentos'];
    var chunkGroups = [];
    for (var ci = 0; ci < nChunks; ci++) {
      var top = ci * CHUNK_H, h = Math.min(CHUNK_H, Hdoc - top);
      var chunk = document.createElement('div');
      chunk.className = 'vines-chunk';
      chunk.style.cssText = 'position:absolute;left:0;top:' + top + 'px;width:' + W + 'px;height:' +
        h + 'px;content-visibility:auto;contain-intrinsic-size:' + W + 'px ' + h + 'px;overflow:visible;';
      var chSvg = document.createElementNS(B.NS, 'svg');
      chSvg.setAttribute('viewBox', '0 ' + top + ' ' + W + ' ' + h);
      chSvg.setAttribute('width', W);
      chSvg.setAttribute('height', h);
      chSvg.setAttribute('overflow', 'visible');
      chSvg.style.display = 'block';
      chSvg.style.overflow = 'visible';
      var cg = {};
      PARTES.forEach(function (n) {
        var g = document.createElementNS(B.NS, 'g');
        g.setAttribute('data-part', n);
        chSvg.appendChild(g);
        cg[n] = g;
      });
      chunk.appendChild(chSvg);
      root.appendChild(chunk);
      chunkGroups.push(cg);
    }
    // Banda a la que pertenece la coordenada documental `y`. `vine()` y
    // `acento()` la llaman una vez, con la y de origen de la planta, y
    // reasignan `groups` — el resto de su cuerpo sigue leyendo `groups.X`
    // exactamente igual que antes, así que esto no obliga a tocar cada
    // llamada a P.draw/B.leaf/B.fern/etc. una por una.
    function bandaDe(y) {
      return chunkGroups[Math.min(nChunks - 1, Math.max(0, Math.floor(y / CHUNK_H)))];
    }

    // Semilla derivada de la página: cada sección tiene su propio jardín, pero
    // siempre el mismo (no cambia entre visitas ni al redimensionar).
    var seed = 0x9E3779B1;
    for (var c = 0; c < page.id.length; c++) seed = (seed * 31 + page.id.charCodeAt(c)) >>> 0;
    var rand = B.makeRng(seed);

    var groups = chunkGroups[0];

    var P = {
      rand: rand,
      rnd: function (a, b) { return a + rand() * (b - a); },
      detail: MOBILE ? 0.42 : 0.62,           // capa ambiental: menos microdetalle
      // Factor de escala visual (ver ESCALA arriba). Lo consumen los umbrales
      // de botanic-lib (nervaduras de hoja, folíolos mínimos de helecho) para
      // mantener sus decisiones —y el flujo del RNG— idénticos al escalar.
      escala: ESCALA,
      // Factor de presencia de la composición en curso: lo fija vine() según
      // la clase (macro / medio / acento) y multiplica la opacidad de sus
      // trazos. Es una diferencia LEVE a propósito — jerarquía, no contraste.
      presencia: 1,
      draw: function (g, d, w, tone, sch, ease) {
        if (!d || sch.s > 1.02) return;
        var t = TONE[tone] || TONE.leaf;
        var p = document.createElementNS(B.NS, 'path');
        p.setAttribute('d', d);
        // Longitud NORMALIZADA a 1. Con este atributo el navegador escala
        // stroke-dasharray/dashoffset a 1 en lugar de a la longitud real del
        // trazo, así que ya no hace falta preguntársela con getTotalLength().
        // No cambia el dibujo ni un píxel: pathLength solo afecta al cálculo
        // de los guiones, no a la geometría, al grosor ni al color.
        //
        // Por qué importa: medido con el perfilador de CPU, getTotalLength()
        // era el 84,4% del tiempo de construcción de la capa (21.120ms de
        // 25.025ms en Inicio). El navegador tenía que integrar la longitud de
        // arco de ~9 MB de curvas, un trazo cada vez y todo síncrono.
        p.setAttribute('pathLength', '1');
        p.setAttribute('stroke', t.c);
        p.setAttribute('stroke-width', (w * 0.95).toFixed(2));
        p.setAttribute('opacity', Math.min(1, t.o * INTENSIDAD * (P.presencia || 1)).toFixed(2));
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
    // Estas ventanas están en "pantallas de scroll" (U), y la medida que las
    // fija es ésta: una muesca de rueda de ratón avanza ~0.14 U. Con las
    // duraciones anteriores (la más corta, el capullo, duraba 0.14 U) UNA
    // muesca completaba el trazo entero: por mucho que se interpolase el
    // progreso global, cada hoja nacía de golpe. Ahora la ventana más corta es
    // 0.34 U —unas 2,5 muescas— así que ningún gesto normal de scroll puede
    // terminar un trazo de una vez, y el suavizado tiene algo real que suavizar.
    //
    // Los OFF se estiraron menos que los DUR a propósito: al solaparse más, la
    // planta crece como un organismo —tallo, hoja y flor avanzando a la vez— en
    // lugar de recitar una secuencia por partes.
    // Escalonado COMPRIMIDO en su fase esquelética. El orden botánico se
    // respeta —el tallo sigue abriendo, la flor sigue cerrando— pero la
    // vegetación propiamente dicha entra mucho antes: la hoja pasa de 0.38 a
    // 0.24, un 37% más pronto, y el tallo deja de ocupar 0.58 de la línea de
    // tiempo para ocupar 0.46. Antes la planta pasaba más de un tercio de su
    // vida siendo sólo líneas, y eso se leía como "un SVG dibujándose" en vez
    // de como algo que brota.
    //
    // El suelo de las duraciones NO baja de 0.34 U. Es la regla que evita que
    // una sola muesca de rueda (~0.14 U) complete un trazo entero y devuelva
    // la sensación mecánica; se mantiene intacta.
    var OFF = { stem: 0, branch: 0.10, twig: 0.17, leaf: 0.24, fern: 0.31,
                bud: 0.41, hyd: 0.47, rose: 0.56, ten: 0.66 };
    var DUR = { stem: 0.46, branch: 0.42, twig: 0.36, leaf: 0.36, fern: 0.44,
                bud: 0.34, hyd: 0.50, rose: 0.52, ten: 0.36 };
    // Dispersión del arranque de cada trazo, en unidades U. Sube de 0.03 a
    // 0.09 para descorrelacionar los trazos hermanos: un grupo que arranca en
    // el mismo frame se lee como un parpadeo, no como crecimiento.
    var JIT = 0.09;

    // Lo que tarda una planta entera, de su primer trazo al último.
    //
    // Antes se calculaba como OFF.ten + DUR.ten dando por hecho que el zarcillo
    // era el último en terminar. No lo es: la rosa acaba más tarde
    // (0.78 + 0.54 = 1.32 frente a 0.89 + 0.38 = 1.27), y con la dispersión
    // JIT encima, aún más. SPAN quedaba corto, `reloj` no comprimía bastante y
    // las últimas flores de las plantas más bajas tenían su fin por encima de
    // 0.995: nunca llegaban a dibujarse del todo. Se detectó midiendo con
    // prefers-reduced-motion, donde TODO debe salir dibujado y salían 46
    // trazos sin terminar. Ahora se toma el máximo real de la tabla.
    var SPAN = (function () {
      var m = 0;
      for (var k in DUR) if (DUR[k] > 0) m = Math.max(m, OFF[k] + JIT + DUR[k]);
      return m * U;
    })();

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
        var d  = dur * U * sq;
        var st = s0 + (off + rnd(0, JIT)) * U * sq;
        // GARANTÍA DURA: ninguna ventana puede terminar más allá del progreso
        // máximo. No basta con dimensionar SPAN: los llamantes añaden sus
        // propios desplazamientos sobre la tabla (`OFF.rose + 0.04`,
        // `OFF.hyd + nm * 0.04`, `OFF.leaf + t * 0.10`…), así que el máximo
        // real no se puede deducir de OFF y DUR. Sin este tope, las últimas
        // hortensias del pie de página tenían su fin por encima de 1 y se
        // quedaban al 97%: flores que nunca acababan de abrirse — visible
        // sobre todo con prefers-reduced-motion, donde todo debería salir ya
        // dibujado. Se DESLIZA la ventana en lugar de comprimirla: así el
        // trazo conserva su velocidad de dibujo y sólo empieza antes.
        if (st + d > 0.995) st = 0.995 - d;
        return { s: st, e: st + d };
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
      // Banda de content-visibility a la que pertenece esta planta (ver
      // `bandaDe` más arriba). Sus ramas pueden alcanzar unos cientos de px
      // más allá de y0, pero el overflow:visible de cada banda las deja
      // pintarse igual aunque asomen a la vecina.
      groups = bandaDe(y0);
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
      var reach = W * (MOBILE ? rnd(0.14, 0.25) : rnd(0.19, 0.35)) * arco(u, ALCANCE) * ESCALA;
      // Zona suave: se queda cerca del borde. La división por ESCALA sigue
      // cancelando el escalado grande de la capa (footer y "El jardín" no
      // deben crecer al ritmo del resto, o compiten con su texto), pero el
      // factor pasó de 0.42 a 0.58: quería verse más jardín cruzando el pie
      // de página sin llegar a competir con el texto — un punto medio entre
      // "invisible" y "tan grande como el resto de la página".
      if (shy) reach *= 0.58 / ESCALA;

      /* ── JERARQUÍA DE COMPOSICIÓN ────────────────────────────────────────
         Tres pesos, no uno. Que todo creciera por igual era lo que hacía que
         la capa se leyera como textura uniforme en vez de como composición.

           MACRO   protagonista. Entra desde fuera de la página y puede quedar
                   recortada por el borde: no todas las plantas tienen que
                   verse enteras, y las que se salen del encuadre son las que
                   dan la sensación de que el jardín continúa fuera.
           MEDIO   acompaña. Tamaño y presencia de referencia.
           ACENTO  remate. Un gesto botánico, no un protagonista.

         La clase se deduce del `reach` QUE YA SE SORTEÓ arriba — ni una sola
         llamada nueva a rand(). Eso importa: cualquier consumo extra del
         generador desplazaría toda la secuencia y cambiaría la composición
         entera, que es justo lo que no se puede tocar.

         Y se aplica SÓLO a alcance y opacidad, nunca al `scale` del follaje.
         Ese alimenta P.escala, que en botanic-lib decide cuántas nervaduras y
         folíolos se dibujan: tocarlo cambiaría el número de paths. */
      var proporcion = reach / W;
      var clase = shy ? 'acento'
                : proporcion > 0.30 ? 'macro'
                : proporcion > 0.17 ? 'medio' : 'acento';
      if (clase === 'macro') {
        reach *= 1.22;          // se pasa del encuadre a propósito
        x0 += side < 0 ? -reach * 0.16 : reach * 0.16;   // nace más afuera
        P.presencia = 1.16;
      } else if (clase === 'acento') {
        P.presencia = 0.88;
      } else {
        P.presencia = 1;
      }

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
      var scale = (MOBILE ? 0.80 : 1) * (0.74 + 0.40 * rich) * ESCALA;

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
      groups = bandaDe(y);

      var when = reloj(y);
      // En zona suave el acento no toma la escala completa (misma razón que
      // el `reach` de las shy): competiría con el texto del footer. Sube de
      // 1 a 1.3 por el mismo motivo que el 0.42→0.58 de arriba — un poco más
      // de presencia sin llegar al tamaño del resto de la página. La
      // decisión de DIBUJAR no cambia — sólo las medidas —, así que el flujo
      // del RNG queda idéntico.
      var esc = inside(Z.soft, y) ? 1.3 : ESCALA;
      // El factor efectivo debe alcanzar también a los umbrales de
      // botanic-lib (nervaduras): si no, un acento de zona suave —que dibuja
      // con medidas sin escalar— usaría el umbral de hojas escaladas y
      // cambiaría su cuenta de paths y el flujo del RNG. Mismo patrón que
      // conDetalle() con el nivel de detalle.
      var prevEscala = P.escala, prevPresencia = P.presencia;
      // Los acentos anclados al contenido son, por definición, el nivel más
      // bajo de la jerarquía: rematan un titular o un botón, no compiten con
      // él. Van un punto por debajo del medio.
      P.presencia = 0.88;
      P.escala = esc;
      var sube = rand() < 0.5;
      var ang = (sube ? 0 : Math.PI) + side * rnd(0.30, 0.80);
      var len = rnd(30, 62) * (MOBILE ? 0.72 : 1) * esc;
      var tallo = B.growS(P, x, y, ang, len, rnd(0.40, 0.85), 9);
      P.draw(groups.acentos, B.catmull(tallo), 0.48, 'stem',
             when(y, OFF.branch, DUR.branch), E.out);

      var nh = MOBILE ? 2 : 3;
      for (var i = 0; i < nh; i++) {
        var t = 0.28 + (0.62 / nh) * i + rnd(-0.06, 0.06);
        var pt = B.along(tallo, t);
        var sd = (i % 2) ? 1 : -1;
        var lh = rnd(11, 21) * (MOBILE ? 0.78 : 1) * esc;
        B.leaf(P, groups.acentos, pt.x, pt.y, pt.a + sd * rnd(0.60, 1.15),
               lh, lh * rnd(0.26, 0.36), when(pt.y, OFF.leaf + t * 0.08, DUR.leaf));
      }

      // El zarcillo del final es lo que hace que el acento parezca agarrarse
      // al elemento en vez de estar simplemente apoyado al lado.
      var pz = B.along(tallo, rnd(0.80, 1.0));
      B.tendril(P, groups.acentos, pz.x, pz.y, pz.a + rnd(-1.1, 1.1),
                rnd(4, 8) * esc, when(pz.y, OFF.ten, DUR.ten));

      if (rand() < 0.42) {
        var pf = B.along(tallo, rnd(0.55, 0.95));
        conDetalle(0.32, function () {
          B.hydrangea(P, groups.acentos, pf.x, pf.y, rnd(6, 10) * esc,
                      when(pf.y, OFF.hyd, DUR.hyd));
        });
      }
      P.escala = prevEscala; P.presencia = prevPresencia;
    }

    /* ── Siembra por bandas ───────────────────────────────────────────────── */
    var Z      = zones(page);
    // Bandas más juntas que antes: más puntos de origen, cada uno con una
    // planta más chica. La cobertura sale de la cantidad, no del tamaño.
    //
    // Desktop separa más las bandas (100→160): menos puntos de origen, cada
    // uno con una planta bastante más grande (ver ESCALA). Menos <path> que
    // animar por frame es lo que resuelve el lag; el volumen visual lo repone
    // el tamaño, no la cantidad.
    var bandH  = MOBILE ? 146 : 160;
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
      // dSiembra sólo gobierna CUÁNTO nace (esta banda se salta o no, nace una
      // segunda planta o no); `u`, que es lo que define qué tan grande/frondosa
      // sale cada planta (`rich`, `arco`), sigue viajando sin tocar. Así en
      // desktop nacen menos plantas pero cada una igual de desarrollada —y más
      // grande por ESCALA— en vez de plantas igual de numerosas pero recortadas.
      var dSiembra = d * DENSIDAD_SIEMBRA;
      // Tramos de respiro: algunas bandas se saltan enteras.
      if (rand() > dSiembra + 0.20) continue;

      // En las zonas densas nacen grupos: dos plantas juntas, y la extra sale
      // del lado contrario para que el racimo abrace el contenido en vez de
      // apilarse en un solo costado.
      //
      // Antes desktop sumaba una TERCERA planta a la misma banda cuando la
      // densidad superaba 0.84 (`!MOBILE && d > 0.84 && rand() < 0.38`). Esa
      // densidad se dispara justo en el tramo final de la página (acto
      // REFUGIO), donde cae la sección de FAQ, así que en desktop ahí nacían
      // tres enredaderas en el mismo punto y se veían como un racimo
      // saturado/duplicado — algo que móvil nunca mostró porque el máximo ahí
      // siempre fue 2. Se quita el tercer sumando para igualar el tope en las
      // dos plataformas sin tocar nada del comportamiento móvil.
      var n = 1 + (dSiembra > 0.60 && rand() < dSiembra - 0.32 ? 1 : 0);
      for (var k = 0; k < n; k++) {
        var yy = y + rnd(0.05, 0.85) * bandH;
        if (yy >= yEnd || inside(Z.hard, yy)) continue;
        vine(yy, k % 2 ? -side : side, clamp(yy / Hdoc, 0, 1), inside(Z.soft, yy));
      }
    }

    // Cobertura garantizada del footer. La siembra por bandas de arriba es
    // probabilística —tramos de respiro incluidos— y con algunas semillas
    // dejaba el pie de página con apenas un brote asomando por su borde
    // superior, en vez de vegetación cruzándolo de verdad. Dos enredaderas
    // ancladas directamente a un tercio y dos tercios de su alto interior
    // aseguran presencia ahí sin depender de la suerte del sorteo, y al
    // nacer DESPUÉS de la siembra por bandas quedan pintadas por encima del
    // resto, que es justo lo que hace falta para que se lean sobre el
    // fondo oscuro del footer.
    //
    // REVERTIDO: hubo un intento de sacarlas del modo `shy` en mobile para
    // que se vieran "más frondosas". Sin `shy`, `reach` deja de recortarse
    // y estas dos plantas podían pasar de clase "acento" a "medio"/"macro"
    // —que a propósito se salen del encuadre (`reach *= 1.22`, ver más
    // arriba en `vine()`)—, así que en mobile terminaban 1) más altas que
    // el propio `footer`, estirando el documento y dejando una franja de
    // papel vacía después del fondo oscuro, y 2) cruzando por encima del
    // texto de NAVEGACIÓN/CONTACTO en vez de quedarse en las esquinas.
    // `shy` va siempre en true, mobile y desktop, como antes de ese intento.
    var footerEl = page.querySelector('footer');
    if (footerEl) {
      var fr = footerEl.getBoundingClientRect(), fTop = fr.top + window.scrollY;
      [0.32, 0.68].forEach(function (frac, i) {
        var fy = fTop + fr.height * frac;
        if (fy < yEnd) vine(fy, i % 2 ? 1 : -1, clamp(fy / Hdoc, 0, 1), true);
      });
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

    svg = root;
    montar(svg);
    cache.set(page.id, { svg: svg, items: items, W: W, vh: vh, Hdoc: Hdoc });
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
  // frame de 60Hz. 0.15 ≈ 95% del camino en ~310ms: se lee como crecimiento,
  // no como una animación que se reproduce. Subirlo lo hace más directo (y más
  // brusco); bajarlo, más flotante (y con sensación de retraso).
  var SUAVIZADO = 0.15;

  // TECHO DE RETRASO. El seguimiento exponencial tiene un efecto secundario
  // desagradable: en un recorrido largo y rápido —arrastrar la barra, un
  // flick— el dibujo se queda atrás en proporción a la velocidad y la página
  // entera se siente "retrasada". Este tope corta esa acumulación: la
  // vegetación nunca va más de RETRASO_MAX por detrás del objetivo. En
  // progreso global, 0.045 son unos 300px de scroll —un tercio de pantalla—:
  // suficiente para que el crecimiento se lea, imperceptible como lag.
  var RETRASO_MAX = 0.045;

  // TECHO DEL PASO VISUAL. El suavizado exponencial reparte bien el tiempo,
  // pero el término dt/16.7 —necesario para que dure lo mismo a 60 y a 120Hz—
  // tiene un filo: si un frame se alarga, hace que se recorra de una zancada
  // lo que debían ser varios frames, que es exactamente el salto a evitar. Y
  // los frames SÍ se alargan mientras la vegetación crece: el coste medido no
  // está en el bucle de JS sino en rasterizar el SVG (se comprobó ocultando la
  // capa: el JS corre igual y los frames bajan de ~40ms a 17ms).
  //
  // La respuesta no es recortar dt —eso frena también la cola de la curva, que
  // ya es la parte lenta, y el gesto entero se va a 1,4s—. Se limita el paso
  // en la unidad que de verdad importa: cuánto progreso puede dibujarse en UN
  // frame. 0.003 es ~1/6 de una muesca de rueda, así que ninguna muesca puede
  // resolverse en menos de media docena de frames, por lento que vaya el
  // equipo, y la cola sigue corriendo a velocidad completa.
  var PASO_VISUAL = 0.003;

  // Junto con RETRASO_MAX esto da una garantía dura y acotada: nunca más de
  // 0.003 de progreso en un frame (nada de saltos) y nunca más de 0.045 por
  // detrás (nada de lag), luego alcanzar al objetivo tras un flick cuesta como
  // máximo unos 15 frames. Las dos perillas se sostienen mutuamente.
  //
  // dt sólo se topa por sanidad, para una pestaña que vuelve de segundo plano
  // con un dt de medio segundo.
  var PASO_MAX = 50;

  var objetivo = 0, mostrado = 0, corriendo = false, ultimo = 0;

  function frame(ahora) {
    var dt = ultimo ? Math.min(PASO_MAX, ahora - ultimo) : 16.7;
    ultimo = ahora;
    var paso = (objetivo - mostrado) * (1 - Math.pow(1 - SUAVIZADO, dt / 16.7));
    if (paso >  PASO_VISUAL) paso =  PASO_VISUAL;
    if (paso < -PASO_VISUAL) paso = -PASO_VISUAL;
    mostrado += paso;
    // Simétrico: el tope de retraso vale igual bajando que subiendo. Antes
    // sólo cortaba en un sentido porque en el otro no había nada que dibujar;
    // ahora un flick hacia arriba puede descolgar el replegado igual que uno
    // hacia abajo descolgaba el crecimiento.
    if (objetivo - mostrado >  RETRASO_MAX) mostrado = objetivo - RETRASO_MAX;
    if (objetivo - mostrado < -RETRASO_MAX) mostrado = objetivo + RETRASO_MAX;
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
    var recheck = function () {
      if (Math.abs(document.body.scrollHeight - Hdoc) > 120) build();
    };
    // CAUSA REAL de la franja de papel vacío que quedaba después del
    // footer (medido con Playwright, no adivinado): el preloader escala
    // #app-shell a scale(1.03) mientras cubre la pantalla y lo asienta a
    // scale(1) recién cuando se oculta (ver #app-shell.pre-reveal en
    // site.css / ARQUITECTURA.md, sección Preloader). Chromium cuenta ese
    // 3% de más como parte del scrollable overflow del documento mientras
    // dura el pre-reveal — así que si build() corre en ese momento (el
    // evento 'load', del que depende boot(), no espera el mínimo de 1.4s
    // del preloader; puede disparar antes), Hdoc queda sobredimensionado
    // y layer.style.height se congela ahí. El documento nunca vuelve a
    // pedirle a vines.js que se remida solo.
    //
    // Se observa directamente el momento real en que #app-shell pierde
    // `pre-reveal` (MutationObserver sobre su class, no un timeout a
    // ciegas) y se re-chequea ahí — pero no en el mismo instante: sacar la
    // clase dispara la transición CSS de #app-shell (`transition: transform
    // .7s`, ver ARQUITECTURA.md), así que scale(1.03) no salta a scale(1)
    // de una, se anima. Medido: a los 50ms de sacar la clase el scrollHeight
    // seguía en 9439 de 9440 (apenas arrancó la transición); recién a los
    // ~700ms está asentado en su valor final. Revisar demasiado pronto
    // — el primer intento de este fix usaba 50ms — mide una altura casi
    // tan inflada como la vieja Hdoc, la diferencia queda por debajo del
    // umbral de 120px y el rebuild ni se dispara. 800ms cubre la
    // transición completa con margen.
    var shellEl = document.getElementById('app-shell');
    if (shellEl && shellEl.classList.contains('pre-reveal')) {
      var mo = new MutationObserver(function () {
        if (!shellEl.classList.contains('pre-reveal')) {
          mo.disconnect();
          setTimeout(recheck, 800);
        }
      });
      mo.observe(shellEl, { attributes: true, attributeFilter: ['class'] });
    }
    // Red de seguridad adicional: las tipografías web también pueden
    // mover la altura del documento después del load (el fallback ocupa
    // más líneas que la tipografía real una vez que entra).
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { setTimeout(recheck, 50); });
    } else {
      setTimeout(recheck, 1200);
    }
  }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
