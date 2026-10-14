/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f5f7f6',
        surface: '#ffffff',
        line: '#d8dddb',
        line2: '#e6eae8',
        ink: {
          DEFAULT: '#1d2522',
          strong: '#101713',
          soft: '#33403c',
          muted: '#596561',
          faint: '#6f7b77',
          dim: '#87908d',
          ghost: '#aab3ae',
        },
        accent: {
          DEFAULT: '#0d9488',
          dark: '#0f766e',
          tint: '#dff5f1',
        },
        ai: {
          DEFAULT: '#5b67d6',
          tint: '#eaedff',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '18px',
      },
      boxShadow: {
        pop: '0 18px 50px -28px rgba(16, 23, 19, 0.28)',
      },
    },
  },
  plugins: [],
}