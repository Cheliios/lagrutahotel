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

   Se inicializa BAJO DEMANDA desde app.js (`window.initMenuMap`, ver
   ensureMenuMap()) y no al cargar: un mapa creado dentro de un contenedor
   oculto nace con tamaño 0 y se ve roto. Se dispara la primera vez que se
   abre el menú.

   La página de Ubicación (que tenía su propio mapa a pantalla completa,
   `window.initLocMap`/`#loc-map-canvas`) se retiró del sitio por pedido
   de la tesista — ver ARQUITECTURA.md. Solo queda la miniatura del menú.
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

  // Miniatura de ubicación dentro del menú (ver .menu-map en site.css).
  // Interactiva (arrastre + zoom con botones), salvo la rueda del mouse,
  // que en NINGÚN mapa del sitio hace zoom — un overlay a pantalla
  // completa como el menú lo necesita todavía más que el resto: no
  // secuestrar el scroll de la página.
  window.initMenuMap = function () {
    var host = document.getElementById('menu-map-canvas');
    if (window.menuMap || !window.L || !host) return;

    var map = L.map(host, {
      center: [LAT, LNG],
      zoom: 14,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: true,
      tap: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: false,
      attributionControl: true
    });

    L.tileLayer(TILES.base, { maxZoom: TILES.maxZoom, attribution: TILES.attribution }).addTo(map);
    L.tileLayer(TILES.labels, { maxZoom: TILES.maxZoom }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.marker([LAT, LNG], {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({ className: 'loc-marker', html: '<div class="loc-dot"></div>', iconSize: [14, 14], iconAnchor: [7, 7] })
    }).addTo(map);

    window.menuMap = map;

    // El menú nace oculto (clip-path en 0%, pointer-events:none) hasta que
    // se abre: Leaflet mide un contenedor con tamaño real recién en el
    // frame siguiente a hacerse visible.
    requestAnimationFrame(function () { map.invalidateSize(); });
  };

  // Mapa grande de Inicio (ver .home-map en site.css): mismo centro y mismo
  // zoom que la miniatura del menú, a propósito — es el mismo lugar visto
  // dos veces, no dos encuadres distintos que confundan a quien ya vio uno.
  // Igual que el del menú, la rueda del mouse no hace zoom (scroll de la
  // página primero, ver initMenuMap más arriba).
  window.initHomeMap = function () {
    var host = document.getElementById('home-map-canvas');
    if (window.homeMap || !window.L || !host) return;

    var map = L.map(host, {
      center: [LAT, LNG],
      zoom: 14,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: true,
      tap: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: false,
      attributionControl: true
    });

    L.tileLayer(TILES.base, { maxZoom: TILES.maxZoom, attribution: TILES.attribution }).addTo(map);
    L.tileLayer(TILES.labels, { maxZoom: TILES.maxZoom }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.marker([LAT, LNG], {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({ className: 'loc-marker', html: '<div class="loc-dot"></div>', iconSize: [14, 14], iconAnchor: [7, 7] })
    }).addTo(map);

    window.homeMap = map;
    requestAnimationFrame(function () { map.invalidateSize(); });
  };

  var t;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(function () {
      if (window.menuMap) window.menuMap.invalidateSize();
      if (window.homeMap) window.homeMap.invalidateSize();
    }, 300);
  }, { passive: true });
})();
