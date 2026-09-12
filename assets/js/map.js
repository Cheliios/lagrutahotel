/* =============================================================================
   map.js — Mapa de ubicación
   Hotel La Gruta · Arequipa

   Por qué Leaflet y no Mapbox
   ---------------------------
   Mapbox exige un token en el frontend. Aunque un token público (`pk.`) esté
   pensado para ir ahí, el escáner de secretos de GitHub lo bloquea en cada
   push, y además ata el sitio a una cuenta y a una cuota. Leaflet con tiles
   públicas no necesita token, ni cuenta, ni facturación, y pesa unas 20 veces
   menos que Mapbox GL.

   La librería va vendorizada en assets/vendor/leaflet/ (BSD-2) en vez de
   cargarse de un CDN: el sitio tiene que poder subirse tal cual a cualquier
   hosting sin depender de que un tercero siga sirviendo el archivo.

   Se inicializa BAJO DEMANDA desde app.js (`window.initLocMap`) y no al cargar:
   un mapa creado dentro de un contenedor con display:none nace con tamaño 0 y
   se ve roto. Al entrar a la página de Ubicación ya tiene medidas reales.
   ============================================================================= */
(function () {
  'use strict';

  var LAT = -16.387764, LNG = -71.530067;

  // Proveedor de tiles en un solo sitio: cambiarlo es tocar este objeto y
  // nada más.
  //
  // Se usó CARTO (basemaps.cartocdn.com) hasta que dejó de servir tiles
  // anónimas y empezó a pedir cuenta + API key — exactamente lo que se quería
  // evitar al dejar Mapbox. Esri World Light Gray Canvas es de uso libre sin
  // cuenta desde hace más de una década (es el mapa "gris" que aparece en
  // incontables ejemplos de Leaflet); si algún día también lo cierran, la
  // alternativa sin key más robusta es el servidor oficial de OpenStreetMap
  // (tile.openstreetmap.org), con un estilo más colorido y su propia
  // política de uso — no pensada para tráfico alto sin tile server propio.
  //
  // OJO con el orden de {z}/{y}/{x}: Esri usa el esquema ArcGIS REST
  // (nivel/fila/columna), NO el {z}/{x}/{y} habitual de XYZ.
  var TILES = {
    base: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    // Capa de calles y nombres, semitransparente, por encima del gris base.
    labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 16,
    attribution: 'Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a> &middot; ' +
                 'Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  };

  window.initLocMap = function () {
    var host = document.getElementById('loc-map-canvas');
    if (window.locMap || !window.L || !host) return;

    var map = L.map(host, {
      center: [LAT, LNG],
      // 15, no 16: el gris de Esri llega hasta z16 (ver TILES.maxZoom), así
      // que si se arranca ya en el tope el botón "+" nace inservible.
      zoom: 15,
      zoomControl: false,
      // La rueda NUNCA hace zoom: en una landing, un mapa que secuestra el
      // scroll de la página es un fallo de usabilidad, no una función.
      scrollWheelZoom: false,
      // En táctil el arrastre queda desactivado por el mismo motivo: un
      // deslizamiento vertical sobre el mapa debe seguir moviendo la página.
      // Para acercar están los botones, y para navegar de verdad, el enlace
      // a Google Maps que hay debajo.
      dragging: !L.Browser.mobile,
      tap: false,
      attributionControl: true
    });

    // Dos capas: el canvas gris abajo, los nombres de calle encima. El
    // esquema de tiles de Esri no soporta el {r} de retina de los CDN
    // habituales, así que va sin detectRetina.
    L.tileLayer(TILES.base, { maxZoom: TILES.maxZoom, attribution: TILES.attribution }).addTo(map);
    L.tileLayer(TILES.labels, { maxZoom: TILES.maxZoom }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Marcador propio: se reutiliza el mismo markup y el mismo CSS que ya tenía
    // el sitio. `iconAnchor` en Y negativo deja el punto justo bajo la
    // coordenada, como el `anchor: top` que usábamos antes.
    L.marker([LAT, LNG], {
      interactive: false,                 // decorativo: no intercepta arrastres
      keyboard: false,
      icon: L.divIcon({
        className: 'loc-marker',
        html: '<div class="loc-dot"></div><div class="loc-line"></div>' +
              '<div class="loc-tag">Hotel La Gruta</div>',
        iconSize: [180, 96],
        iconAnchor: [90, -6]
      })
    }).addTo(map);

    window.locMap = map;

    // El contenedor acaba de pasar de display:none a visible: Leaflet midió
    // antes de que tuviera tamaño. Se remide en el siguiente frame.
    requestAnimationFrame(function () { map.invalidateSize(); });
  };

  var t;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(function () { if (window.locMap) window.locMap.invalidateSize(); }, 300);
  }, { passive: true });
})();
