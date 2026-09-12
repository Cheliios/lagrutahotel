# Arquitectura — Hotel La Gruta

Sitio estático. Sin build, sin dependencias que instalar, sin framework. Se
abre `index.html` con cualquier servidor estático y funciona.

Esa elección no es pereza: el encargo es una landing institucional de cinco
páginas que va a cambiar poco y que tiene que poder subirse a cualquier sitio
—GitHub Pages hoy, Plesk mañana— sin que nadie tenga que instalar Node para
tocar un texto. Un framework aquí añadiría un paso de build y un punto de fallo
a cambio de nada.

## Estructura

```
index.html                 ← markup de las 5 páginas. ÚNICO archivo en la raíz.
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
    hotel/                 ← fachada, cafetería, jardín, panorámica, comedor, comida
    experiencias/          ← una foto por tour (aún no existe: placeholder)
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
porque el de la línea se ejecuta antes. Por eso ya no queda JavaScript en línea
— salvo una excepción puntual, el chequeo de `sessionStorage`/reduced-motion
del preloader, que por su naturaleza tiene que correr antes que cualquier
script `defer` (ver "Preloader" más abajo).

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
| el jardín | split imagen/texto, dos fotos superpuestas contra el bloque de texto |
| gastronomía | foto a sangre partida en dos, texto centrado encima (variante simétrica de banda) |
| preguntas frecuentes | acordeón nativo `<details>`, una sola columna |
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
**persistente**: una vez dibujado un trazo, se queda, aunque se suba el
scroll. El jardín se acumula en vez de rebobinar.

(El sistema soportó también un modo reversible —que se repliega al subir— en
una ronda anterior, y volvió a pedirse persistente después. `PERSISTENTE` en
`vines.js` es el interruptor entre los dos comportamientos; hoy vale `true`.
El modo reversible cuesta más al subir, porque tiene que reescribir los
trazos para desdibujarlos — con `true` esa dirección es casi gratis, ver más
abajo.)

Lo que hace que el scroll se sienta continuo en desktop **no** es el
replegado ni su ausencia: es la capa de suavizado de la siguiente sección.
Con `PERSISTENTE = true` esas dos cosas quedan desacopladas — el modo de
crecimiento no afecta a qué tan fluido se ve el dibujo mientras se hace scroll.

### El scroll no alimenta directamente al dibujo

La rueda del mouse entrega el scroll a saltos; el táctil, con inercia propia.
Si el dibujo se ata al scroll crudo, en escritorio se siente a tirones y en
móvil bien — el mismo código con dos sensaciones distintas. Por eso hay una
capa intermedia:

```
scroll crudo → objetivo → mostrado (interpolado) → trazos
```

Cada frame, `mostrado` recorre una fracción de la distancia que le falta hasta
`objetivo` (`SUAVIZADO`, 0.15). El paso se normaliza por tiempo real, así que
en una pantalla de 120Hz tarda lo mismo que en una de 60Hz.

Esa cadena existía ya y NO bastaba: seguía sintiéndose a tirones en la rueda.
Las tres causas, medidas:

1. **La ventana de cada trazo era más corta que una muesca de rueda.** Una
   muesca de 120px avanza 0.0189 de progreso; la ventana de dibujo de un
   capullo valía 0.0191. Por mucho que se interpolase el progreso GLOBAL, cada
   hoja nacía completa dentro de un solo gesto. Se estiraron las tablas `OFF` y
   `DUR`: hoy la ventana más corta es 0.34 U ≈ 2,5 muescas.
2. **Los frames se alargan justo mientras la vegetación crece** — 33-51ms
   frente a 17ms en reposo. No lo causa el bucle de JS: ocultando la capa con
   `visibility:hidden` el JS sigue corriendo igual y los frames vuelven a 17ms
   limpios. El coste es **rasterizar el SVG**, no recorrer el array.
3. **Y un frame largo se convertía en un salto largo**, porque el término
   `dt/16.7` que iguala 60 y 120Hz hace que un frame lento recorra de una
   zancada lo que debían ser varios.

Contra (3) hay dos topes que se sostienen mutuamente, y son la parte que de
verdad arregla la sensación:

| Tope | Valor | Garantiza |
|---|---|---|
| `PASO_VISUAL` | 0.003 de progreso por frame (~1/6 de muesca) | ningún frame dibuja un salto, por lento que vaya el equipo |
| `RETRASO_MAX` | 0.045 de progreso (~300px de scroll) | el dibujo nunca se descuelga del scroll: nada de sensación de lag |

Juntos acotan el peor caso: desde el retraso máximo, alcanzar al objetivo cuesta
~15 frames. Se limita el paso en progreso y NO en `dt`, porque recortar `dt`
frena también la cola de la curva —que ya es la parte lenta— y el gesto entero
se iba a 1,4s.

Medido en una máquina que rasteriza esta capa a ~25fps, tras una muesca de
rueda de 120px:

| | antes | ahora |
|---|---|---|
| paso más grande de un frame | 45% del crecimiento | **20%** |
| frames con crecimiento perceptible | 6 | **8** |
| 90% del recorrido | 328ms | 376ms |

A 60Hz reales `PASO_VISUAL` casi no entra (el paso exponencial vale 0.0028) y la
curva se reparte en ~28 frames con un 90% a los ~237ms: rápido y continuo.

**Persistencia.** Se verificó que sigue siendo acumulativa: bajando al pie,
subiendo arriba y volviendo a bajar, 0 de 16.651 trazos retroceden. Se corrigió
además un caso en que sí retrocedía — un trazo a medio dibujar que quedaba por
detrás del scroll se reiniciaba a cero (`p <= it.s` en `render`), el parpadeo
aparece → desaparece → aparece. Con `persist` ya no se rebobina nunca.

**Dos flores que no acababan de abrirse.** Buscando lo anterior salió un fallo
anterior a esta ronda: algunos trazos tenían su fin de ventana por encima del
progreso máximo y se quedaban al 97% para siempre. Dos causas, las dos
corregidas en el sitio correcto en vez de caso por caso:

* `win()` en `botanic-lib.js` devolvía sub-ventanas que se salían de su padre
  (el corazón de la florecilla más tardía de una hortensia llegaba a 1.05).
  Ahora recorta a 1: es su contrato.
* `reloj()` en `vines.js` no podía dimensionar `SPAN` correctamente, porque los
  llamantes añaden sus propios desplazamientos sobre la tabla
  (`OFF.rose + 0.04`, `OFF.hyd + nm * 0.04`…) y el máximo real no se deduce de
  `OFF` y `DUR`. Ahora ninguna ventana puede terminar más allá de 0.995: se
  desliza, no se comprime, para que el trazo conserve su velocidad.

Con `prefers-reduced-motion` —donde TODO debe salir ya dibujado— se pasó de
16.975/17.021 trazos completos a 17.021/17.021. Al llegar al pie de la página
con scroll normal, 16.651/16.651.

**Coste del recorrido.** `render()` ya no recorre los ~16.000 trazos en cada
frame: `measure()` deja el array ordenado por inicio de ventana y `render()`
mantiene dos cursores monótonos (`_h`, `_t`) que acotan el recorrido a los
trazos realmente en crecimiento. No es lo que arregla los frames largos —eso es
la rasterización— pero eran ~1 millón de iteraciones por segundo para tocar unos
cientos de trazos, y en gama media eso se paga.

**Lo que queda pendiente.** El techo de fluidez es la rasterización del SVG: es
un único elemento de la altura del documento con ~16.000 paths, así que cualquier
cambio invalida una región que contiene muchísimos trazos. Bajarlo de verdad
pide partir la capa en varios SVG por banda vertical, para que la región sucia
sea local. Es un cambio estructural de la capa, no de su comportamiento, y se
deja fuera de esta ronda a propósito.

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

Una regresión real que costó una ronda entera detectar: el arco narrativo (ver
más abajo) subía el alcance del tallo hasta ×1.10 en REFUGIO para dar
cobertura envolvente, y eso convirtió al tallo en protagonista sin querer —
medido, llegaba a 634px en un viewport de 1440 (44% del ancho, desde un solo
lado); dos plantas de costados opuestos podían comerse el centro entero. Se
bajó el techo del arco de alcance a ×0.80 y el rango base de 0.27–0.50 a
0.19–0.35 de W, con el stroke del tallo de 0.82 a 0.62 y el de las ramas de
0.56 a 0.42. La cobertura perdida se recupera con más ramas (hasta 7-8 en vez
de 5-7) y más follaje por rama, no con tallos más largos: máximo medido bajó a
335px (23% del ancho).

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
| Suavidad del scroll | `SUAVIZADO` en `vines.js` (0.15; subirlo = más directo, bajarlo = más flotante) |
| Techo de salto por frame | `PASO_VISUAL` en `vines.js` (0.003 de progreso; bajarlo = más suave y más lento) |
| Techo de retraso | `RETRASO_MAX` en `vines.js` (0.045 de progreso; bajarlo = más pegado al scroll) |
| Reversible o acumulativa | `PERSISTENTE` en `vines.js` (`true` = persiste, actual; `false` = se repliega al subir) |
| Densidad de la capa | `bandH` (separación entre plantas) y `P.detail` en `vines.js` |
| Variación de densidad | `densidad(u)` en `vines.js` |
| Dónde nacen los acentos | la lista de anclas al final de `build()` en `vines.js` (selector + probabilidad) |
| Ritmo de aparición | tablas `OFF` y `DUR` en `vines.js` |

`OFF` fija el orden biológico —una flor nunca antes que su rama— y `DUR` cuánto
tarda cada etapa en dibujarse. Ambas se miden en "pantallas de scroll" (`U`), y
la referencia para dimensionarlas es que **una muesca de rueda de ratón vale
~0.14 U**: ninguna `DUR` debería bajar de ~0.34 U o el trazo se completará
dentro de un solo gesto y volverá la sensación mecánica. `JIT` (0.09 U) dispersa
el arranque de los trazos hermanos para que no nazcan en el mismo frame.

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
  tercero siga sirviendo el archivo.
- **Carga bajo demanda, no en `<head>`.** `leaflet.js` + `leaflet.css` pesan
  ~164KB juntos, y hasta hace poco se cargaban en las 5 páginas aunque solo
  Ubicación usa el mapa — puro peso perdido en cada visita a Inicio,
  Habitaciones, Reservas o Experiencias. `loadLeaflet()` en `app.js` los
  inyecta la primera vez que hace falta (memoizado: solo una vez por carga
  de página, sin importar cuántas veces se entre y salga de Ubicación).
  El `<link>` de Leaflet se inserta **antes** que `site.css` en el `<head>`
  al inyectarlo (no al final): `site.css` sobrescribe el estilo del
  marcador y los controles, y esa cascada depende del orden — insertarlo
  después invertiría la prioridad y esos estilos dejarían de aplicar.

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

Es una SPA falsa: las cinco páginas están en el HTML dentro de `div.page`, y
`goTo()` alterna cuál tiene la clase `active`.

Cada página tiene su hash (`#home`, `#rooms`, `#location`, `#reservas`,
`#experiencias`), igual que su `data-page`. `goTo()` lo actualiza al navegar
(`location.hash`, no `history.replaceState`, a propósito: así el atrás/adelante
del navegador funciona de verdad, con sus propias entradas de historial) y un
listener de `hashchange` hace lo mismo a la inversa —atrás, adelante, o alguien
que edita el hash a mano llaman a `goTo()` igual que un click de menú. Al cargar
la página con un hash presente (link directo o recarga) se abre esa sección de
una vez, con un swap de clases manual en vez de pasar por `goTo()`/`reAnim()`:
esas dos están pensadas para RE-lanzar una transición ya en curso y llaman a
funciones (`navColor`, `window.initLocMap`) que en la primera carga del script
todavía no existen — `navColor` porque se define más abajo en el mismo archivo,
`initLocMap` porque lo define `map.js`, que va después con `defer`. Invocarlas
antes de tiempo (el primer intento de esto lo hizo) revienta con
`ReferenceError` por acceder a un `const` en su *temporal dead zone*.

