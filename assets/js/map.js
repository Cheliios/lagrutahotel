/* =============================================================================
   map.js — Mapa de ubicación (Mapbox GL)
   Se inicializa bajo demanda desde app.js (`window.initLocMap`) y no al cargar:
   un mapa creado dentro de un contenedor con display:none nace con tamaño 0 y
   se ve roto. Al entrar a la página de Ubicación ya tiene medidas reales.
   ============================================================================= */
const HOTEL_COORDS = [-71.530067, -16.387764]; // [lng, lat]
window.initLocMap = function(){
  if (window.locMap || !window.mapboxgl || !document.getElementById('loc-mapbox')) return;
  mapboxgl.accessToken = 'REEMPLAZAR_CON_TOKEN_PUBLICO_MAPBOX'; // pk.xxx — ver README para instrucciones
  const map = new mapboxgl.Map({
    container: 'loc-mapbox',
    style: 'mapbox://styles/mapbox/light-v11',
    center: HOTEL_COORDS,
    zoom: 15.5,
    cooperativeGestures: true,
  });
  map.dragRotate.disable();
  map.touchZoomRotate.disableRotation();
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

  const el = document.createElement('div');
  el.className = 'loc-marker';
  el.innerHTML = '<div class="loc-dot"></div><div class="loc-line"></div><div class="loc-tag">Hotel La Gruta</div>';
  new mapboxgl.Marker({ element: el, anchor: 'top', offset: [0, 6] }).setLngLat(HOTEL_COORDS).addTo(map);

  window.locMap = map;
};
let locMapResizeT;
window.addEventListener('resize', () => { clearTimeout(locMapResizeT); locMapResizeT = setTimeout(() => window.locMap?.resize(), 300); });
