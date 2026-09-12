/* =============================================================================
   app.js — Interfaz del sitio
   Menú, navegación entre páginas (SPA falsa), revelado al hacer scroll,
   formulario de reservas y marcador para las fotos que aún faltan.
   ============================================================================= */

// ⚠️ NÚMERO DE PRUEBAS — no es el del hotel. Piero lo usa para probar el flujo
// de WhatsApp sin molestar la línea real. Antes de fusionar a master o de
// mandarle el link a Carmen, volver a '51959344759'.
const WA_NUMBER = '51948016484';

const burger=document.getElementById('burger'), menu=document.getElementById('menu');
let menuOpen=false;
burger.addEventListener('click',()=>{ menuOpen=!menuOpen; burger.classList.toggle('open',menuOpen); menu.classList.toggle('open',menuOpen); });

// Enrutamiento por hash: cada página tiene su propio #hash (#home, #rooms,
// #location, #reservas, #experiencias), igual que su data-page. Sirve para
// compartir un link directo a una sección, para que recargar no vuelva
// siempre a Inicio, y para que el botón atrás/adelante del navegador
// funcione, aunque esto siga siendo una SPA de una sola página.
function pageExists(page){ return !!document.getElementById('page-'+page); }
function pageFromHash(){ const p = location.hash.slice(1); return pageExists(p) ? p : null; }

let current='home';
const pt=document.getElementById('pt');
function goTo(page){
  if(page===current){ if(menuOpen){menuOpen=false;burger.classList.remove('open');menu.classList.remove('open');} return; }
  menuOpen=false; burger.classList.remove('open'); menu.classList.remove('open');
  pt.className='pt in';
  setTimeout(()=>{
    document.getElementById('page-'+current).classList.remove('active');
    document.getElementById('page-'+page).classList.add('active');
    current=page; window.scrollTo(0,0); reAnim(page); window.vinesRefresh?.(); navColor();
    // location.hash (no history.replaceState) a propósito: así el atrás del
    // navegador funciona. No genera un bucle con el listener de hashchange de
    // más abajo porque `current` ya quedó al día en la línea de arriba, y ese
    // listener llama a goTo(), que se sale de inmediato si page===current.
    // Inicio se representa con hash vacío, no "#home": si en vez de eso se
    // forzara location.hash='home' cada vez que el atrás del navegador cae en
    // el hash vacío original, se pisaría la pila de "adelante" (el hash pasa
    // de '' a 'home', un valor distinto, así que el navegador lo trata como
    // una navegación nueva y descarta el "adelante" que hubiera).
    const wantHash = page==='home' ? '' : page;
    if(location.hash.slice(1)!==wantHash) location.hash = wantHash;
    // `invalidateSize` es el equivalente en Leaflet a un resize: el contenedor
    // acaba de hacerse visible y el mapa se midió cuando aún valía 0.
    if(page==='location'){ window.initLocMap?.(); setTimeout(()=>window.locMap?.invalidateSize(),560); }
    pt.className='pt out'; setTimeout(()=>pt.className='pt',520);
  },520);
}
document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();goTo(el.dataset.page);}));

// Si la página se carga con un hash presente (link directo o recarga), se
// abre esa sección de una vez. El cambio se hace "a mano" en vez de con
// goTo(): goTo() dispara la transición animada y reAnim() (pensada para
// RE-lanzar animaciones que ya se reprodujeron al cambiar de página) —
// ninguna de las dos hace falta en la primera carga, y llamarlas aquí, antes
// de que existan navEl/navColor/initLocMap (se definen más abajo o en
// map.js, que corre después de este script), rompería con un error de
// referencia.
const inicial = pageFromHash();
if(inicial && inicial!==current){
  document.getElementById('page-'+current).classList.remove('active');
  document.getElementById('page-'+inicial).classList.add('active');
  current = inicial;
}

function reAnim(page){
  document.querySelectorAll('#page-'+page+' .hw').forEach((el,i)=>{ el.style.animation='none'; el.offsetHeight; el.style.animation=''; el.style.animationDelay=(0.35+i*.15)+'s'; });
  document.querySelectorAll('#page-'+page+' .rv-el').forEach(el=>el.classList.remove('on'));
  setTimeout(obs,80);
}
function obs(){
  const o=new IntersectionObserver(en=>{ en.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('on'); o.unobserve(e.target);} }); },{threshold:.12});
  document.querySelectorAll('.page.active .rv-el').forEach(el=>o.observe(el));
}
obs(); // ya observa la página correcta: el swap por hash de arriba ya ocurrió

