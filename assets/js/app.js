/* =============================================================================
   app.js — Interfaz del sitio
   Menú, navegación entre páginas (SPA falsa), revelado al hacer scroll,
   formulario de reservas y marcador para las fotos que aún faltan.
   ============================================================================= */

// Número real del hotel: mismo que usan los links directos de wa.me de
// Experiencias y de los botones flotante/CTA del sitio.
const WA_NUMBER = '51959344759';

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
    if(page==='location'){ ensureLocMap(); setTimeout(()=>window.locMap?.invalidateSize(),560); }
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

const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Revelado de texto: títulos por palabra + párrafos en bloque ──
   [data-reveal="words"] trae su texto normal (con <em>/<br> incluidos si los
   tiene) en el HTML; acá se envuelve cada palabra en .rw > .rw-in una sola
   vez (dataset.split lo marca para no reprocesar en cada cambio de página).
   La recursión conserva las etiquetas inline (por eso <em> sigue en cursiva
   y <br> sigue partiendo línea) — un innerHTML=textContent las habría
   perdido. */
function splitWords(node){
  Array.from(node.childNodes).forEach(child=>{
    if(child.nodeType===Node.TEXT_NODE){
      if(!child.textContent.trim()) return;
      const frag=document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach(part=>{
        if(part==='') return;
        if(/^\s+$/.test(part)){ frag.appendChild(document.createTextNode(part)); return; }
        const outer=document.createElement('span'); outer.className='rw';
        const inner=document.createElement('span'); inner.className='rw-in'; inner.textContent=part;
        outer.appendChild(inner); frag.appendChild(outer);
      });
      child.replaceWith(frag);
    } else if(child.nodeType===Node.ELEMENT_NODE && child.tagName!=='BR'){
      splitWords(child);
    }
  });
}
if(!REDUCED_MOTION){
  document.querySelectorAll('[data-reveal="words"]').forEach(el=>{
    if(el.dataset.split) return;
    el.dataset.split='1';
    splitWords(el);
  });
}

function reAnim(page){
  document.querySelectorAll('#page-'+page+' .hw').forEach((el,i)=>{ el.style.animation='none'; el.offsetHeight; el.style.animation=''; el.style.animationDelay=(0.35+i*.15)+'s'; });
  document.querySelectorAll('#page-'+page+' .rv-el').forEach(el=>el.classList.remove('on'));
  document.querySelectorAll('#page-'+page+' .rw-in').forEach(el=>{ el.classList.remove('on'); el.style.transitionDelay=''; });
  document.querySelectorAll('#page-'+page+' [data-reveal="fade"]').forEach(el=>el.classList.remove('on'));
  setTimeout(obs,80);
}
function obs(){
  const o=new IntersectionObserver(en=>{ en.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('on'); o.unobserve(e.target);} }); },{threshold:.12});
  document.querySelectorAll('.page.active .rv-el').forEach(el=>o.observe(el));

  if(REDUCED_MOTION) return; // ya visibles de una: la regla reduced-motion de site.css les quita transform/opacity

  // Palabras: 40ms de diferencia entre una y la siguiente (transitionDelay
  // por índice), y una sola vez por visita a la página — igual criterio que
  // .rv-el arriba: unobserve() al disparar, reset en reAnim() al volver.
  const wo=new IntersectionObserver(en=>{ en.forEach(e=>{
    if(!e.isIntersecting) return;
    e.target.querySelectorAll('.rw-in').forEach((span,i)=>{ span.style.transitionDelay=(i*40)+'ms'; span.classList.add('on'); });
    wo.unobserve(e.target);
  }); },{threshold:.2});
  document.querySelectorAll('.page.active [data-reveal="words"]').forEach(el=>wo.observe(el));

  const fo=new IntersectionObserver(en=>{ en.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('on'); fo.unobserve(e.target);} }); },{threshold:.2});
  document.querySelectorAll('.page.active [data-reveal="fade"]').forEach(el=>fo.observe(el));
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

/* ── Carga de Leaflet bajo demanda ──
   Antes vivía en <head> y se descargaba en las 5 páginas aunque solo
   Ubicación lo usa (~164KB de biblioteca + tiles que nadie más pide). Se
   inyecta la primera vez que hace falta el mapa, memoizado para no
   repetirlo si el visitante entra y sale de Ubicación varias veces.
   El <link> de Leaflet se inserta ANTES que site.css en el <head> (no al
   final): site.css sobrescribe el estilo del marcador y los controles, y
   esa cascada depende de que Leaflet cargue primero — insertarlo después
   invertiría el orden y esos estilos dejarían de aplicar. */
let leafletReady = null;
function loadLeaflet(){
  if(window.L) return Promise.resolve();
  if(leafletReady) return leafletReady;
  leafletReady = new Promise((resolve, reject) => {
    const siteCss = document.querySelector('link[href="assets/css/site.css"]');
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'assets/vendor/leaflet/leaflet.css';
    siteCss.parentNode.insertBefore(css, siteCss);
    const script = document.createElement('script');
    script.src = 'assets/vendor/leaflet/leaflet.js';
    script.onload = resolve; script.onerror = reject;
    document.head.appendChild(script);
  });
  return leafletReady;
}
function ensureLocMap(){ loadLeaflet().then(() => window.initLocMap?.()); }

// El mapa de Ubicación se inicializa bajo demanda; si la carga inicial ya
// apunta ahí (#location), hay que dispararlo igual.
if(current==='location') ensureLocMap();

// Atrás/adelante del navegador, o alguien que edita el hash a mano estando ya
// en la página: se sigue igual que un click en el menú.
window.addEventListener('hashchange', () => goTo(pageFromHash() || 'home'));

/* ── Preloader ──
   Mínimo 1.4s en pantalla Y (evento `load` + imagen del hero de la página
   activa cargada, lo que termine último), con un techo duro de 3.5s por si
   algún recurso ajeno al hero se demora. Si ya se mostró en esta pestaña
   (sessionStorage) o hay prefers-reduced-motion, el <script> inline del
   <head> del body ya marcó <html class="no-preload"> antes de que esto
   corriera — acá solo hace falta sacar el nodo del DOM sin animar nada. */
(function preloader(){
  const pre = document.getElementById('preloader');
  const shell = document.getElementById('app-shell');
  if(!pre) return;

  if(document.documentElement.classList.contains('no-preload')){
    pre.remove();
    return;
  }

  sessionStorage.setItem('lg_preloaded','1');
  shell.classList.add('pre-reveal');

  const MIN=1400, MAX=3500, start=Date.now();
  let done=false;
  function reveal(){
    if(done) return;
    done=true;
    pre.classList.add('hide');
    shell.classList.remove('pre-reveal'); // scale(1.03) → scale(1) en sincro con el fundido del overlay
    setTimeout(()=>pre.remove(),700);
  }
  function armWhenReady(){
    setTimeout(reveal, Math.max(0, MIN-(Date.now()-start)));
  }

  const heroImg = document.querySelector('.page.active .hero-media img');
  const loadReady = new Promise(res=>{
    if(document.readyState==='complete') return res();
    window.addEventListener('load', res, {once:true});
  });
  const heroReady = new Promise(res=>{
    if(!heroImg || heroImg.complete) return res();
    heroImg.addEventListener('load', res, {once:true});
    heroImg.addEventListener('error', res, {once:true}); // el placeholder también cuenta como "ya está"
  });

  Promise.race([
    Promise.all([loadReady, heroReady]),
    new Promise(res=>setTimeout(res, MAX)),
  ]).then(armWhenReady);
})();

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
