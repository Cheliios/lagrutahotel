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
| opiniones de huéspedes | dos paneles (Booking.com + TripAdvisor) de mismo peso visual, carrusel horizontal cada uno |
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
  ~164KB juntos, y solo los usa la miniatura de mapa del menú — puro peso
  perdido en cualquier visita que no abra el menú. `loadLeaflet()` en
  `app.js` los inyecta la primera vez que hace falta (memoizado: solo una
  vez por carga de página, sin importar cuántas veces se abra y cierre el
  menú). El `<link>` de Leaflet se inserta **antes** que `site.css` en el
  `<head>` al inyectarlo (no al final): `site.css` sobrescribe el estilo
  del marcador y los controles, y esa cascada depende del orden —
  insertarlo después invertiría la prioridad y esos estilos dejarían de
  aplicar.

La rueda del ratón nunca hace zoom en ningún mapa del sitio: uno que
secuestra el scroll de la página es un fallo de usabilidad, no una
función. Para acercar están los botones de zoom del propio mapa.

El proveedor de tiles está en la constante `TILES` de `map.js`. La atribución de
Esri y OpenStreetMap es obligatoria por licencia: no se quita.

> **Historia:** hasta la Ronda 12 (`docs/ARQUITECTURA.md` más abajo) existía
> también una página de Ubicación completa (`#page-location`) con un mapa
> propio a pantalla completa (`window.initLocMap`), un badge "7 minutos
> caminando" y un enlace "Cómo llegar" a Google Maps. Se eliminó del sitio
> entero por pedido explícito de la tesista ("la siento redundante"). Lo
> que queda hoy —y es lo único que describe el resto de esta sección— es
> la miniatura interactiva dentro del menú (`window.initMenuMap`, ver
> "Diseño del menú" más abajo). Si se necesita recuperar el detalle del
> mapa a pantalla completa, está íntegro en el historial de git de este
> archivo y de `index.html`/`map.js`/`app.js` (buscar `initLocMap`).

## Navegación

Es una SPA falsa: las cuatro páginas están en el HTML dentro de `div.page`, y
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
que las páginas conviven siempre en el DOM (ver "Navegación" más abajo) y
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
  marca más de 3.5s. Al ocultarse, `#app-shell` (nav, menú, las páginas)
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

## Diseño del menú y del header (NO REVERTIR sin hablar con la tesista)

**Decisión deliberada, aprobada por la tesista el 2026-09-14.** Antes, `.menu`
era un panel oscuro (`--ink`) con los links en serif itálica grande (`Cormorant
Garamond`, hasta 80px) repartidos en dos columnas (lista + imagen lateral +
contacto). Se reemplazó a propósito por un patrón de referencia que la
tesista trajo de un sitio hotelero real (Intursa): panel **claro** (`--paper`),
**una sola columna centrada**, tipografía **sans-serif del sitio** (`Jost`) en
tamaño moderado (`clamp(20px,2.6vw,28px)`), sin números de índice, sin panel
lateral con foto. El contacto queda debajo de la lista, también centrado.

Si algún agente necesita tocar `.menu`/`.menu-*`/`.nav-logo`/`.nav-book` en
`assets/css/site.css`, tener en cuenta:

- El burger (`#burger`) **ya hace de botón "X"** al abrir (rotación de sus
  barras vía `.burger.open span`); no se agregó ningún botón de cierre nuevo.
  Sus barras cambian a `var(--ink)` cuando el menú está abierto
  (`.burger.open span { background: var(--ink); }`) porque ahora quedan sobre
  un panel claro, no oscuro.
- Con el menú abierto, `.nav-logo` y `.nav-book` se ocultan
  (`body:has(.menu.open) ...`, con `!important` porque ambos traen una
  animación `fade forwards` que si no gana la pelea de especificidad) para
  que solo quede visible la "X", igual que la referencia.
- `.menu-index` (el "01", "02"…) se dejó en el HTML pero se oculta por CSS
  (`display: none`) — no se tocó `index.html` para no arriesgar el JS que
  referencia esos nodos.
- El logo del header (`.nav-logo-img`) se agrandó de 34px a 48px de alto, el
  padding de `nav` subió de 26px a 30px, y `.nav-book` ("Reservar") subió de
  11px a 13px — **no** al mismo tamaño del logo (se vería descompensado),
  sino a un punto medio entre su tamaño anterior y la escala del logo nuevo,
  para que ambos elementos del nav se sientan de la misma familia visual.

Cualquier cambio de vuelta al panel oscuro/dos columnas/serif itálica debe
consultarse antes: es un rediseño pedido explícitamente, no un estado
transitorio.

### Ronda 2 (misma fecha): identidad del sitio + mapa en vez de foto

El layout de la Ronda 1 (arriba) se mantiene, pero su piel era genérica
(grises, sans-serif plana, sin nada que la ligara a La Gruta). Esta ronda le
puso la identidad del sitio encima del mismo layout, sin tocar la estructura
de una sola columna centrada:

- **Tipografía:** `.menu-link` pasó de `Jost` a `Cormorant Garamond` (la
  misma serif de `.hero-title`), y su hover ganó `font-style: italic` — el
  mismo recurso que ya usa `.hero-title em`, no una convención nueva.
