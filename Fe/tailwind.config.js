import plugin from 'tailwindcss/plugin.js';
import { motion } from './config/tailwind/motion.js';
import { themeTokens, responsiveVariants } from './theme.config.js';
import { fileURLToPath, URL } from 'node:url';
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    fileURLToPath(new URL('./index.html', import.meta.url)),
    fileURLToPath(new URL('./src/**/*.{js,ts,jsx,tsx}', import.meta.url)),
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ...{
          page: 'var(--page)',
          surface: 'var(--surface)',
          raised: 'var(--surface-raised)',
          foreground: 'var(--text)',
          muted: 'var(--muted)',
          line: 'var(--line)',
          accent: 'var(--accent)',
          'accent-soft': 'var(--accent-soft)',
          'accent-hover': 'var(--accent-hover)',
          'on-accent': 'var(--on-accent)',
          'home-page': 'var(--home-page)',
          'home-elevated': 'var(--home-elevated)',
          'home-card': 'var(--home-card)',
          'home-hover': 'var(--home-hover)',
          'home-text': 'var(--home-text)',
          'home-secondary': 'var(--home-secondary)',
          'home-muted': 'var(--home-muted)',
          'home-line': 'var(--home-line)',
          'home-accent': 'var(--home-accent)',
          'home-accent-soft': 'var(--home-accent-soft)',
          'home-button': 'var(--home-button)',
          'home-button-text': 'var(--home-button-text)',
          'home-nav': 'var(--home-nav)',
        },
        primary: {
          50: '#effaff',
          100: '#dff6ff',
          200: '#bcecff',
          300: '#7dd8ff',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        ink: {
          50: '#f6fbff',
          100: '#e7f2f8',
          200: '#cfe3ee',
          300: '#a9c4d4',
          400: '#7896a7',
          500: '#587487',
          600: '#385569',
          700: '#233d51',
          800: '#142b3d',
          900: '#081b2d',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(8, 27, 45, 0.06), 0 1px 2px rgba(8, 27, 45, 0.04)',
        'card-hover': '0 14px 34px rgba(8, 27, 45, 0.12), 0 4px 10px rgba(8, 27, 45, 0.05)',
        elevated: '0 22px 52px rgba(8, 27, 45, 0.16)',
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      animation: {
        ...motion.animation,
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'slide-in': 'slideIn 0.4s ease-out',
      },
      keyframes: {
        ...motion.keyframes,
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [
    plugin(({ addBase, addVariant }) => {
      addBase(themeTokens);
      addVariant('legacy', '@scope (.legacy-site)');
      for (const [name, query] of Object.entries(responsiveVariants)) addVariant(name, query);
    }),
  ],
};
