/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Enable class-based dark mode
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#0073ea',
          foreground: 'hsl(0 0% 100%)',
        },
        success: {
          DEFAULT: '#00854d',
        },
        error: {
          DEFAULT: '#d83a52',
        },
        warning: {
          DEFAULT: '#ffcb00',
        },
        secondary: {
          DEFAULT: 'hsl(210 40% 96.1%)',
          foreground: 'hsl(222.2 47.4% 11.2%)',
        },
        muted: {
          DEFAULT: 'hsl(0 0% 95%)',
          foreground: 'hsl(0 0% 36%)',
        },
        destructive: {
          DEFAULT: 'hsl(0 84.2% 60.2%)',
          foreground: 'hsl(210 40% 98%)',
        },
        border: 'hsl(0 0% 90%)',
        input: 'hsl(0 0% 90%)',
        ring: '#0073ea',
      },
      borderRadius: {
        lg: '1rem', // 16px to match Monday Vibe "big" radius
        md: '0.5rem',
        sm: '0.25rem',
      },
    },
  },
  plugins: [],
}