- **Color:** el hover de `.menu-link` pasó de `--warm-on-light` a `--green`
  (acento oliva de marca). Se agregó `.menu-eye` arriba de la lista
  ("Hotel La Gruta"), con el mismo tratamiento de `.hero-eye`
  (uppercase, `letter-spacing:6px`, 11px, `--warm-on-light`).
- **Mapa en vez de foto (solo desktop):** `.menu-prev` (la foto
  `jardin.jpg`, ya descartada en la Ronda 1) se reemplazó por `.menu-map`
  — un Leaflet real, no una imagen ni un `<iframe>` de Google Maps.
  Reutiliza las mismas tiles grises de Esri y el mismo marcador
  (`.loc-dot`) que el mapa de la página Ubicación, para que se lea como
  el mismo mapa del sitio, no como un componente aparte. Ver
  `window.initMenuMap` en `assets/js/map.js` (mismas `LAT`/`LNG`/`TILES`
  que `initLocMap`, pero sin controles ni interacción: es una postal, no
  una herramienta de navegación) y `ensureMenuMap()` en `assets/js/app.js`,
  que lo carga bajo demanda —vía el mismo `loadLeaflet()` que ya usaba
  Ubicación— la primera vez que se abre el menú, no de entrada.
  `.menu-map { display:none }` por defecto y solo aparece en
  `@media (min-width: 901px)`: en una pantalla angosta compite demasiado
  con la lista de links por el mismo espacio vertical, así que en mobile
  el menú se queda solo con lista + contacto, como en la Ronda 1.

Si se toca `.menu-map`/`.menu-eye`/`initMenuMap`, mantener el mismo
proveedor de tiles (Esri, sin token) que usa Ubicación — no meter Google
Maps ni Mapbox aquí: sería un segundo estilo de mapa conviviendo con el de
Ubicación, y reabriría el problema de API keys que el proyecto ya evitó una
vez (ver "El mapa" más arriba).

### Ronda 3 (misma fecha): mapa más grande e interactivo, layout de dos columnas en desktop

La tesista pidió explícitamente que el mapa del menú se viera más grande y
que fuera interactivo (arrastre + zoom), no una postal fija — y sugirió, de
paso, un Google Maps con colores propios. Se descartó esa vía (exige API key
facturable de Google Cloud, el mismo problema de secretos/cuota que ya se
evitó con Mapbox) a favor de dar más interacción y más aire al Leaflet que
ya existía:

- **`.menu-inner` pasa a `flex-direction:row` en desktop** (≥901px): antes
  era una sola columna centrada con el mapa apretado abajo del todo; ahora
  el texto (`.menu-col`: eyebrow + links + contacto, agrupados en un solo
  wrapper para poder ir a la izquierda) queda a la izquierda y el mapa a la
  derecha, ambos centrados verticalmente. En mobile sigue siendo una sola
  columna centrada, sin mapa — sin cambios ahí.
- **El mapa crece con la ventana:** `width: min(46vw, 560px)` y
  `.menu-map-frame { height: min(52vh, 460px) }` — bastante más grande que
  el recuadro fijo de 320×190px de la Ronda 2, pero acotado para no aplastar
  la columna de texto en laptops de 13" ni desbordar el panel en monitores
  grandes.
- **Ahora es interactivo de verdad:** `initMenuMap` en `assets/js/map.js`
  pasó `dragging`/`tap`/`doubleClickZoom`/`boxZoom` de `false` a `true` y
  agregó `L.control.zoom({position:'bottomright'})` — mismos permisos que
  `initLocMap`. La única excepción, en los dos mapas del sitio: la rueda del
  mouse **nunca** hace zoom (`scrollWheelZoom:false`), la misma regla de "no
  secuestrar el scroll de la página" documentada en "El mapa" más arriba —
  el menú, al ser un overlay a pantalla completa, la necesita todavía más.
- **Controles y atribución con la piel del sitio:** las reglas
  `.loc-map .leaflet-control-attribution` / `.leaflet-bar` (colores,
  tipografía) ahora también aplican a `.menu-map-frame`, así que los
  botones `+`/`−` y el texto de atribución de Esri/OpenStreetMap (que la
  licencia obliga a mostrar, ver "El mapa") se ven iguales en los dos
  mapas del sitio en vez de con el estilo por defecto de Leaflet.

Si se vuelve a tocar el tamaño del mapa del menú, mantener las dos unidades
relativas (`vw`/`vh` con techo fijo) en vez de un tamaño fijo: es lo que
evita que se vea diminuto en monitores grandes (queja original de esta
ronda) sin romper el layout en pantallas de 13".

### Ronda 4 (misma fecha): scroll de fondo, layout a los bordes, flechitas y tarjeta del jardín

**Bug real corregido — scroll de fondo en mobile.** `.menu` es
`position:fixed`, pero eso NUNCA bloqueó el scroll del `<body>` detrás: con
el menú abierto, un dedo (o rueda) seguía moviendo la página de fondo. La
solución no es `overflow:hidden` a secas en `<body>` — no alcanza para el
rebote de iOS Safari —, es sacar el `<body>` del flujo con
`position:fixed` y devolverlo a su `scrollY` exacto al cerrar. Ver
`setMenuOpen()` en `assets/js/app.js` (reemplaza los tres sitios sueltos
que antes tocaban `menuOpen`/`burger.classList`/`menu.classList` por
separado: el burger, `goTo()` al navegar y `goTo()` al cerrar sin navegar)
y `body.menu-lock` en `assets/css/site.css`. Dos detalles no obvios:

