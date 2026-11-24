import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'rgb(var(--brand-primary-rgb) / <alpha-value>)',
          hover: 'rgb(var(--brand-primary-hover-rgb) / <alpha-value>)',
          soft: 'var(--brand-primary-soft)',
        },
        accent: {
          pulse: 'rgb(var(--accent-pulse-rgb) / <alpha-value>)',
          'pulse-soft': 'var(--accent-pulse-soft)',
        },
        surface: {
          base: 'rgb(var(--surface-base-rgb) / <alpha-value>)',
          elevated: 'rgb(var(--surface-elevated-rgb) / <alpha-value>)',
          subtle: 'rgb(var(--surface-subtle-rgb) / <alpha-value>)',
        },
        border: {
          default: 'rgb(var(--border-default-rgb) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
        },
        srs: {
          again: 'rgb(var(--srs-again-rgb) / <alpha-value>)',
          hard: 'rgb(var(--srs-hard-rgb) / <alpha-value>)',
          good: 'rgb(var(--srs-good-rgb) / <alpha-value>)',
          easy: 'rgb(var(--srs-easy-rgb) / <alpha-value>)',
        },
        status: {
          danger: 'rgb(var(--status-danger-rgb) / <alpha-value>)',
          warning: 'rgb(var(--status-warning-rgb) / <alpha-value>)',
          success: 'rgb(var(--status-success-rgb) / <alpha-value>)',
          info: 'rgb(var(--status-info-rgb) / <alpha-value>)',
        },
      },
      fontFamily: {
        arabic: ['"Alan Sans"', 'system-ui', 'sans-serif'],
        heading: ['"Alan Sans"', 'system-ui', 'sans-serif'],
        sans: ['"Alan Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        card: 'var(--radius-card)',
        control: 'var(--radius-control)',
      },
      spacing: {
        'rail-expanded': '240px',
        'rail-collapsed': '72px',
        'top-strip': '56px',
      },
    },
  },
  plugins: [],
};

export default config;
