import { useEffect, useId, useState, type PointerEvent } from 'react';
import { animate, motion, useMotionValue } from 'motion/react';
import { useReducedMotion } from '../../shared/motion/useReducedMotion';
export { FooterBackgroundGradient } from './footer-artwork';

type TextHoverEffectProps = {
  text: string;
  duration?: number;
  automatic?: boolean;
  className?: string;
};

/** Decorative only: navigation and the accessible brand stay in the layout. */
export function TextHoverEffect({
  text,
  duration = 0.28,
  automatic = false,
  className = '',
}: TextHoverEffectProps) {
  const id = useId().replace(/:/g, '');
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const cx = useMotionValue(400);
  const cy = useMotionValue(90);
  const gradientId = `${id}-gradient`;
  const revealId = `${id}-reveal`;
  const maskId = `${id}-mask`;

  useEffect(() => {
    if (reducedMotion) {
      cx.stop();
      cy.stop();
    }
  }, [reducedMotion, cx, cy]);

  function moveLight(event: PointerEvent<SVGSVGElement>) {
    if (reducedMotion || event.pointerType === 'touch') return;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const transition = { duration, ease: 'easeOut' as const };
    animate(cx, point.x, transition);
    animate(cy, point.y, transition);
  }

  return (
    <svg
      viewBox="0 0 800 180"
      width="800"
      height="180"
      aria-hidden="true"
      focusable="false"
      className={`hover-footer-wordmark block h-auto w-full select-none ${className}`}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch' && !reducedMotion) setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onPointerCancel={() => setHovered(false)}
      onPointerMove={moveLight}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="800"
          y2="180"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="35%" stopColor="var(--info)" />
          <stop offset="70%" stopColor="var(--focus)" />
          <stop offset="100%" stopColor="var(--positive)" />
        </linearGradient>
        <motion.radialGradient id={revealId} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r="210">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="800"
          height="180"
          style={{ maskType: 'luminance' }}
        >
          <rect width="800" height="180" fill={`url(#${revealId})`} />
        </mask>
      </defs>
      <motion.text
        className="hover-footer-outline"
        x="400"
        y="100"
        textAnchor="middle"
        dominantBaseline="middle"
        textLength="750"
        lengthAdjust="spacingAndGlyphs"
        initial={reducedMotion ? false : { strokeDashoffset: 1000 }}
        whileInView={{ strokeDashoffset: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: reducedMotion ? 0 : 2.4, ease: 'easeInOut' }}
        strokeDasharray={reducedMotion ? undefined : 1000}
      >
        {text}
      </motion.text>
      <motion.text
        className="hover-footer-highlight"
        x="400"
        y="100"
        textAnchor="middle"
        dominantBaseline="middle"
        textLength="750"
        lengthAdjust="spacingAndGlyphs"
        stroke={`url(#${gradientId})`}
        mask={`url(#${maskId})`}
        initial={false}
        animate={{ opacity: !reducedMotion && (hovered || automatic) ? 1 : 0 }}
        transition={{ duration: reducedMotion ? 0 : duration }}
      >
        {text}
      </motion.text>
    </svg>
  );
}
