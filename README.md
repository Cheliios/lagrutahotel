# Hotel La Gruta — Landing page

Landing page institucional para Hotel La Gruta (Arequipa, Perú). Sitio estático: sin build, sin dependencias que instalar y sin framework. Se sirve tal cual desde cualquier hosting.

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
index.html          → markup de las 4 páginas (único archivo en la raíz)
assets/css/         → estilos
assets/js/          → interfaz, mapa y las dos capas botánicas
assets/vendor/      → librerías de terceros (Leaflet, BSD-2)
assets/img/         → fotos, separadas por uso (hero / rooms / hotel / pendientes)
docs/               → documentación y prototipos que no se publican
```

Los detalles de por qué está montado así —orden de carga, capas, apilamiento y
las perillas para ajustar las animaciones— están en
**[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)**.

### Añadir una foto

Deja el archivo en la carpeta que le corresponda y apunta el `src` ahí. Mientras
una foto no exista, el sitio muestra un marcador generado a partir del atributo
`data-ph` del `<img>` — no hace falta tocar nada más para que desaparezca.

Falta por subir: `assets/img/hotel/recepcion.jpg` (hoy se ve el marcador).

## Probar localmente

No requiere instalación. Basta un servidor estático simple:

```bash
python3 -m http.server 8000
```

Y abrir `http://localhost:8000/index.html`.

## Desplegar en otro hosting

No hay paso de build: lo que está en el repo es lo que se sube.

- **Plesk / cPanel / FTP** → copiar `index.html` y `assets/` dentro de
  `httpdocs` (o `public_html`). `docs/` no hace falta subirlo.
- **Netlify / Vercel / Cloudflare Pages** → conectar el repo. Comando de build:
  ninguno. Directorio de publicación: la raíz (`.`).
- **Bucket estático (S3, R2…)** → subir `index.html` y `assets/` conservando la
  estructura de carpetas, y marcar `index.html` como documento índice.

No hay claves ni tokens que configurar: el mapa usa Leaflet con tiles
públicas y la librería va dentro del repo (`assets/vendor/leaflet/`).

## Pendientes conocidos

- **Proveedor de tiles del mapa**: se usa Esri World Light Gray Canvas, gratis
  y sin cuenta desde hace más de una década (se probó primero con CARTO, que
  en 2024 empezó a exigir cuenta + API key y dejó de servir tiles anónimas —
  justo lo que se quería evitar al dejar Mapbox). Si algún día también lo
  cierran, el cambio es una constante: `TILES` en `assets/js/map.js`.
- **Foto de recepción**: falta `assets/img/hotel/recepcion.jpg`.
- **Fotos en alta resolución**: los originales actuales llegan a 1448×1086, lo
  que se nota en pantallas grandes. Harían falta a partir de ~2500 px de ancho.
- **Habitación cuádruple**: la foto ya está en `assets/img/pendientes/`, falta
  definir el texto para publicarla.
- **URLs reales por página**: hoy las cuatro páginas comparten dirección, lo que
  limita el posicionamiento en buscadores. Ver `docs/ARQUITECTURA.md`.
