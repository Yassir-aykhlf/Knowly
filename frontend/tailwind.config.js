/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Figma fill tokens
        canvas: '#F6F8F7',       // sidebar / outer bg
        'canvas-main': '#F7F9F8', // main content area bg
        surface: '#FFFFFF',      // card / panel bg
        'surface-raised': '#FBFCFB', // hover state surface
        line: '#E7EAE8',         // primary border (fill_0073c8af)
        line2: '#E2E6E4',        // secondary border (fill_b8be69ae)
        'line3': '#D8DDDB',      // input border (fill_27304d4b)
        'line4': '#EEF1EF',      // card row separator (fill_fb7ac480)
        ink: {
          DEFAULT: '#1A201E',    // fill_b9ac3ebc – headings, strong
          strong: '#101713',
          soft: '#2B3633',       // fill_ef505f88 – body text
          muted: '#5A6863',      // fill_0fbc7a7e – excerpt text
          faint: '#7D8A85',      // fill_0578919e – meta text
          dim: '#8A958F',        // fill_afbc985e – placeholder/ghost
          ghost: '#A4AFAA',      // fill_65c409ab – timestamps
        },
        accent: {
          DEFAULT: '#0D9488',
          dark: '#0F766E',
          tint: '#E6F4F1',       // fill used for vote-up bg
          subtle: 'rgba(13,148,136,0.08)', // nav active bg
        },
        ai: {
          DEFAULT: '#5B5BD6',    // fill_dd529102
          tint: '#EEF0FB',       // fill_562c99b2
        },
        // avatar palette colours (for badges)
        'badge-blue': '#3F7CAC',   // fill_64dc6d7d
        'badge-green': '#7A8A3F',  // fill_5437f841
        'badge-orange': '#C2683B', // fill_db96708b
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Bricolage Grotesque', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['10.5px', { lineHeight: '15.75px' }],
        'tag': ['11.5px', { lineHeight: '17.25px' }],
        'meta': ['12px', { lineHeight: '18px' }],
        'body-sm': ['13px', { lineHeight: '19.5px' }],
        'body': ['14px', { lineHeight: '21px' }],
        'body-md': ['14.5px', { lineHeight: '21.75px' }],
        'body-lg': ['15px', { lineHeight: '25.5px' }],
        'body-xl': ['15.5px', { lineHeight: '26.35px' }],
        'title-sm': ['17px', { lineHeight: '22.95px', letterSpacing: '-0.01em' }],
        'title': ['21px', { lineHeight: '31.5px', letterSpacing: '-0.02em' }],
        'heading-sm': ['20px', { lineHeight: '30px' }],
        'heading': ['28px', { lineHeight: '33.6px', letterSpacing: '-0.025em' }],
        'display-sm': ['22px', { lineHeight: '33px', letterSpacing: '-0.02em' }],
        'display': ['32px', { lineHeight: '48px', letterSpacing: '-0.03em' }],
      },
      borderRadius: {
        card: '14px',     // answer / question detail cards
        panel: '18px',   // old card value (keep compat)
        btn: '10px',
        tag: '6px',
        badge: '100px',
        'avatar-sm': '11px',
        'avatar-md': '15px',
        'avatar-lg': '21px',
        'avatar-xl': '17px',
      },
      boxShadow: {
        pop: '0 18px 50px -28px rgba(16, 23, 19, 0.28)',
        card: '0px 1px 2px 0px rgba(20, 40, 36, 0.06)',
      },
      spacing: {
        sidebar: '262px',
        'main-px': '40px',
      },
    },
  },
  plugins: [],
}