**Inicio es hash vacío, no `#home`.** Si se forzara `location.hash = 'home'`
cada vez que `goTo('home')` corre, incluido cuando lo dispara el propio atrás
del navegador cayendo en el hash vacío original, ese cambio de valor (de `''` a
`'home'`) se leería como una navegación nueva y pisaría la pila de "adelante".
Por eso `goTo()` sólo escribe el hash cuando el destino no es Inicio.

**Limitación conocida y aún no resuelta:** aunque ya se puede enlazar y
recargar en `#experiencias`, `#rooms`, etc., sigue siendo una sola URL de
documento — Google no las indexa como páginas separadas. Para una landing de
hotel, donde el tráfico de búsqueda importa, esto es una deuda a saldar antes de
dar el sitio por definitivo. La salida natural es pasar a archivos HTML reales
—`habitaciones.html`, `ubicacion.html`, `reservas.html`, `experiencias.html`—
reutilizando el mismo CSS y los mismos scripts, que ya están separados
justamente para eso.

## Imágenes

Las fotos que aún no existen no rompen el diseño: `app.js` genera un marcador
SVG a partir del atributo `data-ph` de cada `<img>`. Para añadir una foto nueva
basta con dejar el archivo en su carpeta; el marcador desaparece solo.

`assets/img/pendientes/` guarda fotos reales del hotel que todavía no se
publican (habitación cuádruple, tomas alternativas). No están enlazadas desde
ninguna página.

