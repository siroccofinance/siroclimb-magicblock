// Live, resolution-independent Sirocco hero: mounts the WebGL scene in a container.
//   import { mountSiroccoHero } from './sirocco-hero.js';
//   const hero = mountSiroccoHero(document.querySelector('.hero-visual'));
//   hero.destroy();
// Needs `three@0.160.0` (npm i three@0.160.0, or an import map).
import { createSiroccoScene, LOOP_SECONDS } from './sirocco-coin-scene.js';

/**
 * @param {HTMLElement} container  element to fill (give it a size in CSS)
 * @param {object} [o]
 * @param {'auto'|'hero'|'center'|'mobile'} [o.framing='auto']  auto = 'hero' in landscape, 'mobile' in portrait
 * @param {number} [o.maxPixelRatio=2]
 * @param {boolean} [o.bloom=true]
 * @param {number} [o.speed=1]
 * @param {(ok:boolean)=>void} [o.onReady]  false when WebGL is unavailable: keep the video/poster fallback
 */
export function mountSiroccoHero(container, { framing = 'auto', maxPixelRatio = 2, bloom = true, speed = 1, onReady } = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%' });

  let scene;
  try {
    const { width, height } = container.getBoundingClientRect();
    scene = createSiroccoScene({ canvas, width: Math.max(1, width), height: Math.max(1, height), pixelRatio: Math.min(devicePixelRatio, maxPixelRatio), framing: pick(width, height), bloom });
  } catch (e) {
    onReady?.(false);
    return { destroy() {} };
  }
  container.appendChild(canvas);

  function pick(w, h) { return framing !== 'auto' ? framing : w / h < 1 ? 'mobile' : 'hero'; }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let raf = 0, visible = true, last = performance.now(), t = 0.35;

  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    scene.setSize(width, height, Math.min(devicePixelRatio, maxPixelRatio), pick(width, height));
    if (!raf) scene.render(t);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  const tick = now => {
    raf = 0;
    // the scene at t + LOOP_SECONDS is identical to t (camera two steps higher), so wrap
    t = (t + Math.min(0.1, (now - last) / 1000) * speed) % LOOP_SECONDS;
    last = now;
    scene.render(t);
    schedule();
  };
  const schedule = () => {
    if (!raf && visible && !document.hidden && !reduced.matches) { last = performance.now(); raf = requestAnimationFrame(tick); }
  };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? schedule() : stop(); });
  io.observe(container);
  const onVis = () => (document.hidden ? stop() : schedule());
  document.addEventListener('visibilitychange', onVis);
  const onMotion = () => (reduced.matches ? (stop(), scene.render(t)) : schedule());
  reduced.addEventListener('change', onMotion);

  scene.render(t);
  schedule();
  onReady?.(true);

  return {
    destroy() {
      stop(); ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      reduced.removeEventListener('change', onMotion);
      scene.dispose(); canvas.remove();
    },
  };
}
