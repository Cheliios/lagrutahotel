# Arquitectura — Hotel La Gruta

Sitio estático. Sin build, sin dependencias que instalar, sin framework. Se
abre `index.html` con cualquier servidor estático y funciona.

Esa elección no es pereza: el encargo es una landing institucional de cuatro
páginas que va a cambiar poco y que tiene que poder subirse a cualquier sitio
—GitHub Pages hoy, Plesk mañana— sin que nadie tenga que instalar Node para
tocar un texto. Un framework aquí añadiría un paso de build y un punto de fallo
a cambio de nada.

## Estructura

```
index.html                 ← markup de las 4 páginas. ÚNICO archivo en la raíz.
assets/
  css/
    site.css               ← todos los estilos
  js/
    app.js                 ← menú, navegación, revelados, formularios, marcadores
    map.js                 ← mapa de Leaflet (se inicializa bajo demanda)
    botanic-lib.js         ← biblioteca botánica: geometría y especies
    botanic.js             ← sección "El jardín" (grafito, vertical)
    vines.js               ← capa vegetal perimetral (dorada, toda la página)
  vendor/
    leaflet/               ← Leaflet 1.9.4 (BSD-2), vendorizado a propósito
  img/
    hero/                  ← cabeceras a sangre de cada página
    rooms/                 ← una foto por tipo de habitación publicado
    hotel/                 ← fachada, cafetería, jardín, panorámica
    pendientes/            ← fotos que existen pero aún no se publican
docs/
  ARQUITECTURA.md          ← este archivo
  referencias/             ← prototipos y demos que NO se publican
```

### Por qué `index.html` se queda en la raíz

Es el único archivo que no se mueve, y es deliberado. GitHub Pages, Plesk,
Netlify, Vercel y un bucket de S3 sirven todos `index.html` desde la raíz del
sitio sin configuración. Meterlo en `src/` o `public/` obligaría a configurar
cada destino y hoy no está decidido dónde se despliega. Todo lo demás sí está
separado por responsabilidad.

## Orden de carga

```html
<link  ... fonts.googleapis.com>          tipografías
<link  href="vendor/leaflet/leaflet.css"> estilos del mapa
<script src="vendor/leaflet/leaflet.js" defer>
<link  href="assets/css/site.css">        estilos propios ← SIEMPRE tras leaflet.css
<script src="botanic-lib.js"  defer>      ← debe ir antes que sus consumidores
<script src="botanic.js"      defer>
<script src="vines.js"        defer>
<script src="app.js"          defer>
<script src="map.js"          defer>
```

Todos con `defer`: se ejecutan en el orden en que aparecen, ya con el documento
parseado. Es importante y ya costó un fallo en producción: un script con `defer`
**no** está disponible para un `<script>` en línea al final del `<body>`,
porque el de la línea se ejecuta antes. Por eso ya no queda JavaScript en línea.

## Capas y orden de apilamiento

```
fondo
  ↓ vegetación perimetral   z-index: 4   (pointer-events: none)
  ↓ contenido               flujo normal
  ↓ fotos y mapa            z-index: 6
  ↓ menú                    z-index: 400
  ↓ barra de navegación     z-index: 500
  ↓ transición de página    z-index: 8000
```

Las ramas pasan por encima del texto y de las cards, pero nunca por encima de
una foto.

> **Trampa que hay que conocer.** `.rv-el` (el sistema de revelado al hacer
> scroll) usa `transform`, y un `transform` distinto de `none` crea un
> *stacking context*. Mientras lo tenga, sus hijos quedan encerrados dentro y
> **ninguna** combinación de `z-index` saca la foto de una card por encima de
> una capa externa. Por eso `.rv-el.on` usa `transform: none` y no
> `translateY(0)`: ambos "no mueven nada", pero solo `none` disuelve el
> contexto. Si alguien lo revierte, las fotos se van debajo de la vegetación.

## Las dos capas botánicas

|  | `botanic.js` — "El jardín" | `vines.js` — capa perimetral |
|---|---|---|
| Papel | Pieza editorial: se mira de frente | Ambiente: se descubre de reojo |
| Alcance | Una sección de 380vh | Toda la página |
| Color | Grafito `#252525` / `#3A3A3A` / `#606060` | Dorado envejecido `#C5A059` |
| Origen | Un tallo que sube desde abajo | Enredaderas desde los bordes |
| Reloj | Progreso dentro de su sección | Posición de cada planta en el documento |
| Al subir | Se repliega (scrub reversible) | **Se queda**: el jardín se acumula |
| Trazos | 681 escritorio / 407 móvil | 1565 escritorio / 558 móvil |

