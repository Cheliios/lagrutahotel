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
    vines.js               ← capa vegetal perimetral (oliva-dorado, toda la página)
  vendor/
    leaflet/               ← Leaflet 1.9.4 (BSD-2), vendorizado a propósito
  img/
    hero/                  ← cabeceras a sangre de cada página
    rooms/                 ← una foto por tipo de habitación publicado
    hotel/                 ← fachada, cafetería, jardín, panorámica
    pendientes/            ← fotos que existen pero aún no se publican
docs/
  ARQUITECTURA.md          ← este archivo
  referencias/             ← prototipos y demos que NO se publican, entre ellos
                              botanic.js: la sección "El jardín" que sí llegó a
                              estar en vivo (ver más abajo)
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
<script src="botanic-lib.js"  defer>      ← debe ir antes que su consumidor
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

## Ritmo compositivo

Las secciones no se componen todas igual a propósito. El ritmo de Inicio es:

| Sección | Composición |
|---|---|
| hero | centrada (fotografía a sangre) |
| welcome | collage asimétrico |
| statement | desplazada a la izquierda, aire generoso a la derecha |
| habitaciones | rejilla escalonada, texto de tarjeta alineado a la izquierda |
| banda | invertida: texto a la derecha, mitad izquierda de la foto despejada |
| footer | cierre |

Todas las secciones desplazadas se apoyan en la **misma retícula de 12
columnas de 1240px**. La asimetría sale de qué columnas ocupa cada bloque, no
de márgenes inventados sección por sección: eso es lo que separa una
composición editorial de un collage. En móvil el desfase y los
desplazamientos se desactivan — en una sola columna no aportan ritmo, solo
desalinean.

El aire asimétrico no es solo estética: es por donde entra la vegetación. Una
sección con el texto a la izquierda deja el costado derecho libre para que las
ramas lo ocupen.

## La capa botánica (`vines.js`)

Enredaderas en línea fina que nacen desde los bordes izquierdo y derecho y
crecen hacia el interior a medida que se hace scroll. El crecimiento es
**reversible**: al subir, la vegetación se repliega por donde vino, como si
rebobinara. Eso ata la animación al gesto del usuario y hace evidente que
responde al scroll.

Tiene un coste: bajando cuesta lo mismo que la versión persistente, pero
subiendo cuesta bastante más, porque antes no hacía nada y ahora tiene que
reescribir los trazos para desdibujarlos. Si algún día hay que recuperar ese
margen en gama muy baja, `PERSISTENTE = true` en `vines.js` vuelve al
comportamiento acumulativo.

### El scroll no alimenta directamente al dibujo

La rueda del mouse entrega el scroll a saltos; el táctil, con inercia propia.
Si el dibujo se ata al scroll crudo, en escritorio se siente a tirones y en
móvil bien — el mismo código con dos sensaciones distintas. Por eso hay una
capa intermedia:

```
scroll crudo → objetivo → mostrado (interpolado) → trazos
```

Cada frame, `mostrado` recorre una fracción de la distancia que le falta hasta
`objetivo` (`SUAVIZADO`, 0.22). El paso se normaliza por tiempo real, así que
en una pantalla de 120Hz tarda lo mismo que en una de 60Hz. Medido: tras un
salto de rueda de 120px, el dibujo cubre el 70% del camino en ~6 frames y
termina de asentarse en ~300ms.

### El arco narrativo: CIUDAD → CALMA → JARDÍN → REFUGIO

La página no se siente igual arriba que abajo, y es deliberado. Arriba se
entra a un hotel: limpio, arquitectónico, contenido. Abajo se está dentro de
su jardín.

Lo gobierna la tabla `ACTOS` en `vines.js`, con cinco parámetros por tramo
—densidad, alcance, follaje, flores y rosa focal— que se **interpolan** entre
actos en vez de saltar. Un salto en cualquiera de esos valores se vería como
una costura, y el brief pide que la evolución no se note.

| | CIUDAD | CALMA | JARDÍN | REFUGIO |
|---|---|---|---|---|
| Trazos | 148 | 440 | 3486 | 1081 |
| Flores | 0% | 3% | 13% | 25% |

Antes esto estaba mal resuelto: las compuertas por profundidad estaban todas
entre `u=0.06` y `u=0.28`, así que el vocabulario botánico completo —flores
incluidas— se desbloqueaba antes del primer tercio y luego solo se repetía.
Medido: el primer cuarto tenía un 38% de flores y el último cuarto tenía
MENOS vegetación que el central. La historia se contaba entera en el primer
tercio.

Dos cosas a tener en cuenta al leer esos números:

- REFUGIO tiene menos trazos que JARDÍN en bruto, pero su cuarto lo ocupa casi
  entero la banda fotográfica a sangre, que es zona dura. Por píxel utilizable
  es bastante más denso. Por eso el pico del arco se sitúa hacia `u≈0.75`:
  llevarlo más abajo sería sembrar donde no se ve.
