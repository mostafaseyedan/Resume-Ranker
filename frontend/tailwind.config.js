/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        // Monday-blue brand accent: single source of truth for primary actions,
        // selection, focus rings, and active tabs.
        brand: {
          DEFAULT: '#0073ea',
          hover: '#0060c2',
          soft: '#cce4fb',
          fg: '#ffffff',
          ink: '#004f9f',
          'on-dark': '#5eb3ff',
        },

        // Structural dark-mode surface/text tokens. These replace the ~440
        // hardcoded dark:*-[#hex] literals scattered across components.
        // Always used with the `dark:` prefix (light mode keeps gray-* / tokens).
        canvas: '#181b34',           // app background
        'canvas-deep': '#1e2035',    // sunken areas (group sub-headers, wells)
        surface: '#30324e',          // cards / panels / inputs
        'surface-hover': '#3a3d5c',  // row + control hover
        'surface-raised': '#3e4259', // pills / raised chips
        line: '#4b4e69',             // borders / dividers
        ink: '#d5d8df',              // primary text
        'ink-muted': '#9699a6',      // secondary text
        'ink-faint': '#797e93',      // tertiary text
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        'sans': ['Figtree', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        // Elevation hierarchy for cards, popovers, and raised panels.
        'elev-1': '0 1px 2px 0 rgba(16, 24, 40, 0.06), 0 1px 3px 0 rgba(16, 24, 40, 0.10)',
        'elev-2': '0 2px 4px -1px rgba(16, 24, 40, 0.08), 0 4px 8px -2px rgba(16, 24, 40, 0.10)',
        'elev-3': '0 4px 8px -2px rgba(16, 24, 40, 0.10), 0 12px 24px -4px rgba(16, 24, 40, 0.12)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}