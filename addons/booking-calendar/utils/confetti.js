// A one-shot confetti burst from an element, with the Web Animations API (no deps).
// Does nothing for visitors who asked for reduced motion.

export function confettiBurst(anchor, colors, count = 120) {
  if (typeof window === 'undefined' || !document.body?.animate) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const rect = anchor?.getBoundingClientRect?.();
  const x0 = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const y0 = rect ? rect.top + rect.height / 2 : window.innerHeight / 3;

  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:9999';
  document.body.appendChild(layer);

  const gravity = 1400; // px/s²
  let pending = count;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    const w = 6 + Math.random() * 7;
    const h = Math.random() < 0.3 ? w : w * (0.35 + Math.random() * 0.4);
    piece.style.cssText = `position:absolute;left:${x0}px;top:${y0}px;width:${w}px;height:${h}px;`
      + `background:${colors[i % colors.length]};border-radius:${h === w ? '50%' : '2px'}`;
    layer.appendChild(piece);

    // Mostly upwards, fanning out; then gravity pulls everything down past the fold.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
    const speed = 450 + Math.random() * 550;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const spin = (Math.random() * 2 - 1) * 900;
    const duration = 1.8 + Math.random() * 1.2;

    const frames = [];
    for (let k = 0; k <= 10; k++) {
      const t = (k / 10) * duration;
      const x = vx * t * (1 - t / (duration * 2.2)); // air drag on the horizontal
      const y = vy * t + 0.5 * gravity * t * t;
      frames.push({
        transform: `translate(${x}px, ${y}px) rotate(${spin * t}deg) rotateY(${spin * t * 1.5}deg)`,
        opacity: k < 7 ? 1 : 1 - (k - 7) / 3,
      });
    }
    const anim = piece.animate(frames, { duration: duration * 1000, easing: 'linear', fill: 'forwards' });
    anim.onfinish = () => {
      piece.remove();
      if (--pending === 0) layer.remove();
    };
  }
}
