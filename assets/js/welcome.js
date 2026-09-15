/* Collage de bienvenida: revelado individual + parallax dentro del recorte.
   Independiente de la navegación, del revelado global y de la vegetación. */
(() => {
  const section = document.querySelector('.welcome');
  if (!section || !('IntersectionObserver' in window)) return;
  const frames = [...section.querySelectorAll('.wc-img')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 901px)');
  let active = false;
  let frameId = 0;

  function paint() {
    frameId = 0;
    if (!active || reduced.matches || !desktop.matches) return;
    // Primero todas las lecturas; después todas las escrituras.
    const shifts = frames.map(frame => {
      const rect = frame.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1,
        (innerHeight - rect.top) / (innerHeight + rect.height)));
      return (progress * 16 - 8).toFixed(3) + '%';
    });
    frames.forEach((frame, i) => frame.style.setProperty('--wc-shift', shifts[i]));
  }
  function schedule() {
    if (active && !reduced.matches && desktop.matches && !frameId) {
      frameId = requestAnimationFrame(paint);
    }
  }
  /* Observa la SECCIÓN, no cada foto: el estado "sin revelar" de cada foto
     es clip-path:inset(0 0 100% 0) (ver site.css), y en Chromium eso hace
     que su propia intersección se mida como 0 aunque esté clavada en medio
     del viewport — la foto nunca cruza el threshold porque el observer la
     ve "clipeada a la nada", así que jamás recibe wc-visible y queda
     invisible para siempre. Comprobado: quitarle el clip-path a mano hace
     que el mismo observer pase de ratio 0 a ratio 1 al instante. Observar
     `section` (que no tiene clip-path propio) evita el problema de raíz;
     el escalonado entre fotos lo da el transition-delay por nth-child en
     site.css, no el momento en que cada una dispara su propio observer. */
  const reveal = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    frames.forEach(frame => frame.classList.add('wc-visible'));
    reveal.unobserve(section);
  }, { threshold: 0.08 });
  const visibility = new IntersectionObserver(entries => {
    active = entries[0].isIntersecting;
    schedule();
  }, { rootMargin: '100px' });

  function preferences() {
    section.classList.toggle('welcome-motion', !reduced.matches);
    frames.forEach(frame => frame.style.removeProperty('--wc-shift'));
    schedule();
  }
  reveal.observe(section);
  visibility.observe(section);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pageshow', schedule);
  reduced.addEventListener('change', preferences);
  desktop.addEventListener('change', preferences);
  preferences();
})();

/* "Un jardín para descansar": mismo revelado en cortina + respiración que
   el collage de arriba, pero sin el parallax de scroll (esas dos fotos no
   tienen el recorte alto-y-desplazable de .wc-img, así que no hace falta
   el requestAnimationFrame de paint() — la respiración es una animación
   CSS pura, arranca sola en cuanto se agrega jardin-visible). Reutiliza
   el mismo motivo de "observar la sección, no cada foto clipeada" que ya
   está documentado arriba. */
(() => {
  const section = document.querySelector('.jardin-sec');
  if (!section || !('IntersectionObserver' in window)) return;
  const frames = [...section.querySelectorAll('.jardin-img')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const reveal = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    frames.forEach(frame => frame.classList.add('jardin-visible'));
    reveal.unobserve(section);
  }, { threshold: 0.08 });

  function preferences() {
    section.classList.toggle('jardin-motion', !reduced.matches);
  }
  reveal.observe(section);
  reduced.addEventListener('change', preferences);
  preferences();
})();