- `scrollLockY` se captura en cada apertura (no una vez) y se restaura con
  `window.scrollTo({..., behavior:'instant'})` — **no** el default: `<html>`
  tiene `scroll-behavior:smooth` (ver arriba), y sin `'instant'` el
  restore se ve como un scroll animado de vuelta en vez de un salto
  invisible al punto exacto de antes.
- Si se toca `setMenuOpen()`, seguir centralizando ahí cualquier cambio de
  estado del menú — no volver a poner `menuOpen=`/`.classList` sueltos en
  otro sitio, o el lock de scroll se queda desincronizado del panel.

**Layout justificado a los bordes (desktop).** La tesista pidió
explícitamente "justificar a los costados": `.menu-inner` pasó de
`justify-content:center` con un `max-width` centrado a
`justify-content:flex-start` con `.menu-map { flex:1 }` — el mapa se
estira solo hasta ocupar todo el ancho sobrante hasta el borde derecho del
panel, así que no hace falta repartir espacio de sobra: se acabó, lo ocupó
el mapa. `align-items:stretch` en `.menu-inner` hace que texto y mapa
compartan la misma altura completa del panel (antes el mapa tenía una
altura tope en `vh`, ahora hereda el 100% de su columna vía
`.menu-map-frame{height:100%}` — ver el comentario en el CSS sobre por qué
esa regla tiene que ir DESPUÉS de la regla base en el archivo, no alcanza
con que esté en un `@media` más específico: misma especificidad, gana la
que aparece después en el cascade).

**Flechitas en los links (desktop y mobile).** `.menu-link::after` agrega
un "→" siempre visible (pedido explícito: "como en la foto"), pero sutil —
sans-serif chica en `--warm-on-light`, no compite con el peso de la serif
grande — que se desliza y se pone verde al hover. Es el mismo motivo "▸"
que ya usa `.nav-book` ("▸ Reservar"), ahora como sufijo. Truco no obvio:
`.menu-item` recorta con `overflow:hidden` para enmascarar el reveal de
entrada (`translateY`), así que sin `padding-right` extra en `.menu-link`
el `translateX` de la flecha al hover se sale de esa caja y queda
cortado — el padding reserva el aire que ese desliz necesita.

**Tarjeta "El jardín" (desktop, bajo el contacto).** No es contenido
nuevo inventado: es la sección "El jardín" de Inicio (`jardin-sec`, más
arriba en este documento) — que ya dice, textual, *"El jardín no es un
adorno del hotel: es el corazón de todo"* — reempaquetada como tarjeta
chica con la misma imagen (`jardin-1.jpg`) para llenar el aire que quedaba
bajo el contacto. `.menu-col` pasa a `justify-content:space-between` con
dos hijos: `.menu-col-top` (eyebrow+links+contacto, agrupados aparte
justamente para que el `space-between` separe SOLO estos dos bloques, no
los tres elementos sueltos de antes) y `.menu-teaser` al fondo. Como el
mapa, solo aparece en desktop (`.menu-teaser{display:none}` por defecto).

### Ronda 5 (misma fecha): header roto en mobile — chips del nav sin espacio

Otra sesión (commit `feat(vegetacion): la enredadera cruza header y
footer sin tapar el texto`) intentó que la capa vegetal se viera cruzar
por debajo del propio `nav`, no solo del contenido: le sacó a `nav` su
scrim de ancho completo y le dio a `.nav-logo`, `.nav-book` y `.burger`
un chip translúcido propio (padding + `border-radius` + blur), dejando el
resto de la barra transparente — en TODOS los anchos, mobile incluido.

**Bug reportado por la tesista con captura: en mobile (390px) los tres
chips no entraban en el ancho disponible de la barra** (390px de viewport
− 60px de padding de `nav` ≈ 330px para los tres) y se superponían entre
sí — logo chocando con el burger y con "Reservar". El commit original
decía haber verificado con Playwright sin errores, pero el chequeo no
cubrió este caso concreto (mobile, `nav.dark` activo, los tres elementos
a la vez).

**Arreglado por otra sesión mientras esta investigaba el mismo bug**
(commit `fix(nav): revertir mobile a la barra solida original, desktop
intacto`, llegó a `master` unos minutos antes que el fix de esta ronda —
se descartó el revert propio de esta sesión a favor de ese, ver más
abajo): en vez de revertir el chip por completo, lo encierra en
`@media (min-width: 901px)`. Mobile vuelve exactamente al scrim de ancho
completo de siempre (gradiente oscuro con blur sobre hero, papel
translúcido vía `nav.dark` sobre contenido claro, sin chips) — ahí nunca
hay aire de sobra para tres chips con padding. Desktop se queda con el
diseño de chips translúcidos (la vegetación cruzando por debajo del nav
sigue viéndose ahí), que es donde sí hay margen lateral de sobra. Ver el
bloque `@media (min-width: 901px)` al final de la sección `── NAV ──` en
`assets/css/site.css` — todo lo que antes eran reglas base de `.burger`/
`.nav-logo`/`.nav-book` con chip vive ahora solo ahí dentro.