const navEl=document.getElementById('nav');
// La barra es blanca sobre la foto oscura del hero y se oscurece al pasarla.
// Ubicación no tiene hero: arranca con el mapa, que es claro, así que ahí el
// texto blanco quedaba ilegible. Si la página activa no trae hero, va oscura
// desde el principio.
function navColor(){
  const activa = document.querySelector('.page.active');
  const conHero = !!activa?.querySelector('.hero');
  navEl.classList.toggle('dark', !conHero || window.scrollY > window.innerHeight*.82);
}
window.addEventListener('scroll',navColor);
navColor(); // por si la carga inicial ya abrió, vía hash, una página sin hero

// El mapa de Ubicación se inicializa bajo demanda; si la carga inicial ya
// apunta ahí (#location), hay que dispararlo igual. Pero recién cuando exista
// window.initLocMap: lo define map.js, que va después de este script en el
// <head> y con `defer`, así que a esta altura del archivo todavía no corrió.
// setTimeout(...,0) lo pospone a la cola de tareas, momento en el que map.js
// ya se ejecutó por completo.
if(current==='location') setTimeout(()=>window.initLocMap?.(),0);

// Atrás/adelante del navegador, o alguien que edita el hash a mano estando ya
// en la página: se sigue igual que un click en el menú.
window.addEventListener('hashchange', () => goTo(pageFromHash() || 'home'));

/* ── Formulario de reservas → WhatsApp / correo ── */
const rvForm = document.getElementById('reservaForm');
if (rvForm) {
  const HOTEL_EMAIL = 'lagruta@lagrutahotel.com';
  const val = n => (rvForm.elements[n]?.value || '').trim();
  function buildMessage(){
    return [
      'Hola, quisiera consultar disponibilidad en Hotel La Gruta:',
      `Nombre: ${val('nombre')}`,
      `Teléfono: ${val('telefono')}`,
      val('correo') && `Correo: ${val('correo')}`,
      `Habitación: ${val('habitacion') || 'Sin preferencia'}`,
      `Huéspedes: ${val('huespedes') || '1'}`,
      `Llegada: ${val('llegada')}`,
      `Salida: ${val('salida')}`,
      val('mensaje') && `Mensaje: ${val('mensaje')}`,
    ].filter(Boolean).join('\n');
  }
  const note = document.getElementById('reservaNote');
  rvForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!rvForm.checkValidity()) { rvForm.reportValidity(); return; }
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(buildMessage())}`, '_blank');
    if (note) note.textContent = 'Se abrió WhatsApp con tu solicitud lista para enviar.';
  });
  document.getElementById('reservaMailto')?.addEventListener('click', e => {
    e.preventDefault();
    if (!rvForm.checkValidity()) { rvForm.reportValidity(); return; }
    const subject = encodeURIComponent(`Solicitud de reserva — ${val('nombre')}`);
    location.href = `mailto:${HOTEL_EMAIL}?subject=${subject}&body=${encodeURIComponent(buildMessage())}`;
    if (note) note.textContent = 'Se abrió tu cliente de correo con la solicitud lista para enviar.';
  });
}

/* ── Barra de disponibilidad del hero → consulta directa por WhatsApp ── */
document.querySelectorAll('.avail-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const box = btn.closest('.avail');
    const [checkin, checkout] = box.querySelectorAll('.avail-i');
    const guests = box.querySelector('.avail-s')?.value || '';
    const lines = [
      'Hola, quisiera consultar disponibilidad en Hotel La Gruta:',
      checkin?.value && `Llegada: ${checkin.value}`,
      checkout?.value && `Salida: ${checkout.value}`,
      guests && `Huéspedes: ${guests}`,
    ].filter(Boolean);
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  });
});

/* ── Imágenes pendientes ──
   Varias fotos del hotel todavía no existen en el repo. En vez de repetir un
   data-URI gigante en cada <img> (eran ~14 KB de ruido dentro del HTML), se
   genera aquí el marcador a partir de `data-ph`.
   El listener va en fase de CAPTURA porque el evento `error` de <img> no
   burbujea; y además se repasan las que ya hubieran fallado antes de que este
   script llegara a ejecutarse. */
(function () {
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  function marcador(img) {
    if (img.dataset.phDone) return;
    img.dataset.phDone = '1';
    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#4A6146"/><stop offset="1" stop-color="#2E3E2B"/>' +
        '</linearGradient></defs>' +
        '<rect width="800" height="600" fill="url(#g)"/>' +
        '<text x="50%" y="50%" font-family="Georgia,serif" font-style="italic" font-size="46" ' +
              'fill="rgba(255,255,255,0.4)" text-anchor="middle" dominant-baseline="middle">' +
          esc(img.dataset.ph || '') +
        '</text>' +
      '</svg>');
  }

  document.addEventListener('error', function (e) {
    var img = e.target;
    if (img && img.tagName === 'IMG' && img.dataset.ph) marcador(img);
  }, true);

  document.querySelectorAll('img[data-ph]').forEach(function (img) {
    if (img.complete && img.naturalWidth === 0) marcador(img);
  });
})();
