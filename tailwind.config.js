/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        card: 'var(--card)',
        card2: 'var(--card2)',
        paper: 'var(--paper)',
        'paper-ink': 'var(--paper-ink)',
        line: 'var(--line)',
        fg: 'var(--fg)',
        muted: 'var(--muted)',
        lime: 'var(--lime)',
        'lime-ink': 'var(--lime-ink)',
        lav: 'var(--lav)',
        'lav-ink': 'var(--lav-ink)',
        hi: 'var(--hi)',
        'hi-ink': 'var(--hi-ink)',
        pill: 'var(--pill)',
        'pill-fg': 'var(--pill-fg)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Unbounded', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