**Si se vuelve a tocar el nav**, seguir con ese mismo split
mobile-sólido/desktop-chip: no volver a sacar el chip de dentro del
`@media`, y si se ajusta el breakpoint o el padding de los chips, probar
explícitamente en 390px con `nav.dark` activo (scrolleado más allá del
hero) antes de dar por buena la ronda — ese es exactamente el caso que
se rompió y el que no cubrió la verificación original.

### Ronda 6 (2026-09-15): hueco enorme en "Bienvenido a La Gruta" (mobile) + FAQ pegado al borde

Dos bugs reportados con capturas de mobile real.

**El hueco enorme era `.welcome` con `min-height: 90vh` sin resetear en
mobile.** Ese mínimo existe para la maqueta desktop, donde `.wc-center`
flota `position:absolute` sobre una grilla de fotos de 860px — sin él, la
sección podría medir menos que la grilla. En mobile la grilla pasa a
apilar las fotos (`.welcome-grid` → `flex-direction:column`, mucho más
baja que 90vh), pero el `min-height:90vh` de `.welcome` no se tocaba, así
que el navegador igual forzaba la sección a esa altura — dejando un
bloque de aire vacío entero después del párrafo, antes de que empezara
"Por qué La Gruta". Fix: `.welcome { min-height: 0; }` dentro del
`@media (max-width: 900px)` que ya existía.

**Encima, el párrafo se veía angosto y con muchas líneas cortas** por la
misma causa raíz (una regla pensada para la tarjeta chica de desktop, sin
resetear en mobile): `.wc-center` trae `padding: 40px 48px` porque en
desktop es una tarjeta shrink-to-fit flotando sobre las fotos. En mobile
pasa a ser un bloque de ancho completo (`position:relative`, dentro de un
flex-column con `align-items:stretch` por defecto) — ese mismo padding le
comía 96px de ancho al contenido, y sumado al `max-width:300px` de
`.wc-desc` (también calibrado para la tarjeta angosta), el párrafo
quedaba aplastado a ~214px de ancho real medido. Fix, mismo `@media`:
`.wc-center` baja su padding a `32px 24px` y `.wc-desc` pierde el
`max-width` (usa el ancho real disponible, ya acotado por el padding de
`.welcome`).

Se revisó si algún otro bloque comparte el patrón "tarjeta chica
`position:absolute` + `transform:translate(-50%,-50%)`" que pudiera tener
el mismo problema en mobile — solo lo comparten `.hero-caption` (que sí
usa `width:100%`, no shrink-to-fit, así que no aplica) y `.wc-center`. No
hay otro caso pendiente de este mismo bug.

**FAQ con el texto pegado al borde:** `.faq-sec` en mobile tenía
`padding: 90px 24px`; se sube el lateral a `28px`. Además `.faq-q` (el
texto de la pregunta, hijo de un `summary` `display:flex`) y `.faq-a` (la
respuesta) ganan `overflow-wrap: break-word`, y `.faq-q` también
`min-width: 0` — sin eso, un flex item de texto no se encoge por debajo
de su ancho intrínseco, y una pregunta larga puede desbordar el padding
del contenedor en vez de envolver limpio. No se pudo reproducir el
desborde exacto de la captura (pudo ser la ventana real de la tesista
más angosta que las probadas, o system font-scaling de Android) pero
este es el mismo tipo de fix defensivo que ya se aplicó en el menú
(`.menu-link`, Ronda 4) para un problema de recorte de texto análogo.

**Verificado:** capturas en 390px y 320px (FAQ), gap `.welcome`→`.statement`
medido de antes/después (pasó de un salto de ~196px de aire vacío dentro
de `.welcome` a los ~3px normales entre secciones), y una captura de
escritorio (1440px) para confirmar que ninguno de los cambios —todos
dentro de `@media (max-width: 900px)`— afecta el layout ahí.

### Ronda 7 (2026-09-15): footer roto en mobile — vegetación invasiva + franja de papel vacía

Reportado con captura: en mobile, flores/hojas grandes cruzaban encima del
texto de NAVEGACIÓN/CONTACTO del footer (legibilidad rota), y después del
footer quedaba una franja de papel vacía —de casi 900px, más grande que la
del `.welcome` de la Ronda 6— antes del botón de WhatsApp. Dos bugs
distintos, dos causas distintas, ambas en `assets/js/vines.js`.

**1. Vegetación tapando el texto — revertido.** El commit
`fix(vegetacion): footer en mobile mas frondoso` (ver Ronda 6 del footer)
le sacó el modo `shy` a las dos enredaderas ancladas al footer en mobile
para que se vieran "más llenas". Sin `shy`, `reach` (el alcance del tallo)
deja de recortarse a un 58%, y con eso la planta podía saltar de clase
`acento` (contenida, pensada para zonas con texto encima) a `medio`/
`macro` —que a propósito `reach *= 1.22` y "se pasa del encuadre"— así que
terminaba invadiendo el bloque de NAVEGACIÓN/CONTACTO en vez de quedarse
en las esquinas. Se revierte: el `vine(...)` del footer vuelve a llamarse
siempre con `shy = true`, mobile y desktop, como antes de ese commit —
mismo comentario "REVERTIDO" que ya se usó para el chip del nav (Ronda 5),
mismo patrón: un experimento de "más frondoso/más vegetación" que no se
probó contra el caso real (texto del footer en un viewport angosto) antes
de mergear.

