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
  const reveal = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('wc-visible');
      reveal.unobserve(entry.target);
    });
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
  frames.forEach(frame => reveal.observe(frame));
  visibility.observe(section);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pageshow', schedule);
  reduced.addEventListener('change', preferences);
  desktop.addEventListener('change', preferences);
  preferences();
})();