Ambas dibujan con `stroke-dasharray` + `stroke-dashoffset`. `getTotalLength()`
se mide **una sola vez** por trazo al construir; durante el scroll solo se
escribe el `strokeDashoffset` de los trazos que realmente cambiaron.

Las especies (hojas, helechos, hortensias, rosas, capullos, zarcillos) viven una
sola vez en `botanic-lib.js`. Cada capa aporta su "pintor": color, opacidad,
nivel de detalle y ventana de scroll. Un cambio en el dibujo de una rosa se
aplica a las dos capas a la vez.

### Perillas de ajuste

| Qué | Dónde |
|---|---|
| Presencia de la capa dorada | `INTENSIDAD` en `vines.js` (1 = base, 1.5 = actual) |
| Densidad de la capa dorada | `bandH` y `P.detail` en `vines.js` |
| Ritmo de la capa dorada | tablas `OFF` y `DUR` en `vines.js` |
| Ritmo del jardín | tabla `T` en `botanic.js` |
| Largo del recorrido del jardín | `.garden { height }` en `site.css` |

`OFF` fija el orden biológico —una flor nunca antes que su rama— y `DUR` cuánto
tarda cada etapa en dibujarse. Ambas se miden en "pantallas de scroll".

## El mapa

Leaflet 1.9.4 con tiles claras de Esri (World Light Gray Canvas). Dos
decisiones que conviene no revertir sin pensarlo:

- **Sin token.** Mapbox obligaba a meter una clave en el frontend; el escáner de
  secretos de GitHub la bloqueaba en cada push y ataba el sitio a una cuenta y
  una cuota. Leaflet con tiles públicas no necesita nada de eso, y pesa unas 20
  veces menos que Mapbox GL. Primero se probó con CARTO, pero en 2024 cerró el
  acceso anónimo a sus tiles y empezó a exigir cuenta + API key —el mismo
  problema que se quería evitar—, así que se pasó a Esri World Light Gray
  Canvas, de uso libre sin cuenta desde hace más de una década. Si algún día
  también deja de estar disponible, revisar primero que la URL siga
  respondiendo antes de asumir que el código está roto.
- **Vendorizado, no CDN.** La librería vive en `assets/vendor/leaflet/`. El sitio
  tiene que poder subirse tal cual a cualquier hosting sin depender de que un
  tercero siga sirviendo el archivo. `site.css` debe cargarse **después** de
  `leaflet.css`, porque sobrescribe el marcador y los controles.

La rueda del ratón nunca hace zoom y en táctil el arrastre está desactivado: un
mapa que secuestra el scroll de la página es un fallo de usabilidad, no una
función. Para acercar están los botones, y para navegar de verdad el enlace
"Cómo llegar", que abre Google Maps con la ruta ya puesta.

El proveedor de tiles está en la constante `TILES` de `map.js`. La atribución de
Esri y OpenStreetMap es obligatoria por licencia: no se quita.

La barra de navegación va blanca sobre el hero oscuro y oscura en el resto.
Ubicación no tiene hero —empieza con el mapa, que es claro—, así que `navColor()`
la fuerza a oscura cuando la página activa no trae `.hero`.

## Navegación

Es una SPA falsa: las cuatro páginas están en el HTML dentro de `div.page`, y
`goTo()` alterna cuál tiene la clase `active`.

**Limitación conocida y aún no resuelta:** no hay URLs reales. Las cuatro
páginas comparten la misma dirección, así que no se puede enlazar a
"Habitaciones" ni indexarlas por separado en Google. Para una landing de hotel,
donde el tráfico de búsqueda importa, esto es una deuda a saldar antes de dar el
sitio por definitivo. La salida natural es pasar a cuatro archivos HTML reales
—`habitaciones.html`, `ubicacion.html`, `reservas.html`— reutilizando el mismo
CSS y los mismos scripts, que ya están separados justamente para eso.

## Imágenes

Las fotos que aún no existen no rompen el diseño: `app.js` genera un marcador
SVG a partir del atributo `data-ph` de cada `<img>`. Para añadir una foto nueva
basta con dejar el archivo en su carpeta; el marcador desaparece solo.

`assets/img/pendientes/` guarda fotos reales del hotel que todavía no se
publican (habitación cuádruple, tomas alternativas). No están enlazadas desde
ninguna página.

## Accesibilidad

Ambas capas botánicas respetan `prefers-reduced-motion: reduce`: se muestran
completas y sin motor de scroll. La vegetación lleva `aria-hidden="true"` y
`pointer-events: none`.