**2. Franja de papel vacía después del footer — causa real encontrada y
arreglada, no es el mismo bug de `.welcome` (Ronda 6).** Medido con
Playwright, correlacionando el `scrollHeight` del documento contra el
estado de `#app-shell`:

```
#app-shell.pre-reveal presente  → body.scrollHeight = 9440 (inflado)
se saca la clase pre-reveal     → arranca la transición CSS scale(1.03)→scale(1)
a los 50ms de sacarla           → sigue en 9439 (la transición apenas empezó)
a los 700-900ms                 → se asienta en 9300 (el real)
```

`#app-shell` escala a `scale(1.03)` mientras el preloader cubre la
pantalla (`#app-shell.pre-reveal` en `site.css`) y Chromium cuenta ese 3%
de más como scrollable overflow del documento mientras dura. `vines.js`
mide `Hdoc` (el alto que le da a `.vines-layer`) al boot, disparado por el
evento `load` — que no espera el mínimo de 1.4s del preloader, puede
llegar antes — así que si el preloader todavía no se ocultó, `Hdoc` queda
congelado en el valor inflado (9440) para siempre: nada volvía a
remedirlo.

Fix en `boot()`: un `MutationObserver` sobre la clase de `#app-shell`
dispara un re-chequeo de altura justo cuando se saca `pre-reveal` — pero
con un delay de 800ms, no inmediato, porque sacar la clase dispara la
transición CSS (`transition: transform .7s`) del propio `#app-shell`, no
un salto instantáneo; revisar a los 50ms (el primer intento de este fix)
mide una altura casi tan inflada como la vieja y la diferencia no cruza
el umbral de 120px que dispara el rebuild. Se mantiene además
`document.fonts.ready` como red de seguridad adicional (las tipografías
web pueden mover la altura tarde en una carga lenta), con el `setTimeout`
de 1200ms de siempre como único fallback para navegadores sin Font
Loading API.

**Si se vuelve a tocar el timing de `boot()`/`build()` en `vines.js`**,
tener en cuenta que CUALQUIER transición o animación CSS sobre un
ancestro de `.vines-layer` que cambie tamaño/posición (no solo el
preloader) puede inflar temporalmente `document.body.scrollHeight` de la
misma manera — el fix general es "esperar a que la transición realmente
termine antes de medir", no un timeout fijo adivinado. Verificado:
`body.scrollHeight === documentElement.scrollHeight` exacto (9300 = 9300)
tras el fix, cero diferencia; antes había un delta de 140px. Capturas en
390px (footer legible, sin flores sobre el texto, sin franja vacía
después) y 1440px (footer de escritorio sin cambios, ya usaba `shy`).

### Ronda 8 (2026-09-15): se quita la tarjeta del jardín, el mapa pasa a vertical en todos los anchos

Dos pedidos de la tesista con capturas de las tres resoluciones (desktop,
tablet ~745px, mobile ~467px):

**1. Se quita `.menu-teaser`** (la tarjeta "El jardín" con foto+caption
que se agregó en la Ronda 4, bajo el contacto, solo desktop). Sacada del
HTML y del CSS entera — no queda como `display:none`, no hace falta
conservarla: si se vuelve a pedir un teaser ahí, mejor partir de cero que
reactivar código viejo que ya perdió una ronda de contexto.

**2. El mapa (`.menu-map`) pasa a ser vertical y a mostrarse en TODOS los
anchos, no solo desktop.** Antes: en desktop era una franja horizontal
que se estiraba (`flex:1`) hasta el borde derecho del panel; en mobile y
tablet ni aparecía (`display:none` por defecto), así que la lista de
links quedaba flotando sola en medio de una franja de aire vacío bien
larga — exactamente lo que muestran las capturas de tablet/mobile de
esta ronda.

Ahora `.menu-map` es una sola regla base (ya no `display:none` +
reglas solo dentro de `@media (min-width:901px)`):
`width: min(84vw, 340px)` centrado, apilado bajo `.menu-col` — llena
justo esa franja vacía en mobile/tablet. En desktop
(`@media (min-width:901px)`), la fila pasa a `justify-content:space-between`
con `.menu-map` en un ancho angosto y fijo (`min(26vw,360px)`, ya no
`flex:1`) y `align-self:stretch` para heredar la altura completa del
panel — eso es lo que lo vuelve un rectángulo VERTICAL de verdad (angosto
y alto) en vez de una franja horizontal, en los dos casos con el mismo
componente y sin duplicar media queries por tamaño.

**Bug encontrado y arreglado en el mismo cambio:** al angostar el marco,
la atribución de Leaflet (obligatoria por licencia — ver "El mapa" más
arriba) ya no entraba en su rincón inferior sin ocupar casi todo el
ancho, y tapaba `.menu-map-tag` ("Selva Alegre · Arequipa"), que también
vivía abajo. `.menu-map-tag` sube de `bottom:14px` a `top:14px` — en un
marco ancho y bajo (la versión horizontal de antes) nunca competían por
el mismo rincón, así que el bug no existía todavía cuando se escribió esa
regla la primera vez.

