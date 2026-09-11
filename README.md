# Hotel La Gruta — Landing page

Landing page institucional para Hotel La Gruta (Arequipa, Perú). Sitio estático — un solo `index.html`, sin build ni dependencias que instalar.

## Ver el sitio en vivo (GitHub Pages)

Para poder chequear el avance desde el celular u otra PC sin estar conectado a este repo localmente, actívalo así (una sola vez):

1. En GitHub, entra a **Settings → Pages** del repo `Cheliios/lagrutahotel`.
2. En **Source**, elige **Deploy from a branch**.
3. En **Branch**, selecciona la rama que quieras publicar:
   - `claude/hola-fdivtb` (o la rama de trabajo actual) → para revisar el avance mientras seguimos iterando.
   - `master` → cuando ya esté aprobado y quieras que sea "la versión oficial".
   - Carpeta: `/ (root)`.
4. Guarda. GitHub tarda 1-2 minutos en publicar.
5. El sitio queda disponible en:

   **https://cheliios.github.io/lagrutahotel/**

Cada vez que se haga push a la rama publicada, el sitio se actualiza solo (unos minutos después).

> Nota: mientras el sitio esté apuntando a una rama de trabajo (no `master`), lo que veas ahí es un borrador — úsalo para revisión interna, no para mandarle el link a Carmen todavía si aún faltan las fotos reales u otros ajustes pendientes.

## Estructura del proyecto

```
index.html                  → el sitio real (Inicio, Habitaciones, Ubicación, Reservas)
botanic-lib.js              → biblioteca botánica compartida (geometría + especies)
botanic.js                  → sección "El jardín": composición vertical en grafito
vines.js                    → capa vegetal perimetral dorada sobre toda la página
crecimiento_persistente.html→ demo aislado de la animación anterior (referencia de diseño, no se publica)
*.jpg                       → imágenes del hotel (comprimidas; varias son placeholders temporales — ver abajo)
```

### Las dos capas vegetales

El sitio tiene **dos** sistemas botánicos, deliberadamente distintos:

| | `botanic.js` — "El jardín" | `vines.js` — capa perimetral |
|---|---|---|
| Papel | Pieza editorial: se mira de frente | Ambiente: se descubre de reojo |
| Dónde | Una sección de 380vh | Toda la página |
| Color | Grafito (#252525 / #3A3A3A / #606060) | Dorado envejecido (#C5A059), opacidad 0.13–0.38 |
| Origen | Un tallo desde abajo | Enredaderas desde los bordes izquierdo y derecho |
| Reloj | Progreso dentro de su sección | Posición de cada planta en el documento |
| Al subir el scroll | Se repliega (scrub reversible) | **Se queda**: el jardín se acumula |

La geometría de las especies (hojas, helechos, hortensias, rosas, capullos,
zarcillos) vive una sola vez en `botanic-lib.js`; cada capa aporta su "pintor"
(color, opacidad, nivel de detalle, ventana de scroll). Un cambio en el dibujo
de una rosa se aplica a las dos capas a la vez.

#### Notas para tocarlo

- **Ritmo del jardín**: tabla `T` en `botanic.js` (una ventana `{s, e}` por etapa).
- **Ritmo de la capa perimetral**: tablas `OFF` y `DUR` en `vines.js`, medidas en
  "pantallas de scroll". `OFF` fija el orden biológico (una flor nunca antes que
  su rama) y `DUR` cuánto tarda cada etapa en dibujarse.
- **Densidad**: `bandH` en `vines.js` (cada cuántos píxeles nace una planta) y
  `P.detail` (0–1, escala nervaduras, folíolos y florecillas).
- **Largo del recorrido del jardín**: `.garden { height }` en el CSS de `index.html`.
- **Orden de apilamiento**: la capa va a `z-index: 4`; las fotos y el mapa suben a
  `z-index: 6`. Importante: `.rv-el.on` usa `transform: none` (no `translateY(0)`)
  a propósito — con un `transform` distinto de `none` la card sigue siendo un
  *stacking context* y su foto no puede subir por encima de la vegetación.
- **Zonas**: `vines.js` no siembra sobre `.hero`, `.band` ni `.loc-map` (fotos a
  sangre y mapa van siempre encima). Sobre `.garden` sí siembra, pero con el
  alcance recortado, para no competir con la ilustración de grafito.
- Sin dependencias externas: SVG + `requestAnimationFrame`. `getTotalLength()` se
  mide una sola vez por trazo, al construir.
- Con `prefers-reduced-motion: reduce` ambas capas se muestran completas y sin
  motor de scroll.

## Probar localmente

No requiere instalación. Basta un servidor estático simple:

```bash
python3 -m http.server 8000
```

Y abrir `http://localhost:8000/index.html`.