- El arco REDISTRIBUYE densidad, no la añade. El total de trazos se mantiene
  dentro del presupuesto de frame; lo que cambia es dónde está.

Lo que de verdad vive el usuario, midiendo trazos ya dibujados al ir bajando:
37 → 382 → 2279 → 4682.

### Dos subsistemas, no uno

La capa tiene dos orígenes distintos, y la diferencia es conceptual, no técnica:

1. **Enredaderas de borde** (`vine()`). Nacen en los laterales y se siembran a
   ciegas, solo por altura del documento. Son el fondo: dan cobertura y
   densidad.
2. **Acentos anclados** (`acento()`, grupo `data-part="acentos"`). Estos
   **consultan el DOM**: nacen pegados a un elemento real del contenido —un
   rótulo, el nombre de una habitación, un botón— y crecen hacia el margen,
   nunca hacia adentro del texto.

El segundo subsistema es el que hace que la vegetación se lea como parte de la
interfaz y no como un fondo bonito detrás. Un zarcillo que se enrosca junto a
un botón "Reservar" no es decoración: es el jardín entrando en la página.

No todos los elementos reciben acento — la lista de anclas lleva una
probabilidad por selector. Si apareciera siempre y en todos, volvería a leerse
como un adorno aplicado por regla.

Los acentos sortean con un generador aleatorio **propio**, no con el de las
enredaderas. Compartirlo fue un error real: al cambiar el layout cambió la
altura del documento, cambió el número de bandas sembradas, y eso desplazó la
secuencia del generador — los acentos cayeron de 123 a 55 trazos sin que nadie
hubiera tocado su código. Con un flujo aparte, la decoración anclada al
contenido es estable frente a cambios en la siembra de los costados.

Detalle que importa: `acento()` mide con la cadena de `offsetParent`, no con
`getBoundingClientRect()`. Los elementos con revelado al hacer scroll
(`.rv-el`) llevan un `transform: translateY(30px)` temporal que falsearía la
posición por 30px justo en los que aún no se han revelado.

### Fino y denso, no grande y pesado

La presencia de la capa sale de la CANTIDAD de elementos pequeños, no del
tamaño de unos pocos grandes. La estructura (tallos y ramas) es apenas un 5%
de los trazos: sostiene, no protagoniza. El resto es textura — hojas, brotes,
helechos y flores chicas — con las rosas grandes reservadas como punto focal
poco frecuente.

Dos detalles que hacen que eso sea asequible:

- Las nervaduras de las hojas escalan con el TAMAÑO de la hoja, no solo con el
  nivel de detalle. En una hoja de 16px son sub-píxel: no se ven y cada una
  cuesta un path que hay que redibujar en cada frame. Quitarlas bajó de 6357 a
  4236 trazos sin que se note en pantalla.
- La siembra NO es uniforme. Dos ondas lentas de distinta frecuencia y fase
  aleatoria modulan la densidad a lo largo de la página: hay tramos densos,
  tramos medios y tramos que respiran. Un reparto regular delata que la
  vegetación está generada.

Dibuja con `stroke-dasharray` + `stroke-dashoffset`. `getTotalLength()` se mide
**una sola vez** por trazo al construir; durante el scroll solo se escribe el
`strokeDashoffset` de los trazos que realmente cambiaron — y antes de eso, un
atajo descarta sin calcular nada los trazos que ya terminaron de dibujarse o
los que el scroll todavía no alcanza, que en cualquier frame dado son la
inmensa mayoría (ver `render()` en `botanic-lib.js`).

Las especies (hojas, helechos, hortensias, rosas, capullos, zarcillos) viven en
`botanic-lib.js`. Existió una segunda capa, `botanic.js` — la sección "El
jardín", una ilustración de grafito que se miraba de frente en su propia
sección de 380vh — pero quedó redundante en cuanto la capa perimetral cubría
toda la página, así que se sacó del sitio. El código no se perdió: sigue
funcionando tal cual en **`docs/referencias/jardin-botanico.html`**, cargando
el mismo `botanic-lib.js` (no una copia congelada), por si algún día vuelve a
hacer falta.

### Perillas de ajuste

| Qué | Dónde |
|---|---|
| Presencia de la capa | `INTENSIDAD` en `vines.js` — multiplica TONE; vale 1, así que los números de `TONE` son las opacidades finales |
| Suavidad del scroll | `SUAVIZADO` en `vines.js` (0.22; subirlo = más directo, bajarlo = más flotante) |
| Reversible o acumulativa | `PERSISTENTE` en `vines.js` (false = se repliega al subir) |
| Densidad de la capa | `bandH` (separación entre plantas) y `P.detail` en `vines.js` |
| Variación de densidad | `densidad(u)` en `vines.js` |
| Dónde nacen los acentos | la lista de anclas al final de `build()` en `vines.js` (selector + probabilidad) |
| Ritmo de aparición | tablas `OFF` y `DUR` en `vines.js` |

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
