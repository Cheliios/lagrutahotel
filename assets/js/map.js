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

   Se inicializa BAJO DEMANDA desde app.js (`window.initHomeMap`, disparado
   por un IntersectionObserver sobre `.home-map`) y no al cargar: un mapa
   creado dentro de un contenedor oculto/fuera de viewport nace con tamaño 0
   y se ve roto.

   La página de Ubicación (que tenía su propio mapa a pantalla completa,
   `window.initLocMap`/`#loc-map-canvas`) se retiró del sitio por pedido
   de la tesista — ver ARQUITECTURA.md. El menú también tuvo su propia
   miniatura de mapa (`window.initMenuMap`/`#menu-map-canvas`) hasta que se
   volvió redundante con el mapa de Inicio y se quitó — ver ARQUITECTURA.md.
   Ahora solo queda el mapa de Inicio.
   ============================================================================= */
(function () {
  'use strict';

  var LAT = -16.387764, LNG = -71.530067;

  // Proveedor de tiles en un solo sitio: cambiarlo es tocar este objeto y
  // nada más.
  //
  // Se usó CARTO (basemaps.cartocdn.com) hasta que dejó de servir tiles
  // anónimas y empezó a pedir cuenta + API key — exactamente lo que se quería
  // evitar al dejar Mapbox (ver arriba). Se probó también Esri World Light
  // Gray Canvas (el mapa "gris" clásico de Leaflet), pero en el mapa grande
  // de Inicio quedaba tan pálido que apenas se distinguía como mapa — casi
  // no se notaba calles ni manzanas, solo gris plano. World Street Map (del
  // mismo servidor Esri, mismo esquema sin key ni cuenta) trae calles,
  // parques y edificios en color y ya incluye sus propias etiquetas, así
  // que acá va en una sola capa (antes eran dos: base + labels transparente).
  // Si algún día también cierran el acceso anónimo, la alternativa sin key
  // más robusta es el servidor oficial de OpenStreetMap
  // (tile.openstreetmap.org), con su propia política de uso — no pensada
  // para tráfico alto sin tile server propio.
  //
  // OJO con el orden de {z}/{y}/{x}: Esri usa el esquema ArcGIS REST
  // (nivel/fila/columna), NO el {z}/{x}/{y} habitual de XYZ.
  var TILES = {
    base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a> &middot; ' +
                 'Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), ' +
                 '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, GIS User Community'
  };

  // Mapa grande de Inicio (ver .home-map en site.css). Interactivo
  // (arrastre + zoom con botones), salvo la rueda del mouse, que en NINGÚN
  // mapa del sitio hace zoom — para no secuestrar el scroll de la página.
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
      if (window.homeMap) window.homeMap.invalidateSize();
    }, 300);
  }, { passive: true });
})();
