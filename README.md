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
crecimiento_persistente.html→ demo aislado de la animación de crecimiento botánico (referencia de diseño, no se publica)
*.jpg                       → imágenes del hotel (comprimidas; varias son placeholders temporales — ver abajo)
```

### Estado de las imágenes

Algunas fotos (`fachada.jpg`, `recepcion.jpg`, `cafeteria.jpg`, `jardin.jpg`, `suite.jpg`, `matrimonial.jpg`, `triple.jpg`, `doble.jpg`, `individual.jpg`, `semisuite.jpg`) son **placeholders temporales de stock**, pendientes de reemplazo por fotos reales del hotel. `hero-inicio.jpg` y `panoramica.jpg` sí son fotos reales.

## Probar localmente

No requiere instalación. Basta un servidor estático simple:

```bash
python3 -m http.server 8000
```

Y abrir `http://localhost:8000/index.html`.
