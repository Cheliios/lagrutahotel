# Reglas de trabajo — Hotel La Gruta

Sitio estático (HTML/CSS/JS puro, sin build) que se sirve directo en WordPress/hosting.
Varios agentes trabajan en paralelo sobre este repo. Estas reglas existen para que no se
pisen entre sí ni rompan `master`.

## 1. Nunca push directo a `master`

Todo cambio va en una rama propia y se integra vía Pull Request. `master` es siempre la
versión que se puede mandar a producción sin revisar de nuevo.

## 2. Plan previo solo cuando la tarea lo amerita

Si el pedido es puntual y claro (un archivo, un cambio concreto: mover un elemento, cambiar
un color, un typo, un ajuste de una línea) — ejecutar directo, sin pausa.

Si el pedido es ambiguo ("mejora esto", "arregla el diseño") o toca más de un
archivo/sección, primero decir en 2-3 líneas:
- qué archivo(s)/sección(es) se va a tocar,
- qué cambia y por qué,
- qué NO se va a tocar.

Esperar aprobación antes de ejecutar solo en ese caso. La duda se resuelve para el lado de
ejecutar rápido, no de pausar de más.

## 3. Scope por dominio — no tocar fuera de tu área

Si hay más de un agente trabajando a la vez, cada uno se mantiene dentro de su dominio
asignado (ej: solo `assets/css/`, o solo la sección de rooms en `index.html`, o solo
`assets/js/`). Si una tarea requiere tocar el dominio de otro agente, decirlo explícito
antes de hacerlo, no hacerlo en silencio.

## 4. Un cambio = un problema puntual, no reescrituras

Evitar reescribir secciones enteras cuando el pedido es un ajuste puntual (mover un
elemento, cambiar un color, arreglar un espaciado). Este proyecto ya tuvo varios ciclos de
"arreglo A tapa B → fix B rompe C" por cambios más amplios de lo necesario — preferir el
diff mínimo que resuelve el problema pedido.

## 5. Antes de dar por terminado un cambio visual

- Revisar el resultado en mobile y desktop (el sitio usa capas de vegetación/mapa que se
  comportan distinto por ancho — ver `docs/ARQUITECTURA.md`).
- No asumir que un fix en una sección no afecta a las vecinas; el layout usa posicionamiento
  y capas superpuestas en varios puntos.

## 6. Commits y PRs

- Mensajes de commit descriptivos en español, formato `tipo(scope): qué cambia`
  (ya es el estilo del historial — mantenerlo).
- El PR debe explicar qué se tocó y qué se probó (mobile/desktop), no solo "fix".