Verificado: capturas en 1308px, 745px y 467px con el menú abierto — sin
errores de consola, mapa interactivo en los tres, etiqueta y atribución
ya no se pisan.

### Ronda 9 (2026-09-15): el chip translúcido del nav se ELIMINA (no se vuelve a acotar, se saca)

Tercera vez que el header se reporta roto, siempre por el mismo origen: el
experimento de la Ronda 5 —`.nav-logo`/`.nav-book`/`.burger` con su propio
`background: rgba(...)` + `backdrop-filter: blur(...)` y el `nav` en sí
transparente, para que la vegetación de fondo se viera cruzar por detrás—
volvió a fallar, esta vez en **desktop**, que la Ronda 5 había dejado
intacto por creerlo ya probado. Captura de la tesista: el chip de
"Reservar" se veía **azul** sobre el hero de Inicio (cielo despejado
detrás). No es un bug de espacio como en mobile — es que un chip
translúcido con blur **toma el color de lo que tiene detrás**: sobre
cielo se ve azul, sobre follaje se ve verde, nunca el mismo botón dos
veces. Estructuralmente no hay overlap ni error de layout — por eso no se
detectó antes —, pero el resultado se lee como "roto" porque un botón de
marca no puede cambiar de color según la foto de fondo.

Con dos fallos reales del mismo mecanismo (Ronda 5: overlap en mobile;
esta ronda: color impredecible en desktop) y la tesista pidiendo
explícitamente que no se vuelva a romper, esta vez **no se acota más el
experimento — se elimina entero**. El `@media (min-width:901px)` que
tenía los chips se borra por completo; `nav`/`nav.dark` vuelven a ser el
scrim de ancho completo de siempre (gradiente oscuro + blur sobre hero,
papel translúcido sobre contenido claro), igual en mobile y desktop, sin
distinción — la única versión de este header que nunca se rompió.

**Regla dura, no solo un comentario en el CSS:** ningún agente debe
volver a introducir un chip translúcido por elemento en el nav —ni en
desktop, ni detrás de un `@media` nuevo, ni con otros valores de
`rgba`/blur— sin que la tesista lo pida explícitamente de nuevo y con los
ojos abiertos sobre este historial. El bloque de `site.css` justo antes
de `.menu` (sección `── NAV ──`) trae el mismo aviso en detalle. Si en el
futuro se quiere que la vegetación se note cruzando el header, la vía es
otra (bajar el z-index del nav solo donde no hay texto, o animar la
vegetación con opacidad reducida detrás), no repetir "chip translúcido +
blur", que ya demostró dos veces que no es predecible sobre fotos
arbitrarias.

Verificado: capturas de escritorio en Inicio (cielo+follaje) y Reservas
(jardín), y mobile en Inicio — mismo scrim oscuro consistente en las
tres, sin variación de color por foto de fondo.

### Ronda 10 (2026-09-15): refinamiento editorial del menú — mismo layout, menos "cartel"

Pedido explícito de refinamiento visual (no rediseño): que el menú se
sintiera más boutique/premium sin tocar estructura, tipografías ni
paleta. Todos los cambios son de escala/espaciado sobre las mismas
reglas que ya existían:

- **Mapa más chico y elegante, no protagonista.** `.menu-map` baja de
  `min(84vw,340px)`/`min(26vw,360px)` a `min(62vw,250px)`/`min(19vw,260px)`
  (mobile/desktop), el frame de `min(56vh,420px)` a `min(44vh,320px)`, la
  sombra se aligera (`0 18px 44px` → `0 14px 34px`, opacidad .14→.12) y el
  paspartú interior crece un poco (10px→12px de padding) — un marco más
  cuidado en vez de un bloque grande compitiendo con la lista de links.
- **Desktop: de `justify-content:space-between` a `center`.** Con el
  mapa ya angosto, pegarlo al borde derecho del panel dejaba un vacío
  MUERTO en el medio (mucho blanco sin composición). Centrado como grupo
  con un `gap: clamp(64px,9vw,120px)` fijo entre columnas, el mismo aire
  queda repartido alrededor del conjunto — "mucho blanco sin que parezca
  vacío" es justamente esto: negative space compuesto, no descuido.
  Padding vertical de `.menu-inner` también baja un poco (112px→92px
  arriba, 56px→48px abajo) para que el bloque se sienta más centrado
  verticalmente, no empujado hacia arriba.
- **Ritmo de links más compacto.** `.menu-link`: `clamp(30px,4vw,44px)` →
  `clamp(28px,3.6vw,40px)`, `line-height:1.5` → `1.22` (la separación
  entre líneas era el principal culpable de que la lista se leyera
  "suelta"), peso `400` → `500` (más presencia/contraste sin pasar a
  bold). `.menu-links` gap `6px`→`2px`, `.menu-item` padding `6px 0`→
  `3px 0`.
- **Flechas más discretas.** `.menu-link::after`: `font-size` 17px→13px,
  `margin-left` 16px→10px, desliz de hover 7px→5px — tienen que leerse
  como remate, no como un segundo elemento peleando con la serif grande.
