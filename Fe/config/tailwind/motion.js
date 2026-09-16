// Shared timing uses a quick start and a soft landing. No animation changes layout.
export const motion = {
  animation: {
    'reveal-up': 'revealUp 650ms cubic-bezier(0.22, 1, 0.36, 1) both',
    'hero-arrive': 'heroArrive 900ms cubic-bezier(0.22, 1, 0.36, 1) both',
    'menu-arrive': 'menuArrive 180ms ease-out both',
    'nav-arrive': 'navArrive 700ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
    'dock-arrive': 'dockArrive 680ms cubic-bezier(0.22, 1, 0.36, 1) both',
    'reveal-left': 'revealLeft 760ms cubic-bezier(0.22, 1, 0.36, 1) both',
    'reveal-scale': 'revealScale 720ms cubic-bezier(0.22, 1, 0.36, 1) both',
    'ambient-drift': 'ambientDrift 16s ease-in-out infinite alternate',
    'glow-pulse': 'glowPulse 2.8s ease-in-out infinite',
  },
  keyframes: {
    revealUp: {
      from: { opacity: '0', translate: '0 18px' },
      to: { opacity: '1', translate: '0 0' },
    },
    heroArrive: {
      from: { opacity: '0', translate: '0 24px', scale: '0.98' },
      to: { opacity: '1', translate: '0 0', scale: '1' },
    },
    menuArrive: {
      from: { opacity: '0', translate: '0 -5px' },
      to: { opacity: '1', translate: '0 0' },
    },
    navArrive: {
      from: { opacity: '0', translate: '0 -100%' },
      '55%': { opacity: '0.65' },
      to: { opacity: '1', translate: '0 0' },
    },
    dockArrive: {
      from: { opacity: '0', translate: '0 calc(100% + 32px)', scale: '0.98' },
      to: { opacity: '1', translate: '0 0', scale: '1' },
    },
    revealLeft: {
      from: { opacity: '0', translate: '-30px 0' },
      to: { opacity: '1', translate: '0 0' },
    },
    revealScale: {
      from: { opacity: '0', translate: '0 20px', scale: '0.965' },
      to: { opacity: '1', translate: '0 0', scale: '1' },
    },
    ambientDrift: {
      from: { transform: 'scale(1.02) translate3d(-0.5%, -0.5%, 0)' },
      to: { transform: 'scale(1.08) translate3d(0.8%, 0.5%, 0)' },
    },
    glowPulse: {
      '0%, 100%': { opacity: '0.65', boxShadow: '0 0 0 4px #65cfff12' },
      '50%': { opacity: '1', boxShadow: '0 0 0 9px #65cfff08' },
    },
  },
};