### El logo

`assets/img/logos/` guarda el logo oficial del hotel en tres tamaños
(`lagruta-logo-{512,1024,2048}.png`, verde sobre transparente) tal como lo
entregó Carmen — esos tres se dejan intactos, sin usar directamente en el
sitio. De ahí salen dos recortes que sí se usan, generados una sola vez con
Pillow a partir del de 2048px (no hay paso de build que los regenere: si el
logo cambia, hay que rehacerlos a mano con el mismo recorte):

- **`lagruta-wordmark.png`** — solo "LA GRUTA" (sin "HOTEL" ni las 3
  estrellas). Para espacios angostos: menú superior y footer.
- **`lagruta-seal.png`** — el sello completo. Para espacios con más aire:
  el preloader y "Bienvenido a ▢" en la sección de bienvenida de Inicio.

El logo es de un solo color (verde `#1b5e20`-ish sobre transparente). En vez
de pedir una segunda versión en blanco, el menú superior y el footer lo
invierten con `filter: brightness(0) invert(1)` cuando el fondo es oscuro
(`nav.dark` lo saca cuando el fondo ya es claro) — un solo archivo sirve para
los dos contextos, mismo criterio que ya usaba el `color` del texto que
reemplazó.

### Carga: eager vs. lazy, y por qué no hay `srcset` todavía