- **Tracking bajado en eyebrow y contacto.** `.menu-eye` letter-spacing
  6px→4.5px, `.menu-contact a` 2px→1.4px — el rastreo tan abierto de
  antes leía más "cartel de tienda" que boutique.
- **Contacto más integrado.** `.menu-contact` margin-top 28px→18px: con
  la lista ya más compacta, el teléfono/correo se sienten parte del mismo
  bloque en vez de una sección aparte pegada abajo.

Ningún cambio de estructura HTML, tipografías (sigue Cormorant Garamond +
Jost) ni paleta (sigue `--ink`/`--green`/`--warm-on-light`) — todo es
escala sobre las mismas reglas. Verificado en 1440px, 745px y 390px con
el menú abierto: mapa interactivo (drag confirmado con Playwright), sin
errores de consola, sin regresión de layout en ningún ancho.

### Ronda 11 (2026-09-15): se quita la flechita de los links del menú

Pedido explícito, sin más contexto. Se saca `.menu-link::after` (el "→"
agregado en la Ronda 4) junto con su regla de hover
(`.menu-link:hover::after`) y el `padding-right` que solo existía para
reservarle aire — el link vuelve a ser únicamente el texto, con su color
+ cursiva al hover de siempre. Verificado en 1440px y 390px.

### Ronda 12 (2026-09-15): se elimina la página de Ubicación entera

Pedido explícito ("la siento redundante"): sacar `#page-location` del
sitio y su entrada del menú. No era solo borrar un `<div>` — la página
tenía su propio mapa Leaflet a pantalla completa (`window.initLocMap`,
`#loc-map-canvas`), su propio footer (cada `.page` trae el suyo, no hay
un footer global compartido — arquitectura ya así antes de esta ronda) y
aparecía repetida en la lista "Navegación" del footer de las otras
cuatro páginas.

**Qué se sacó:**
- `#page-location` completo del HTML (mapa, badge "7 minutos", datos de
  contacto, cuadrícula de tiempos de traslado, cercanías, su footer).
- La entrada "Ubicación" del menú (`.menu-link[data-page="location"]`) —
  el menú quedó en 4 links (Inicio/Habitaciones/Reservas/Experiencias) y
  se renumeraron los `.menu-index` (ocultos por CSS, pero por prolijidad).
- "Ubicación" de las 4 copias restantes del footer "Navegación".
- `window.initLocMap` y todo su cuerpo en `map.js` (el mapa a pantalla
  completa con marcador extendido `.loc-line`/`.loc-tag`).
- `ensureLocMap()`, la llamada `if(page==='location'){...}` en `goTo()` y
  el disparo de carga inicial `if(current==='location')` en `app.js`.
- El CSS de la página entera: `.loc-map`, `.loc-overlay`, `.loc-directions`,
  `.loc-body`, `.loc-head*`, `.loc-fact*`, `.loc-sub`, `.loc-dir*`,
  `.loc-nearby*`, `.loc-line`, `.loc-tag`, y sus entradas en las listas
  combinadas de oclusión de vegetación (línea "OCLUSIÓN" cerca del tope
  del archivo) y de z-index de fotos.
- Dos referencias en `vines.js`: `.loc-map` en la lista de "zonas duras"
  que la vegetación no cruza (`zones()`), y tres selectores muertos
  (`.loc-head .eye`, `.loc-sub`, `.loc-badge`) en la tabla de acentos
  anclados al contenido — ya no matcheaban nada, pero limpiarlos evita
  confusión futura (no afectan la secuencia del RNG: un selector sin
  coincidencias nunca llamaba a `randA()`, así que quitarlo es un no-op
  para el resto de la tabla).

**Qué se conservó a propósito** (compartido con la miniatura de mapa del
menú, que SIGUE existiendo — esto no se tocó): `.leaflet-marker-icon.loc-
marker`, `.loc-marker`, `.loc-dot` (el marcador simple del mapa del
menú reutiliza ese mismo className), las reglas de `.menu-map-frame
.leaflet-*` (ya no comparten selector con `.loc-map`, se separaron), y
`loadLeaflet()`/`ensureMenuMap()`/`window.initMenuMap` completos en
`app.js`/`map.js`.

Verificado con Playwright: el menú muestra 4 links, el footer de cada
página muestra "Navegación" sin Ubicación, `#page-location` ya no existe
en el DOM, forzar `location.hash = 'location'` a mano no rompe nada
(la SPA simplemente no reconoce esa página y se queda donde estaba), y
cero errores de consola.

### Ronda 13 (2026-09-15): el menú vuelve al layout de referencia (Intursa) — sin mapa, con "Síguenos"

Pedido explícito con captura de la referencia original ("Intursa") que
inspiró el menú desde el inicio: volver a la lista centrada en una sola
columna, igual en mobile y desktop, sin la grilla de dos columnas ni el
mapa lateral que se fueron sumando en rondas intermedias (Ronda 3 metió
el mapa y el layout de dos columnas en desktop; Ronda 8 lo hizo vertical
pero mantuvo la división en desktop). Motivo adicional, no solo estético:
otro agente agregó en paralelo un mapa grande a la página de Inicio
(`.home-map`, ver `window.initHomeMap` en `map.js`) con el mismo punto y
el mismo zoom — mantener además la miniatura del menú era mostrar el
mismo mapa dos veces en la misma sesión de navegación.

**Qué se sacó:**
- `<div class="menu-map" id="menu-map">...</div>` completo del HTML
  (el frame, el canvas y el tag "Selva Alegre · Arequipa").
- El bloque `@media (min-width: 901px) { .menu-inner{flex-direction:row...} }`
  de `site.css` que partía el menú en dos columnas en desktop — con esto
  fuera, `.menu-inner` vuelve a su única regla base (columna, centrado,
  `justify-content:center`) en cualquier ancho, que es exactamente el
  layout de la referencia.
- Todo el CSS de `.menu-map`/`.menu-map-frame`/`.menu-map-tag`.
- `window.initMenuMap` completo de `map.js` (creaba el Leaflet de la
  miniatura del menú) y la referencia `window.menuMap` del resize
  handler — solo queda `window.initHomeMap`/`window.homeMap`.
- `ensureMenuMap()` de `app.js` y su llamada dentro de `setMenuOpen()`
  (se disparaba al abrir el menú por primera vez).
- La mitad `.menu-map-frame` de los selectores combinados de atribución/
  controles de Leaflet (línea ~684 de `site.css`, compartida antes con
  `.home-map-frame`) — ahora esas reglas aplican solo a `.home-map-frame`.

**Qué se agregó:** `.menu-social`, una fila chica al pie del menú —
mismo patrón que la referencia de Intursa (ahí decía "Síguenos" +
LinkedIn). Reutiliza la tipografía/tracking de `.menu-contact` (mismo
nivel jerárquico, Jost 12px uppercase con letter-spacing), separada por
el mismo `margin-top` que ya usaba `.menu-contact`. El ícono es un único
`<svg><path>` de Facebook con `fill:currentColor` (sin librería de
iconos, coherente con los demás íconos en línea del sitio — Ubicación/
Reservas), en `--soft` con hover a `--green` como el resto de los links
del menú. Enlaza a `https://www.facebook.com/LaGrutaHotelArequipa/` con
`target="_blank" rel="noopener"`.

Verificado con Playwright en 1440px y 390px con el menú abierto:
`.menu-inner` mide `flex-direction:column`/`justify-content:center` en
ambos anchos (cero diferencia desktop/mobile, como pide la referencia),
`.menu-map` ya no existe en el DOM, `.menu-social` está presente con el
texto "Síguenos" y el link de Facebook apunta a la URL correcta, y cero
errores de consola nuevos (el único error de red observado es un
`ERR_CERT_AUTHORITY_INVALID` del proxy TLS del entorno de pruebas al
pedir tiles/fuentes externas — no relacionado con este cambio, no
aparece para un visitante real).

### Ronda 14 (2026-09-15): altura del canvas del mapa de Inicio

Investigación sobre `master` en `d574000`. El HTML conserva `.home-map`,
`.home-map-frame` y `#home-map-canvas`; el observer de `app.js` apunta al
selector correcto y `map.js` solo inicializa el mapa de Inicio.

**Causa encontrada:** el marco tiene altura explícita (620px en escritorio,
340px hasta 860px de ancho), pero el div hijo `#home-map-canvas` no tenía
altura. Leaflet posiciona sus paneles fuera del flujo normal, de modo que
no le dan altura al contenedor. La altura del padre no se hereda: el canvas
queda colapsado aunque la carga de Leaflet se complete. `invalidateSize()`
no reemplaza una altura CSS ausente.

**Fix:** `#home-map-canvas { width: 100%; height: 100%; }` en `site.css`.
El canvas ocupa el marco y sigue sus dos alturas responsive. Sin cambios
en JavaScript, HTML, proveedor de tiles, coordenadas, navegación o vegetación.

> **Nota:** el commit `1b88c2d` ("fix mapa") documentó correctamente esta
> causa y esta regla en esta misma sección, pero la regla nunca se agregó
> al `site.css` — el diff de ese commit solo tocó `.welcome`/`.wc-*` (un
> ajuste distinto, del collage) y `ARQUITECTURA.md`. La sección quedó
> describiendo un fix que no estaba aplicado. Esta ronda agrega la regla
> que faltaba.

**Verificación realizada** (con Chromium/Playwright, sí disponible en este
entorno): servidor HTTP local, scroll hasta `.home-map` a 1440px y 390px.
`#home-map-canvas`/`.home-map-frame` miden 1240×620 y 342×340 respectivamente
(antes del fix: colapsados a 0 de alto), `window.homeMap.getSize()` devuelve
`{x:1240,y:620}` y `{x:342,y:340}`, marcador y controles de zoom visibles,
atribución de Leaflet presente, tarjeta de dirección legible en ambos anchos,
sin errores de consola nuevos. Los tiles de Esri no se pudieron confirmar
visualmente en este entorno de pruebas específico (el proxy TLS del sandbox
bloquea `server.arcgisonline.com` con `ERR_TUNNEL_CONNECTION_FAILED`, no
relacionado con el sitio) — el placeholder gris de Leaflet se ve correcto y
del tamaño esperado, que es lo que este fix controla; la carga de tiles en
producción depende solo de que el navegador del visitante alcance Esri, ya
verificado en rondas anteriores del mismo mapa (Ronda 8 y otras).