Solo el hero de **Inicio** (la página `active` por defecto en el HTML) lleva
`loading="eager" fetchpriority="high"`: es el LCP de la inmensa mayoría de
las visitas. Los otros 3 heroes (Habitaciones, Reservas, Experiencias) llevan
`loading="lazy"`, igual que el resto de las ~28 `<img>` del sitio.

**Esto no siempre fue así, y el porqué del cambio importa.** La primera
versión marcaba los 4 heroes como eager+high-priority, con el argumento de
que las 5 páginas conviven siempre en el DOM (ver "Navegación" más abajo) y
un hero lazy se quedaría sin pedir hasta que el usuario navegara ahí. Medido
con red móvil simulada (Slow 4G, CDP `Network.emulateNetworkConditions`), el
efecto real era el opuesto al buscado: **cargar Inicio bajaba también los
heroes de Habitaciones, Reservas y Experiencias** —tres fotos de ~180-260KB
que nadie estaba mirando todavía—, compitiendo por el ancho de banda
disponible con el propio hero de Inicio y con todo lo demás. El evento
`load` tardaba 8.3s; solo con este cambio bajó a 5.85s y el peso total
transferido cayó de 1273KB a 833KB.

El costo que sí queda, y es un costo real: la primera vez que alguien navega
a Habitaciones/Reservas/Experiencias con una conexión lenta, ese hero recién
empieza a pedirse en ese momento (aunque el `<div class="page">` esté en
`display:none`, el swap de `goTo()`/la carga inicial por hash lo hace visible
antes de que el navegador evalúe si el `lazy` aplica, así que en la práctica
arranca casi de inmediato, no al scrollear). Es el trade-off correcto: mejorar
la carga que **sí** le pasa a todo el mundo (Inicio) a costa de una espera
puntual, solo la primera vez, en una navegación que no todos hacen.

No se agregó `srcset`/`sizes` a ninguna imagen todavía. Los heroes y la banda
ya tienen resolución de sobra para justificarlo (ver "Peso del archivo vs.
tamaño de despliegue" más abajo), pero las miniaturas/tarjetas siguen topadas
en 700-1100px por diseño (esas sí están pensadas para su caja chica, no para
pantalla completa) — sería el próximo paso si se quiere una densidad más
alta ahí también, pero hoy no es el cuello de botella.

No hay ninguna imagen de fondo vía CSS `background-image` en el sitio (todas
las fotos son `<img>` con `.imgc` `object-fit:cover`), así que la recomendación
de `background-size:cover` del brief original no aplicaba a este código.

### Peso del archivo vs. tamaño de despliegue

Las fotos de habitaciones y del collage de bienvenida se subieron todas a
~1448px de ancho (300-550KB cada una) sin importar en qué caja terminaban
mostrándose — algunas, como las del collage (`.wc-img`), se despliegan en
cajas de apenas 300-340px. Eso es 4-5x más resolución (y bastante más peso)
del que la pantalla llega a pintar, incluso en retina/2x.

Se corrigió redimensionando y recomprimiendo (Pillow, JPEG progresivo,
`optimize=True`) según dónde vive cada foto:

| Uso | Ancho objetivo | Calidad |
|---|---|---|
| Miniaturas del collage (`.wc-img`, cajas ≤340px) | 700px | 78 |
| Tarjetas de habitación (`.room-card-media`, columnas ≤~590px) | 1100px | 78 |

**Los heroes y la banda a sangre completa (`.hero-media`, `.band`) son la
excepción a propósito: van a resolución nativa, tal como llegan, sin
redimensionar ni recomprimir.** Un `object-fit:cover` estirando una foto
topada en ~1448px para cubrir un monitor de escritorio ancho (1920px+, más
retina/2x) se nota borroso — no es un problema de compresión, es de
resolución de origen, y no hay compresión que lo arregle. La solución no es
bajarle más el peso: es el preloader (ver más abajo), que existe justamente
para tapar la pantalla mientras un hero de 2-3MB termina de cargar, en vez
de forzarlo a pesar menos a costa de nitidez. `MIN`/`MAX` del preloader y el
techo de espera en `goTo()` están calibrados para heroes de ese peso — si
algún día se comprimen, esos números pueden bajar de nuevo.

Resultado en las miniaturas/tarjetas: ~4.9MB → ~2.2MB, sin pérdida visible al
tamaño en que se muestran. **Al subir una foto nueva que NO sea un hero,
conviene redimensionarla según esta tabla antes de subirla** — no hay ningún
paso de build que lo haga automáticamente. Los heroes se suben tal cual,
directo de cámara o Drive (no de WhatsApp, que recomprime agresivamente y
tapa la resolución en origen).

## Preloader

`#preloader` es un overlay fijo (z-index 9000, por encima de `.pt`) con el
texto "La Gruta" en Cormorant Garamond. Se ve en dos momentos distintos, con
dos comportamientos distintos — no son el mismo código con dos disfraces,
son dos necesidades distintas que comparten el mismo elemento visual:

- **Primera pintura de la página** (`if(preloaderEnabled){...}` al principio
  de `app.js`): tapa la pantalla mientras el hero de la página activa (y el
  resto de recursos "eager") terminan de cargar. Mínimo 1.4s, máximo forzado
  de 3.5s, y espera a que el evento `load` **y** la imagen del hero estén
  listos (lo que termine último) — así una carga rápida no se siente
  instantánea y brusca, pero una lenta tampoco deja al visitante mirando la
  marca más de 3.5s. Al ocultarse, `#app-shell` (nav, menú, las 5 páginas)
  pasa de `scale(1.03)` a `scale(1)` en sincro — el "asentamiento" de salida.
  Esto pasa en **cada** carga o recarga, no solo la primera vez por sesión:
  no hay ningún `sessionStorage` de por medio a propósito.
- **Cada cambio de página dentro de la SPA** (`showPreloader()`/
  `hidePreloader()`, llamadas desde `goTo()`): acá no hay nada que esperar
  del `load` event, así que es más simple y más corto. `showPreloader()`
  aparece **sin transición** (clase `.instant`, saca la de golpe en el mismo
  frame que la cortina `.pt` empieza a cubrir) — tiene que sincronizar con
  algo que cubre la pantalla de una, no con un fundido de por medio.
  `hidePreloader()` sí se desvanece con el `.7s` normal, justo antes de que
  la cortina descubra. De paso resuelve un problema real: los heroes de
  Habitaciones/Reservas/Experiencias son `loading="lazy"` (ver "Carga: eager
  vs. lazy" más abajo), así que la primera vez que se navega a esa página su
  foto puede no estar lista todavía — `goTo()` espera a que cargue (con un
  techo de 900ms) antes de ocultar el preloader, así el "pop-in" de la foto
  queda escondido detrás de la marca en vez de a la vista.

`showPreloader()` también reinicia la animación de entrada de la marca cada
vez (mismo truco que `.hw` en `reAnim()`: `animation='none'` → reflow →
`animation=''`), así el fade-in+scale se repite en cada aparición en vez de
quedarse "gastado" tras la primera.

Se salta por completo con `prefers-reduced-motion: reduce` — ni la primera
pintura ni los cambios de página muestran nada, `#preloader` se saca del DOM
apenas arranca el script y `showPreloader()`/`hidePreloader()` quedan como
no-ops (`preloaderEnabled` en `false`). Esa condición se resuelve en un
`<script>` **inline**, colocado antes que `#app-shell` en el `<body>` — la
única excepción a "nada de JavaScript en línea" que queda en el código (ver
"Orden de carga" más arriba). Es deliberada: `app.js` corre `defer`, es
decir, después de parsear todo el documento, y para cuando llegara a decidir
si mostrar el preloader ya habría pintado el contenido real una vez.

## Revelado de texto al hacer scroll

Complementa a `.rv-el` (que revela bloques enteros) con un segundo sistema,
más propio de sitios editoriales de lujo, pensado para titulares y su párrafo
principal:

- `[data-reveal="words"]` en un `<h2>` — app.js lo envuelve palabra por
  palabra (`.rw` exterior con `overflow:hidden` de máscara, `.rw-in` interior
  es el que se traslada) la primera vez que se observa el DOM, conservando
  cualquier `<em>`/`<br>` que el titular ya traía (una recursión sobre los
  nodos hijos, no un `textContent` a secas, que los habría perdido). Al
  entrar en viewport (`IntersectionObserver`, threshold .2), cada palabra
  gana `.on` con 40ms de diferencia respecto a la anterior.
- `[data-reveal="fade"]` en un `<p>` — el párrafo principal de la sección
  entra completo con fade + `translateY(24px→0)`.

El `<h1>` de cada hero queda fuera a propósito: ya tiene su propio sistema de
palabra-por-palabra (`.hl`/`.hw`), pero disparado por el cambio de página
(`reAnim()`), no por scroll — aplicarle también este segundo sistema
duplicaría el envoltorio de spans sobre el mismo texto. Por la misma razón de
"una sola vez por visita" que ya rige a `.rv-el`, `reAnim()` también resetea
`.rw-in`/`[data-reveal="fade"]` al cambiar de página, así que revisitar una
página vuelve a revelar su titular — coherente con el resto de la capa de
scroll-reveal del sitio, en vez de una excepción nueva.

## Accesibilidad

Ambas capas botánicas respetan `prefers-reduced-motion: reduce`: se muestran
completas y sin motor de scroll. La vegetación lleva `aria-hidden="true"` y
`pointer-events: none`. El preloader y el revelado de texto por palabra
(sección anterior) hacen lo mismo: se saltan enteros y el contenido aparece
ya visible.
